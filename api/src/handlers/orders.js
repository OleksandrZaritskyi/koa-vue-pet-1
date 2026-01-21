import { query, withTransaction } from '../db/pool.js';

export async function getUserOrders(ctx) {
  const { userId } = ctx.params;

  const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
  if (userCheck.rows.length === 0) {
    ctx.status = 404;
    ctx.body = {
      error: {
        message: 'User not found',
        status: 404,
        requestId: ctx.state.requestId,
      },
    };
    return;
  }

  const result = await query(
    `SELECT 
       o.id,
       o.status,
       o.created_at,
       o.updated_at,
       COUNT(oi.id) as item_count,
       COALESCE(SUM(oi.qty * oi.unit_price_cents), 0) as total_cents
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [userId]
  );

  ctx.body = { orders: result.rows };
}

export async function createOrder(ctx) {
  const { userId } = ctx.params;
  const { status = 'pending', items } = ctx.state.validatedBody;

  const order = await withTransaction(async (client) => {
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    const orderResult = await client.query(
      'INSERT INTO orders (user_id, status) VALUES ($1, $2) RETURNING id, user_id, status, created_at, updated_at',
      [userId, status]
    );
    const newOrder = orderResult.rows[0];

    for (const item of items) {
      const productResult = await client.query(
        'SELECT id, price_cents FROM products WHERE id = $1',
        [item.product_id]
      );

      if (productResult.rows.length === 0) {
        const error = new Error(`Product ${item.product_id} not found`);
        error.status = 400;
        throw error;
      }

      const product = productResult.rows[0];
      const unitPrice = item.unit_price_cents ?? product.price_cents;

      await client.query(
        'INSERT INTO order_items (order_id, product_id, qty, unit_price_cents) VALUES ($1, $2, $3, $4)',
        [newOrder.id, item.product_id, item.qty, unitPrice]
      );
    }

    return newOrder;
  });

  ctx.status = 201;
  ctx.body = { order };
}

export async function getOrder(ctx) {
  const { id } = ctx.params;

  const orderResult = await query(
    'SELECT id, user_id, status, created_at, updated_at FROM orders WHERE id = $1',
    [id]
  );

  if (orderResult.rows.length === 0) {
    ctx.status = 404;
    ctx.body = {
      error: {
        message: 'Order not found',
        status: 404,
        requestId: ctx.state.requestId,
      },
    };
    return;
  }

  const order = orderResult.rows[0];

  const itemsResult = await query(
    `SELECT 
       oi.id,
       oi.product_id,
       oi.qty,
       oi.unit_price_cents,
       p.name as product_name
     FROM order_items oi
     INNER JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1`,
    [id]
  );

  order.items = itemsResult.rows;

  ctx.body = { order };
}
