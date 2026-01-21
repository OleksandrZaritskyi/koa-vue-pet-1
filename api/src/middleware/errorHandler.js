import { logger } from '../logger.js';

export function errorHandler() {
  return async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      const requestId = ctx.state.requestId || 'unknown';
      
      const status = err.status || err.statusCode || 500;
      
      logger.error(
        {
          err,
          requestId,
          method: ctx.method,
          path: ctx.path,
          status,
        },
        'Request error'
      );

      ctx.status = status;
      ctx.body = {
        error: {
          message: status >= 500 ? 'Internal server error' : err.message,
          status,
          requestId,
          ...(process.env.NODE_ENV === 'development' && status >= 500
            ? { stack: err.stack }
            : {}),
        },
      };

      ctx.app.emit('error', err, ctx);
    }
  };
}
