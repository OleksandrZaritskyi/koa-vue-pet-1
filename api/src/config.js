export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://appuser:apppass@localhost:5432/appdb',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  cache: {
    type: process.env.CACHE_TYPE || 'redis',
    ttl: {
      productList: 300, // 5 minutes
      productItem: 600, // 10 minutes
      productTags: 300, // 5 minutes
    },
  },
};
