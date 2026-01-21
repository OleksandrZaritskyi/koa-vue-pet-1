import { query, withTransaction } from '../db/pool.js';
import { getCache, CacheKeys, invalidateProductCache, invalidateProductListCache } from '../cache/index.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

const inFlightRequests = new Map();

export async function listProducts(ctx) {
  const { limit = 20, offset = 0, sort = 'created_at_desc', name } = ctx.query;

  const cacheKey = CacheKeys.productList(limit, offset, sort, name);
  const cache = getCache();

  const cached = await cache.get(cacheKey);
  if (cached) {
    ctx.body = { ...cached, cached: true };
    return;
  }
  let orderBy = 'created_at DESC';
  if (sort === 'created_at_asc') orderBy = 'created_at ASC';
  if (sort === 'name_asc') orderBy = 'name ASC';
  if (sort === 'name_desc') orderBy = 'name DESC';
  if (sort === 'price_asc') orderBy = 'price_cents ASC';
  if (sort === 'price_desc') orderBy = 'price_cents DESC';

  let whereClauses = [];
  let params = [];
  let paramIndex = 1;

  if (name) {
    whereClauses.push(`name ILIKE $${paramIndex}`);
    params.push(`%${name}%`);
    paramIndex++;
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countResult = await query(`SELECT COUNT(*) FROM products ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const result = await query(
    `SELECT id, name, price_cents, created_at, updated_at 
     FROM products 
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  const response = {
    products: result.rows,
    pagination: {
      limit,
      offset,
      total,
    },
  };

  await cache.set(cacheKey, response, config.cache.ttl.productList);

  ctx.body = response;
}

export async function getProduct(ctx) {
  const { id } = ctx.params;
  const cacheKey = CacheKeys.productItem(id);
  const cache = getCache();

  const cached = await cache.get(cacheKey);
  if (cached) {
    ctx.body = { ...cached, cached: true };
    return;
  }

  const lockAcquired = await cache.acquireLock(cacheKey, 5);
  
  if (!lockAcquired) {
    const existingPromise = inFlightRequests.get(id);
    if (existingPromise) {
      const product = await existingPromise;
      ctx.body = { product };
      return;
    }
  }
  const fetchPromise = (async () => {
    try {
      const result = await query(
        'SELECT id, name, price_cents, created_at, updated_at FROM products WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } finally {
      inFlightRequests.delete(id);
      if (lockAcquired) {
        await cache.releaseLock(cacheKey);
      }
    }
  })();

  inFlightRequests.set(id, fetchPromise);
  const product = await fetchPromise;

  if (!product) {
    ctx.status = 404;
    ctx.body = {
      error: {
        message: 'Product not found',
        status: 404,
        requestId: ctx.state.requestId,
      },
    };
    return;
  }

  await cache.set(cacheKey, { product }, config.cache.ttl.productItem);

  ctx.body = { product };
}

export async function createProduct(ctx) {
  const { name, price_cents } = ctx.state.validatedBody;

  const result = await query(
    'INSERT INTO products (name, price_cents) VALUES ($1, $2) RETURNING id, name, price_cents, created_at, updated_at',
    [name, price_cents]
  );

  const product = result.rows[0];

  await invalidateProductListCache();
  
  ctx.status = 201;
  ctx.body = { product };
}

export async function updateProduct(ctx) {
  const { id } = ctx.params;
  const { name, price_cents } = ctx.state.validatedBody;

  const result = await query(
    'UPDATE products SET name = $1, price_cents = $2 WHERE id = $3 RETURNING id, name, price_cents, created_at, updated_at',
    [name, price_cents, id]
  );

  if (result.rows.length === 0) {
    ctx.status = 404;
    ctx.body = {
      error: {
        message: 'Product not found',
        status: 404,
        requestId: ctx.state.requestId,
      },
    };
    return;
  }

  const product = result.rows[0];

  await invalidateProductCache(id);
  await invalidateProductListCache();

  ctx.body = { product };
}

export async function deleteProduct(ctx) {
  const { id } = ctx.params;

  const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    ctx.status = 404;
    ctx.body = {
      error: {
        message: 'Product not found',
        status: 404,
        requestId: ctx.state.requestId,
      },
    };
    return;
  }

  await invalidateProductCache(id);
  await invalidateProductListCache();

  ctx.status = 204;
}

export async function getProductTags(ctx) {
  const { id } = ctx.params;
  const cacheKey = CacheKeys.productTags(id);
  const cache = getCache();
  const cached = await cache.get(cacheKey);
  if (cached) {
    ctx.body = { ...cached, cached: true };
    return;
  }

  const result = await query(
    `SELECT t.id, t.name 
     FROM tags t
     INNER JOIN product_tags pt ON pt.tag_id = t.id
     WHERE pt.product_id = $1
     ORDER BY t.name`,
    [id]
  );

  const response = { tags: result.rows };

  await cache.set(cacheKey, response, config.cache.ttl.productTags);

  ctx.body = response;
}

export async function attachProductTags(ctx) {
  const { id } = ctx.params;
  const { tagIds } = ctx.state.validatedBody;

  await withTransaction(async (client) => {
    const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [id]);
    if (productCheck.rows.length === 0) {
      const error = new Error('Product not found');
      error.status = 404;
      throw error;
    }

    const tagCheck = await client.query(
      'SELECT id FROM tags WHERE id = ANY($1::uuid[])',
      [tagIds]
    );
    if (tagCheck.rows.length !== tagIds.length) {
      const error = new Error('One or more tags not found');
      error.status = 400;
      throw error;
    }

    for (const tagId of tagIds) {
      await client.query(
        'INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, tagId]
      );
    }
  });
  await invalidateProductCache(id);

  ctx.status = 204;
}

export async function replaceProductTags(ctx) {
  const { id } = ctx.params;
  const { tagIds } = ctx.state.validatedBody;

  await withTransaction(async (client) => {
    const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [id]);
    if (productCheck.rows.length === 0) {
      const error = new Error('Product not found');
      error.status = 404;
      throw error;
    }

    if (tagIds.length > 0) {
      const tagCheck = await client.query(
        'SELECT id FROM tags WHERE id = ANY($1::uuid[])',
        [tagIds]
      );
      if (tagCheck.rows.length !== tagIds.length) {
        const error = new Error('One or more tags not found');
        error.status = 400;
        throw error;
      }
    }

    await client.query('DELETE FROM product_tags WHERE product_id = $1', [id]);

    for (const tagId of tagIds) {
      await client.query(
        'INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2)',
        [id, tagId]
      );
    }
  });
  await invalidateProductCache(id);

  ctx.status = 204;
}
