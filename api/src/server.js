import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import { config } from './config.js';
import { logger } from './logger.js';
import { waitForDatabase } from './db/pool.js';
import { initializeCache } from './cache/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { loggingMiddleware } from './middleware/logging.js';
import router from './routes/index.js';

const app = new Koa();

app.use(cors());
app.use(errorHandler());
app.use(requestIdMiddleware());
app.use(loggingMiddleware());
app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

app.on('error', (err, ctx) => {
  if (!ctx) {
    logger.error({ err }, 'Unhandled application error');
  }
});

async function startServer() {
  try {
    logger.info('Waiting for database...');
    await waitForDatabase();

    logger.info('Running migrations...');
    await runMigrations();

    if (config.nodeEnv === 'development') {
      logger.info('Running seeds...');
      try {
        await seed();
      } catch (error) {
        logger.warn({ error: error.message }, 'Seed warning (may be expected)');
      }
    }

    logger.info('Initializing cache...');
    await initializeCache();

    const server = app.listen(config.port, () => {
      logger.info({ port: config.port, env: config.nodeEnv }, 'Server started');
    });
    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutdown signal received');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
