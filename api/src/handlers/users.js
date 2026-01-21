import { query } from '../db/pool.js';

export async function listUsers(ctx) {
  const result = await query(
    'SELECT id, email, name, created_at, updated_at FROM users ORDER BY created_at DESC'
  );
  ctx.body = { users: result.rows };
}

export async function createUser(ctx) {
  const { email, name } = ctx.state.validatedBody;

  try {
    const result = await query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id, email, name, created_at, updated_at',
      [email, name]
    );
    ctx.status = 201;
    ctx.body = { user: result.rows[0] };
  } catch (error) {
    if (error.code === '23505') {
      ctx.status = 409;
      ctx.body = {
        error: {
          message: 'User with this email already exists',
          status: 409,
          requestId: ctx.state.requestId,
        },
      };
    } else {
      throw error;
    }
  }
}
