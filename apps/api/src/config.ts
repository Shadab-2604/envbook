import dotenv from 'dotenv';
import path from 'path';

// Load .env from root workspace or local directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/envbook';
const PORT = parseInt(process.env.PORT || '5000', 10);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is missing.');
}

export const config = {
  MONGODB_URI,
  PORT,
  JWT_SECRET,
  IS_PROD: process.env.NODE_ENV === 'production',
  COOKIE_NAME: 'envbook_token',
  JWT_EXPIRY: '7d',
};
