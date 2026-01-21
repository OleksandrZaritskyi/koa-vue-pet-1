import { describe, it, expect, beforeEach } from '@jest/globals';

class MockCache {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async set(key, value, ttl) {
    this.store.set(key, value);
    return true;
  }

  async del(key) {
    this.store.delete(key);
    return true;
  }

  async mget(keys) {
    return keys.map((key) => this.store.get(key) || null);
  }

  async mset(entries, ttl) {
    for (const [key, value] of entries) {
      this.store.set(key, value);
    }
    return true;
  }

  async isHealthy() {
    return true;
  }

  clear() {
    this.store.clear();
  }
}

describe('Cache Interface', () => {
  let cache;

  beforeEach(() => {
    cache = new MockCache();
  });

  it('should set and get a value', async () => {
    await cache.set('test:key', { foo: 'bar' }, 60);
    const value = await cache.get('test:key');
    expect(value).toEqual({ foo: 'bar' });
  });

  it('should return null for non-existent key', async () => {
    const value = await cache.get('non:existent');
    expect(value).toBeNull();
  });

  it('should delete a key', async () => {
    await cache.set('test:key', 'value', 60);
    await cache.del('test:key');
    const value = await cache.get('test:key');
    expect(value).toBeNull();
  });

  it('should handle multiple get', async () => {
    await cache.set('key1', 'value1', 60);
    await cache.set('key2', 'value2', 60);
    const values = await cache.mget(['key1', 'key2', 'key3']);
    expect(values).toEqual(['value1', 'value2', null]);
  });

  it('should handle multiple set', async () => {
    await cache.mset(
      [
        ['key1', 'value1'],
        ['key2', 'value2'],
      ],
      60
    );
    const value1 = await cache.get('key1');
    const value2 = await cache.get('key2');
    expect(value1).toBe('value1');
    expect(value2).toBe('value2');
  });

  it('should report healthy', async () => {
    const healthy = await cache.isHealthy();
    expect(healthy).toBe(true);
  });
});
