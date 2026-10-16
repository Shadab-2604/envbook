import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-envbook-secret-key-32bytes-min';

export interface TokenPayload {
  userId: string;
  username: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'envbook-api',
    audience: 'envbook-app',
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'envbook-api',
      audience: 'envbook-app',
    }) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}
