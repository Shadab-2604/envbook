import { createApp } from './app.js';
import { connectDB, disconnectDB } from './db.js';
import { config } from './config.js';

async function bootstrap() {
  try {
    await connectDB();

    const app = createApp();

    const server = app.listen(config.PORT, '127.0.0.1', () => {
      console.log(`[EnvBook API] Server running strictly on http://127.0.0.1:${config.PORT}`);
    });

    const shutdown = async () => {
      console.log('\n[EnvBook API] Gracefully shutting down...');
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[EnvBook API] Fatal bootstrap failure:', (error as Error).message);
    process.exit(1);
  }
}

bootstrap();
