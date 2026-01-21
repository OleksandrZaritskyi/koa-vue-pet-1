import { z } from 'zod';

/**
 * Validation middleware factory
 * @param {Object} schema - Object with optional 'params', 'query', 'body' zod schemas
 */
export function validate(schema) {
  return async (ctx, next) => {
    const errors = [];

    if (schema.params) {
      const result = schema.params.safeParse(ctx.params);
      if (!result.success) {
        errors.push({
          location: 'params',
          errors: result.error.errors,
        });
      }
    }

    if (schema.query) {
      const result = schema.query.safeParse(ctx.query);
      if (!result.success) {
        errors.push({
          location: 'query',
          errors: result.error.errors,
        });
      }
    }

    if (schema.body) {
      const result = schema.body.safeParse(ctx.request.body);
      if (!result.success) {
        errors.push({
          location: 'body',
          errors: result.error.errors,
        });
      } else {
        ctx.state.validatedBody = result.data;
      }
    }

    if (errors.length > 0) {
      ctx.status = 400;
      ctx.body = {
        error: {
          message: 'Validation failed',
          status: 400,
          requestId: ctx.state.requestId,
          details: errors,
        },
      };
      return;
    }

    await next();
  };
}

export const schemas = {
  uuid: z.string().uuid(),
  positiveInt: z.coerce.number().int().positive(),
  nonNegativeInt: z.coerce.number().int().min(0),
  paginationQuery: z.object({
    limit: z.coerce.number().int().positive().max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
};
