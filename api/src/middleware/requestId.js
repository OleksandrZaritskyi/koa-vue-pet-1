import { randomUUID } from 'crypto';

export function requestIdMiddleware() {
  return async (ctx, next) => {
    const requestId = ctx.headers['x-request-id'] || randomUUID();
    ctx.state.requestId = requestId;
    ctx.set('X-Request-Id', requestId);
    await next();
  };
}
