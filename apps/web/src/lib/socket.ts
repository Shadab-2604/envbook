'use client';

import { io, Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance && typeof window !== 'undefined') {
    // When running standalone API, port is 5000; when integrated in Next.js, port is window.location.port
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      (window.location.port === '3000'
        ? 'http://127.0.0.1:5000'
        : window.location.origin);

    socketInstance = io(socketUrl, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected to real-time update engine');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socketInstance.on('connect_error', (err) => {
      // Non-fatal fallback for static deployments
      console.debug('[Socket] Connection attempt:', err.message);
    });
  }

  return socketInstance as Socket;
}

/**
 * Hook for live collaboration on a page
 */
export function usePageCollaboration(
  pageId?: string,
  callbacks?: {
    onRemoteUpdate?: (data: { content: string; title?: string; updatedBy: any }) => void;
    onCollaboratorJoined?: (data: { userId: string; username: string }) => void;
    onCollaboratorLeft?: (data: { userId: string; username: string }) => void;
  }
) {
  const [collaborators, setCollaborators] = useState<Array<{ userId: string; username: string }>>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!pageId || typeof window === 'undefined') return;

    const socket = getSocket();
    if (!socket) return;

    if (socket.connected) {
      setIsConnected(true);
      socket.emit('join_page', { pageId });
    }

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit('join_page', { pageId });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleRemoteUpdate = (data: any) => {
      if (data.pageId === pageId && callbacks?.onRemoteUpdate) {
        callbacks.onRemoteUpdate(data);
      }
    };

    const handleCollaboratorJoined = (data: any) => {
      setCollaborators((prev) => {
        if (prev.some((c) => c.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, username: data.username }];
      });
      callbacks?.onCollaboratorJoined?.(data);
    };

    const handleCollaboratorLeft = (data: any) => {
      setCollaborators((prev) => prev.filter((c) => c.userId !== data.userId));
      callbacks?.onCollaboratorLeft?.(data);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('remote_page_content_change', handleRemoteUpdate);
    socket.on('collaborator_joined', handleCollaboratorJoined);
    socket.on('collaborator_left', handleCollaboratorLeft);

    return () => {
      socket.emit('leave_page', { pageId });
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('remote_page_content_change', handleRemoteUpdate);
      socket.off('collaborator_joined', handleCollaboratorJoined);
      socket.off('collaborator_left', handleCollaboratorLeft);
    };
  }, [pageId, callbacks]);

  const broadcastChange = (content: string, title?: string) => {
    if (!pageId) return;
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('page_content_change', { pageId, content, title });
    }
  };

  return { isConnected, collaborators, broadcastChange };
}

/**
 * Hook for in-app real-time notifications & tree updates
 */
export function useRealTimeEvents(callbacks?: {
  onNotification?: (notification: any) => void;
  onTreeUpdate?: () => void;
  onPermissionChanged?: (data: any) => void;
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const socket = getSocket();
    if (!socket) return;

    const handleNotification = (notif: any) => {
      callbacks?.onNotification?.(notif);
    };

    const handleTree = () => {
      callbacks?.onTreeUpdate?.();
    };

    const handlePerm = (data: any) => {
      callbacks?.onPermissionChanged?.(data);
    };

    socket.on('new_notification', handleNotification);
    socket.on('workspace_tree_updated', handleTree);
    socket.on('permission_changed', handlePerm);

    return () => {
      socket.off('new_notification', handleNotification);
      socket.off('workspace_tree_updated', handleTree);
      socket.off('permission_changed', handlePerm);
    };
  }, [callbacks]);
}
