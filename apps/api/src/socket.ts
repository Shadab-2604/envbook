import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from './utils/jwt.js';
import { Entry } from './models/Entry.js';
import { PageShare } from './models/PageShare.js';
import cookie from 'cookie';

let ioInstance: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          origin === 'http://localhost:3000' ||
          origin === 'http://127.0.0.1:3000' ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          return callback(null, true);
        }
        callback(null, true);
      },
      credentials: true,
    },
  });

  // Socket Authentication Middleware
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      let token: string | undefined = undefined;

      if (cookieHeader) {
        const parsed = cookie.parse(cookieHeader);
        token = parsed.envbook_token;
      }

      if (!token && socket.handshake.auth?.token) {
        token = socket.handshake.auth.token;
      }

      if (!token) {
        // Allow unauthenticated connection only if requesting public page viewing
        socket.data.isGuest = true;
        socket.data.userId = 'guest-' + socket.id;
        socket.data.username = 'Guest';
        return next();
      }

      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        socket.data.isGuest = true;
        socket.data.userId = 'guest-' + socket.id;
        socket.data.username = 'Guest';
        return next();
      }

      socket.data.userId = decoded.userId;
      socket.data.username = decoded.username || 'User';
      socket.data.isGuest = false;
      return next();
    } catch {
      socket.data.isGuest = true;
      socket.data.userId = 'guest-' + socket.id;
      socket.data.username = 'Guest';
      return next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;

    // Join personal user notification room
    if (!socket.data.isGuest && userId) {
      socket.join(`user:${userId}`);
    }

    // Join Page Room with authorization check
    socket.on('join_page', async (data: { pageId: string; shareToken?: string }) => {
      const { pageId, shareToken } = data || {};
      if (!pageId) return;

      try {
        let authorized = false;

        if (!socket.data.isGuest && userId) {
          // Check ownership
          const entry = await Entry.findOne({ entryId: pageId });
          if (entry && entry.owner.toString() === userId) {
            authorized = true;
          }

          // Check collaborator status
          if (!authorized) {
            const share = await PageShare.findOne({ pageId });
            if (
              share &&
              share.collaborators.some((c: any) => c.userId.toString() === userId)
            ) {
              authorized = true;
            }
          }
        }

        // Check public share token or published page
        if (!authorized && shareToken) {
          const share = await PageShare.findOne({
            pageId,
            publicShareToken: shareToken,
            isPublicLinkEnabled: true,
          });
          if (share) authorized = true;
        }

        if (authorized) {
          socket.join(`page:${pageId}`);
          socket.to(`page:${pageId}`).emit('collaborator_joined', {
            userId,
            username,
            timestamp: new Date().toISOString(),
          });
        } else {
          socket.emit('error', { message: 'Unauthorized to join page room' });
        }
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // Leave Page Room
    socket.on('leave_page', (data: { pageId: string }) => {
      const { pageId } = data || {};
      if (pageId) {
        socket.leave(`page:${pageId}`);
        socket.to(`page:${pageId}`).emit('collaborator_left', {
          userId,
          username,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Real-Time Editing Broadcast
    socket.on(
      'page_content_change',
      (data: { pageId: string; content: string; title?: string }) => {
        const { pageId, content, title } = data || {};
        if (!pageId) return;

        // Broadcast to other collaborators in this page room
        socket.to(`page:${pageId}`).emit('remote_page_content_change', {
          pageId,
          content,
          title,
          updatedBy: { userId, username },
          timestamp: new Date().toISOString(),
        });
      }
    );

    socket.on('disconnect', () => {
      // Clean up
    });
  });

  ioInstance = io;
  return io;
}

export function getSocketServer(): Server | null {
  return ioInstance;
}

/**
 * Helper to dispatch in-app notification to a user in real-time
 */
export function broadcastNotification(recipientId: string, notification: any) {
  if (!ioInstance) return;
  ioInstance.to(`user:${recipientId}`).emit('new_notification', notification);
}

/**
 * Helper to notify collaborators about permission change or revocation
 */
export function broadcastPermissionChange(
  recipientId: string,
  pageId: string,
  role: string | null
) {
  if (!ioInstance) return;
  ioInstance.to(`user:${recipientId}`).emit('permission_changed', {
    pageId,
    role,
    revoked: role === null,
    timestamp: new Date().toISOString(),
  });

  if (role === null) {
    // If access was revoked, kick user from page room
    ioInstance.in(`user:${recipientId}`).socketsLeave(`page:${pageId}`);
  }
}

/**
 * Helper to broadcast workspace tree updates
 */
export function broadcastTreeUpdate(userId: string) {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit('workspace_tree_updated');
}
