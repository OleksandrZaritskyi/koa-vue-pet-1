import { query } from '../db/pool.js';

export async function listTags(ctx) {
  const result = await query('SELECT id, name FROM tags ORDER BY name');
  ctx.body = { tags: result.rows };
}

export async function createTag(ctx) {
  const { name } = ctx.state.validatedBody;

  try {
    const result = await query(
      'INSERT INTO tags (name) VALUES ($1) RETURNING id, name',
      [name]
    );
    ctx.status = 201;
    ctx.body = { tag: result.rows[0] };
  } catch (error) {
    if (error.code === '23505') {
      ctx.status = 409;
      ctx.body = {
        error: {
          message: 'Tag with this name already exists',
          status: 409,
          requestId: ctx.state.requestId,
        },
      };
    } else {
      throw error;
    }
  }
}
