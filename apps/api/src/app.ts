import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import vaultRoutes from './routes/vaultRoutes.js';
import entryRoutes from './routes/entryRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import envaiRoutes from './routes/envaiRoutes.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): express.Application {
  const app = express();

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Managed by Next.js frontend proxy
      crossOriginResourcePolicy: { policy: 'same-origin' },
    })
  );

  // CORS configuration for loopback origins
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin server-side rewrites)
        if (!origin) return callback(null, true);
        if (
          origin === 'http://localhost:3000' ||
          origin === 'http://127.0.0.1:3000' ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          return callback(null, true);
        }
        callback(new Error('Cross-Origin Request Blocked by EnvBook Security Policy'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Parsers
  app.use(cookieParser());
  app.use(express.json({ limit: '5mb' }));

  // Global rate limiter on v1 endpoints
  app.use('/api/v1', apiRateLimiter);

  // API v1 Routes
  app.use('/api/v1', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/vault', vaultRoutes);
  app.use('/api/v1/entries', entryRoutes);
  app.use('/api/v1/backup', backupRoutes);
  app.use('/api/v1/envai', envaiRoutes);

  // 404 Catch-All for undefined API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      error: `API route not found: ${req.method} ${req.baseUrl}`,
      code: 'NOT_FOUND',
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
