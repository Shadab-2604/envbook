import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt.js';
import { User, IUser } from '../models/User.js';
import { config } from '../config.js';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  tokenPayload?: TokenPayload;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined = req.cookies?.[config.COOKIE_NAME];

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      res.status(401).json({
        error: 'Authentication required. Please log in.',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({
        error: 'Invalid or expired session. Please log in again.',
        code: 'TOKEN_INVALID',
      });
      return;
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      res.status(401).json({
        error: 'User account not found.',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (err) {
    res.status(500).json({
      error: 'Internal server error during authentication.',
      code: 'AUTH_ERROR',
    });
  }
}
