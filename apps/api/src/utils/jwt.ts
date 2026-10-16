import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface TokenPayload {
  userId: string;
  username: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'envbook-api',
    audience: 'envbook-app',
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      issuer: 'envbook-api',
      audience: 'envbook-app',
    }) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}
