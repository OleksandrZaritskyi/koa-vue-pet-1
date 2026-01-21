import { logger } from '../logger.js';

export function loggingMiddleware() {
  return async (ctx, next) => {
    const start = Date.now();
    const requestId = ctx.state.requestId || 'unknown';

    logger.info(
      {
        requestId,
        method: ctx.method,
        path: ctx.path,
        query: ctx.query,
      },
      'Incoming request'
    );

    await next();

    const duration = Date.now() - start;
    logger.info(
      {
        requestId,
        method: ctx.method,
        path: ctx.path,
        status: ctx.status,
        duration,
      },
      'Request completed'
    );
  };
}
