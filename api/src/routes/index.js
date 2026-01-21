import Router from '@koa/router';
import { z } from 'zod';
import { validate, schemas } from '../middleware/validation.js';
import * as productsHandler from '../handlers/products.js';
import * as tagsHandler from '../handlers/tags.js';
import * as usersHandler from '../handlers/users.js';
import * as ordersHandler from '../handlers/orders.js';
import { pool } from '../db/pool.js';
import { getCache } from '../cache/index.js';

const router = new Router();

router.get('/api/health', async (ctx) => {
  const checks = {
    postgres: false,
    cache: false,
  };

  try {
    await pool.query('SELECT 1');
    checks.postgres = true;
  } catch (error) {
  }

  try {
    const cache = getCache();
    checks.cache = await cache.isHealthy();
  } catch (error) {
  }

  const healthy = checks.postgres && checks.cache;
  ctx.status = healthy ? 200 : 503;
  ctx.body = {
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
  };
});

router.post('/api/invalidateCache', async (ctx) => {
  const cache = getCache();
  await cache.clear();
  ctx.status = 204;
});

router.get(
  '/api/products',
  validate({
    query: schemas.paginationQuery.extend({
      sort: z.enum(['created_at_asc', 'created_at_desc', 'name_asc', 'name_desc', 'price_asc', 'price_desc']).optional().default('created_at_desc'),
      name: z.string().optional(),
    }),
  }),
  productsHandler.listProducts
);

router.get(
  '/api/products/:id',
  validate({
    params: z.object({ id: schemas.uuid }),
  }),
  productsHandler.getProduct
);

router.post(
  '/api/products',
  validate({
    body: z.object({
      name: z.string().min(1).max(255),
      price_cents: schemas.nonNegativeInt,
    }),
  }),
  productsHandler.createProduct
);

router.put(
  '/api/products/:id',
  validate({
    params: z.object({ id: schemas.uuid }),
    body: z.object({
      name: z.string().min(1).max(255),
      price_cents: schemas.nonNegativeInt,
    }),
  }),
  productsHandler.updateProduct
);

router.delete(
  '/api/products/:id',
  validate({
    params: z.object({ id: schemas.uuid }),
  }),
  productsHandler.deleteProduct
);

router.get(
  '/api/products/:id/tags',
  validate({
    params: z.object({ id: schemas.uuid }),
  }),
  productsHandler.getProductTags
);

router.post(
  '/api/products/:id/tags',
  validate({
    params: z.object({ id: schemas.uuid }),
    body: z.object({
      tagIds: z.array(schemas.uuid).min(1),
    }),
  }),
  productsHandler.attachProductTags
);

router.put(
  '/api/products/:id/tags',
  validate({
    params: z.object({ id: schemas.uuid }),
    body: z.object({
      tagIds: z.array(schemas.uuid),
    }),
  }),
  productsHandler.replaceProductTags
);

router.get('/api/tags', tagsHandler.listTags);

router.post(
  '/api/tags',
  validate({
    body: z.object({
      name: z.string().min(1).max(100),
    }),
  }),
  tagsHandler.createTag
);

router.get('/api/users', usersHandler.listUsers);

router.post(
  '/api/users',
  validate({
    body: z.object({
      email: z.string().email(),
      name: z.string().min(1).max(255).optional(),
    }),
  }),
  usersHandler.createUser
);

router.get(
  '/api/users/:userId/orders',
  validate({
    params: z.object({ userId: schemas.uuid }),
  }),
  ordersHandler.getUserOrders
);

router.post(
  '/api/users/:userId/orders',
  validate({
    params: z.object({ userId: schemas.uuid }),
    body: z.object({
      status: z.string().optional(),
      items: z.array(
        z.object({
          product_id: schemas.uuid,
          qty: schemas.positiveInt,
          unit_price_cents: schemas.nonNegativeInt.optional(),
        })
      ).min(1),
    }),
  }),
  ordersHandler.createOrder
);

router.get(
  '/api/orders/:id',
  validate({
    params: z.object({ id: schemas.uuid }),
  }),
  ordersHandler.getOrder
);

export default router;
