import { pool, query } from './pool.js';
import { logger } from '../logger.js';

async function seed() {
  logger.info('Starting seed process');

  const users = [
    { email: 'alice@example.com', name: 'Alice Smith' },
    { email: 'bob@example.com', name: 'Bob Johnson' },
    { email: 'charlie@example.com', name: 'Charlie Brown' },
  ];

  const userIds = [];
  for (const user of users) {
    const result = await query(
      'INSERT INTO users (email, name) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [user.email, user.name]
    );
    userIds.push(result.rows[0].id);
  }
  logger.info({ count: userIds.length }, 'Users created');

  const products = [
    { name: 'Laptop', price_cents: 99999 },
    { name: 'Wireless Mouse', price_cents: 2999 },
    { name: 'Mechanical Keyboard', price_cents: 12999 },
    { name: 'USB-C Cable', price_cents: 1499 },
    { name: '27" Monitor', price_cents: 34999 },
    { name: 'Webcam HD', price_cents: 7999 },
  ];

  const productIds = [];
  for (const product of products) {
    const result = await query(
      'INSERT INTO products (name, price_cents) VALUES ($1, $2) RETURNING id',
      [product.name, product.price_cents]
    );
    productIds.push(result.rows[0].id);
  }
  logger.info({ count: productIds.length }, 'Products created');

  const tags = [
    'Electronics',
    'Computer',
    'Accessories',
    'Peripherals',
    'Office',
    'Gaming',
  ];

  const tagIds = [];
  for (const tag of tags) {
    const result = await query(
      'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [tag]
    );
    tagIds.push(result.rows[0].id);
  }
  logger.info({ count: tagIds.length }, 'Tags created');

  const productTagMappings = [
    { productIdx: 0, tagIdxs: [0, 1, 5] },
    { productIdx: 1, tagIdxs: [0, 2, 3] },
    { productIdx: 2, tagIdxs: [0, 2, 3, 5] },
    { productIdx: 3, tagIdxs: [0, 2] },
    { productIdx: 4, tagIdxs: [0, 1, 4] },
    { productIdx: 5, tagIdxs: [0, 2, 4] },
  ];

  let productTagCount = 0;
  for (const mapping of productTagMappings) {
    for (const tagIdx of mapping.tagIdxs) {
      await query(
        'INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [productIds[mapping.productIdx], tagIds[tagIdx]]
      );
      productTagCount++;
    }
  }
  logger.info({ count: productTagCount }, 'Product-tag relationships created');

  const orderResult = await query(
    'INSERT INTO orders (user_id, status) VALUES ($1, $2) RETURNING id',
    [userIds[0], 'completed']
  );
  const orderId = orderResult.rows[0].id;

  const orderItems = [
    { productIdx: 0, qty: 1 },
    { productIdx: 1, qty: 2 },
    { productIdx: 2, qty: 1 },
  ];

  for (const item of orderItems) {
    const productId = productIds[item.productIdx];
    const productResult = await query('SELECT price_cents FROM products WHERE id = $1', [
      productId,
    ]);
    const unitPrice = productResult.rows[0].price_cents;

    await query(
      'INSERT INTO order_items (order_id, product_id, qty, unit_price_cents) VALUES ($1, $2, $3, $4)',
      [orderId, productId, item.qty, unitPrice]
    );
  }
  logger.info({ orderId }, 'Order created with items');

  logger.info('Seed process completed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => {
      logger.info('Seed complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Seed failed');
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

export { seed };
