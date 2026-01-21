import { RedisCache, waitForRedis } from './redis.js';
import { config } from '../config.js';

let cacheInstance = null;

export async function initializeCache() {
  if (config.cache.type === 'redis') {
    cacheInstance = new RedisCache();
    await waitForRedis(cacheInstance);
  } else {
    throw new Error(`Unsupported cache type: ${config.cache.type}`);
  }
  return cacheInstance;
}

export function getCache() {
  if (!cacheInstance) {
    throw new Error('Cache not initialized. Call initializeCache() first.');
  }
  return cacheInstance;
}

// Cache key builders with versioning and namespacing
export const CacheKeys = {
  productList: (limit, offset, sort, nameFilter) => {
    const name = nameFilter || '';
    return `products:v1:list:limit=${limit}:offset=${offset}:sort=${sort}:name=${name}`;
  },
  productItem: (id) => `products:v1:item:${id}`,
  productTags: (id) => `products:v1:tags:${id}`,
};

// Cache invalidation helpers
export async function invalidateProductCache(productId) {
  const cache = getCache();
  
  // Delete specific product item and tags
  await cache.del(CacheKeys.productItem(productId));
  await cache.del(CacheKeys.productTags(productId));
  
  // Invalidate all product list caches (coarse invalidation)
  // In production, you might maintain a set of active list keys or use patterns
  // For simplicity, we'll document this limitation
}

export async function invalidateProductListCache() {
  const cache = getCache();
  
  // Delete all product list cache keys using pattern matching
  await cache.deleteByPattern('products:v1:list:*');
}
