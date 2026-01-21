import { createClient } from 'redis';
import { ICache } from './interface.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export class RedisCache extends ICache {
  constructor() {
    super();
    this.client = null;
    this.connected = false;
  }

  async connect() {
    this.client = createClient({
      url: config.redis.url,
    });

    this.client.on('error', (err) => {
      logger.error({ err }, 'Redis client error');
      this.connected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.connected = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.connected = true;
    });

    await this.client.connect();
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
    }
  }

  async get(key) {
    if (!this.connected) {
      logger.warn('Redis not connected, cache miss');
      return null;
    }
    try {
      const value = await this.client.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      logger.error({ error, key }, 'Redis get error');
      return null;
    }
  }

  async set(key, value, ttlSeconds) {
    if (!this.connected) {
      logger.warn('Redis not connected, skipping cache set');
      return false;
    }
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error({ error, key }, 'Redis set error');
      return false;
    }
  }

  async del(key) {
    if (!this.connected) {
      logger.warn('Redis not connected, skipping cache del');
      return false;
    }
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error({ error, key }, 'Redis del error');
      return false;
    }
  }

  async deleteByPattern(pattern) {
    if (!this.connected) {
      logger.warn('Redis not connected, skipping pattern delete');
      return 0;
    }
    try {
      let deletedCount = 0;
      let cursor = '0';
      
      do {
        const result = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        
        cursor = result.cursor.toString();
        const keys = result.keys;
        
        if (keys.length > 0) {
          await this.client.del(keys);
          deletedCount += keys.length;
        }
      } while (cursor !== '0');
      
      logger.debug({ pattern, deletedCount }, 'Deleted keys by pattern');
      return deletedCount;
    } catch (error) {
      logger.error({ error, pattern }, 'Redis delete by pattern error');
      return 0;
    }
  }

  async mget(keys) {
    if (!this.connected || keys.length === 0) {
      return [];
    }
    try {
      const values = await this.client.mGet(keys);
      return values.map((v) => (v ? JSON.parse(v) : null));
    } catch (error) {
      logger.error({ error, keys }, 'Redis mget error');
      return [];
    }
  }

  async mset(entries, ttlSeconds) {
    if (!this.connected || entries.length === 0) {
      return false;
    }
    try {
      const pipeline = this.client.multi();
      for (const [key, value] of entries) {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
          pipeline.setEx(key, ttlSeconds, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }
      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error({ error }, 'Redis mset error');
      return false;
    }
  }

  async isHealthy() {
    if (!this.connected) {
      return false;
    }
    try {
      const testKey = 'health:check';
      const testValue = { timestamp: Date.now() };
      await this.set(testKey, testValue, 10);
      const retrieved = await this.get(testKey);
      await this.del(testKey);
      return retrieved !== null && retrieved.timestamp === testValue.timestamp;
    } catch (error) {
      logger.error({ error }, 'Redis health check failed');
      return false;
    }
  }

  // Stampede protection: simple lock using SET NX EX
  async acquireLock(key, ttlSeconds = 5) {
    if (!this.connected) {
      return false;
    }
    try {
      const lockKey = `lock:${key}`;
      const result = await this.client.set(lockKey, '1', {
        NX: true,
        EX: ttlSeconds,
      });
      return result === 'OK';
    } catch (error) {
      logger.error({ error, key }, 'Redis lock acquire error');
      return false;
    }
  }

  async releaseLock(key) {
    if (!this.connected) {
      return false;
    }
    try {
      const lockKey = `lock:${key}`;
      await this.client.del(lockKey);
      return true;
    } catch (error) {
      logger.error({ error, key }, 'Redis lock release error');
      return false;
    }
  }
}

// Wait for Redis to be ready with exponential backoff
export async function waitForRedis(cache, maxRetries = 10, initialDelay = 1000) {
  let retries = 0;
  let delay = initialDelay;

  while (retries < maxRetries) {
    try {
      await cache.connect();
      const healthy = await cache.isHealthy();
      if (healthy) {
        logger.info('Redis connection established');
        return true;
      }
    } catch (error) {
      // Continue to retry logic
    }

    retries++;
    if (retries >= maxRetries) {
      logger.error({ retries }, 'Failed to connect to Redis after max retries');
      throw new Error('Redis connection failed');
    }

    logger.warn({ retries, delay }, 'Redis not ready, retrying...');
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 10000);
  }
}
