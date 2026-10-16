import { Request, Response, NextFunction } from 'express';
import { SignupSchema, LoginSchema, ChangePasswordSchema, SafeUser } from '@envbook/shared';
import { User } from '../models/User.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { config } from '../config.js';
import { logSecurityEvent } from '../models/AuditLog.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

function setAuthCookie(res: Response, token: string): void {
  res.cookie(config.COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function formatUserResponse(user: any): SafeUser {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    email: user.email,
    vaultInitialized: Boolean(user.vaultMetadata?.isInitialized),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = SignupSchema.parse(req.body);

    const existingUser = await User.findOne({
      $or: [{ username: input.username }, { email: input.email }],
    });

    if (existingUser) {
      const field = existingUser.username === input.username ? 'Username' : 'Email';
      res.status(409).json({
        error: `${field} is already taken. Please choose another.`,
        code: 'USER_EXISTS',
      });
      return;
    }

    const passwordHash = await hashPassword(input.password);

    const user = await User.create({
      name: input.name,
      username: input.username,
      email: input.email,
      passwordHash,
      vaultMetadata: {
        isInitialized: false,
      },
    });

    const token = signToken({
      userId: user._id.toString(),
      username: user.username,
    });

    setAuthCookie(res, token);
    await logSecurityEvent('USER_SIGNUP', {
      userId: user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      user: formatUserResponse(user),
      message: 'Account created successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = LoginSchema.parse(req.body);
    const identifier = input.identifier.toLowerCase();

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });

    if (!user) {
      res.status(401).json({
        error: 'Invalid credentials. Please verify your username/email and password.',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    const passwordValid = await verifyPassword(user.passwordHash, input.password);
    if (!passwordValid) {
      await logSecurityEvent('FAILED_LOGIN_ATTEMPT', {
        userId: user._id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(401).json({
        error: 'Invalid credentials. Please verify your username/email and password.',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    const token = signToken({
      userId: user._id.toString(),
      username: user.username,
    });

    setAuthCookie(res, token);
    await logSecurityEvent('USER_LOGIN', {
      userId: user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      user: formatUserResponse(user),
      message: 'Logged in successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie(config.COOKIE_NAME, {
    httpOnly: true,
    secure: config.IS_PROD,
    sameSite: 'lax',
    path: '/',
  });

  res.status(200).json({
    message: 'Logged out successfully',
  });
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(200).json({
    user: formatUserResponse(req.user),
  });
}

export async function changePassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = ChangePasswordSchema.parse(req.body);
    const user = req.user!;

    const isValid = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!isValid) {
      res.status(401).json({
        error: 'Current password is incorrect.',
        code: 'INVALID_PASSWORD',
      });
      return;
    }

    user.passwordHash = await hashPassword(input.newPassword);
    await user.save();

    await logSecurityEvent('PASSWORD_CHANGED', {
      userId: user._id,
      ip: req.ip,
    });

    res.status(200).json({
      message: 'Password changed successfully',
    });
  } catch (err) {
    next(err);
  }
}
