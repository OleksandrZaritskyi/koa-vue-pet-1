/**
 * ICache interface - defines common cache operations
 */
export class ICache {
  async get(key) {
    throw new Error('Not implemented');
  }

  async set(key, value, ttlSeconds) {
    throw new Error('Not implemented');
  }

  async del(key) {
    throw new Error('Not implemented');
  }

  async mget(keys) {
    throw new Error('Not implemented');
  }

  async mset(entries, ttlSeconds) {
    throw new Error('Not implemented');
  }

  async isHealthy() {
    throw new Error('Not implemented');
  }
}
