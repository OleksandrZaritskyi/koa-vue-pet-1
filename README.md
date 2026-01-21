# Koa + Vue Fullstack Application

A production-structured fullstack application with:
- **Backend**: Node.js + Koa (JavaScript ESM), PostgreSQL, Redis
- **Frontend**: Vue 3 (Composition API)
- **Infrastructure**: Docker Compose with nginx reverse proxy

## 🚀 Quick Start

**One command to start everything:**

```bash
# Copy environment file
cp .env.example .env

# Start all services
docker compose up --build
```

That's it! The application will:
1. Start PostgreSQL, Redis, and Memcached
2. Wait for database readiness
3. Run migrations automatically
4. Seed initial data (in development)
5. Start the API server on port 3000
6. Start the Vue frontend on port 5173
7. Start nginx reverse proxy on port 8080

**Access the application:**
- Frontend: http://localhost:5173
- API: http://localhost:3000
- Nginx (proxy): http://localhost:8080

## 📁 Project Structure

```
├── api/                          # Koa backend (JavaScript ESM)
│   ├── src/
│   │   ├── cache/               # Cache interface + Redis implementation
│   │   │   ├── interface.js     # ICache interface
│   │   │   ├── redis.js         # Redis cache with stampede protection
│   │   │   └── index.js         # Cache initialization & key builders
│   │   ├── db/
│   │   │   ├── pool.js          # Single shared PostgreSQL pool
│   │   │   ├── migrate.js       # Migration runner
│   │   │   ├── seed.js          # Database seeds
│   │   │   └── migrations/      # SQL migration files
│   │   ├── handlers/            # Route handlers
│   │   │   ├── products.js      # Products CRUD + caching
│   │   │   ├── tags.js          # Tags management
│   │   │   ├── users.js         # Users
│   │   │   └── orders.js        # Orders (1:M with users)
│   │   ├── middleware/
│   │   │   ├── errorHandler.js  # Centralized error handling
│   │   │   ├── requestId.js     # Request ID tracking
│   │   │   ├── logging.js       # Structured logging
│   │   │   └── validation.js    # Zod validation
│   │   ├── routes/
│   │   │   └── index.js         # API routes
│   │   ├── __tests__/           # Jest tests
│   │   ├── config.js            # Configuration
│   │   ├── logger.js            # Pino logger
│   │   └── server.js            # Server entry point
│   ├── package.json
│   └── Dockerfile
│
├── web/                          # Vue 3 frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProductList.vue  # Product list with CRUD
│   │   │   └── ProductDetail.vue # Product details + tag management
│   │   ├── App.vue
│   │   ├── main.js
│   │   └── api.js               # API client
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
│
├── docker-compose.yml            # Service orchestration
├── nginx.conf                    # Nginx reverse proxy config
├── .env.example                  # Environment variables template
└── README.md                     # This file
```

## 🗄️ Database Schema

The application implements:
- **1:M relationship**: Users → Orders
- **M:M relationship**: Products ↔ Tags (via product_tags join table)

### Tables

```sql
users (id, email, name, created_at, updated_at)
products (id, name, price_cents, created_at, updated_at)
tags (id, name)
product_tags (product_id, tag_id)  -- M:M join table
orders (id, user_id, status, created_at, updated_at)
order_items (id, order_id, product_id, qty, unit_price_cents)
```

All tables use UUID primary keys and timestamptz for timestamps.

## 🔧 Environment Variables

See `.env.example` for all available variables:

```bash
# PostgreSQL
POSTGRES_DB=appdb
POSTGRES_USER=appuser
POSTGRES_PASSWORD=apppass
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379

# API
API_PORT=3000
NODE_ENV=development
LOG_LEVEL=info
CACHE_TYPE=redis

# Frontend
WEB_PORT=5173
VITE_API_BASE_URL=http://localhost:3000
```

## 📡 API Endpoints

### Health

```bash
GET /api/health
# Returns postgres and cache connectivity status
curl http://localhost:3000/api/health
```

### Products (with caching)

```bash
# List products (cached for 5 minutes)
GET /api/products?limit=20&offset=0&sort=created_at_desc&name=laptop
curl "http://localhost:3000/api/products?limit=10&sort=price_asc"

# Get single product (cached for 10 minutes, stampede protected)
GET /api/products/:id
curl http://localhost:3000/api/products/{UUID}

# Create product (invalidates list cache)
POST /api/products
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name": "New Laptop", "price_cents": 89999}'

# Update product (invalidates item + tags cache)
PUT /api/products/:id
curl -X PUT http://localhost:3000/api/products/{UUID} \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name", "price_cents": 79999}'

# Delete product
DELETE /api/products/:id
curl -X DELETE http://localhost:3000/api/products/{UUID}
```

### Product Tags (M:M relationship, cached)

```bash
# Get product tags (cached for 5 minutes)
GET /api/products/:id/tags
curl http://localhost:3000/api/products/{UUID}/tags

# Attach tags (ignores duplicates, invalidates cache)
POST /api/products/:id/tags
curl -X POST http://localhost:3000/api/products/{UUID}/tags \
  -H "Content-Type: application/json" \
  -d '{"tagIds": ["tag-uuid-1", "tag-uuid-2"]}'

# Replace tags (transaction, invalidates cache)
PUT /api/products/:id/tags
curl -X PUT http://localhost:3000/api/products/{UUID}/tags \
  -H "Content-Type: application/json" \
  -d '{"tagIds": ["tag-uuid-3"]}'
```

### Tags

```bash
# List all tags
GET /api/tags
curl http://localhost:3000/api/tags

# Create tag
POST /api/tags
curl -X POST http://localhost:3000/api/tags \
  -H "Content-Type: application/json" \
  -d '{"name": "Electronics"}'
```

### Users

```bash
# List users
GET /api/users
curl http://localhost:3000/api/users

# Create user
POST /api/users
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "name": "John Doe"}'
```

### Orders (1:M relationship with users)

```bash
# Get user's orders (with totals and item counts)
GET /api/users/:userId/orders
curl http://localhost:3000/api/users/{UUID}/orders

# Create order (transaction, validates products, snapshots prices)
POST /api/users/:userId/orders
curl -X POST http://localhost:3000/api/users/{UUID}/orders \
  -H "Content-Type: application/json" \
  -d '{
    "status": "pending",
    "items": [
      {"product_id": "product-uuid", "qty": 2},
      {"product_id": "product-uuid-2", "qty": 1, "unit_price_cents": 5999}
    ]
  }'

# Get order details (includes items and product info)
GET /api/orders/:id
curl http://localhost:3000/api/orders/{UUID}
```

## 🗂️ Cache Strategy

### Implementation

- **Cache Type**: Redis (configurable via `CACHE_TYPE` env var)
- **Pattern**: Cache-aside (lazy loading)
- **Interface**: `ICache` in `api/src/cache/interface.js`

### Cache Keys (with versioning)

```
products:v1:list:limit={limit}:offset={offset}:sort={sort}:name={name}
products:v1:item:{id}
products:v1:tags:{id}
```

### TTLs

- Product lists: 5 minutes (300s)
- Product items: 10 minutes (600s)
- Product tags: 5 minutes (300s)

### Invalidation Strategy

**On product create/update/delete:**
1. Delete specific product item cache: `products:v1:item:{id}`
2. Delete product tags cache: `products:v1:tags:{id}`
3. List caches expire naturally via TTL (coarse invalidation)

**Trade-off**: List caches may show stale data for up to 5 minutes after mutations. For production, consider:
- Maintaining a set of active list cache keys for precise invalidation
- Using Redis SCAN to pattern-match and delete list keys
- Shorter TTLs for lists if staleness is problematic

### Stampede Protection

For `GET /api/products/:id`:
1. **Redis lock**: Acquire short-lived lock (`SET key NX EX 5`) before DB fetch
2. **In-process single-flight**: Map of productId → Promise to deduplicate concurrent requests in same process

If Redis lock fails, fallback to in-process deduplication.

## 🧪 Development

### Run locally without Docker

**API:**

```bash
cd api
npm install
# Set DATABASE_URL and REDIS_URL in .env
npm run migrate
npm run seed
npm run dev  # Uses --watch for auto-reload
```

**Frontend:**

```bash
cd web
npm install
# Set VITE_API_BASE_URL in .env
npm run dev
```

### Run tests

```bash
cd api
npm test
```

### Linting

```bash
cd api
npm run lint
npm run format
```

## 🏗️ Migrations & Seeds

Migrations run automatically on API startup via `docker-compose`.

**Manual migration/seed:**

```bash
# Inside api container
docker compose exec api npm run migrate
docker compose exec api npm run seed
```

## 🎯 Key Features

### Backend

✅ **Koa middleware pipeline**:
1. Error handler (catches all errors, returns JSON)
2. Request ID (sets `ctx.state.requestId`, adds `X-Request-Id` header)
3. Structured logging (logs request/response with duration)
4. Body parser
5. Validation (Zod schemas, returns 400 on validation error)

✅ **Single shared PostgreSQL pool** (`api/src/db/pool.js`)
- One Pool instance per process
- Helpers: `query(text, params)`, `withTransaction(fn)`
- Exponential backoff retry on startup

✅ **Transactions**:
- `withTransaction()` helper with automatic BEGIN/COMMIT/ROLLBACK
- Used in: order creation, tag replacement, tag attachment

✅ **Validation**:
- Zod schemas for params/query/body
- Consistent 400 error format
- Validated data attached to `ctx.state.validatedBody`

✅ **Caching**:
- Redis with cache-aside pattern
- Stampede protection via locks + in-process deduplication
- Versioned keys with TTL
- Health checks

### Frontend

✅ **Vue 3 Composition API** (`<script setup>`)
✅ **Product CRUD** with pagination, sorting, filtering
✅ **Tag management** (attach/replace tags for products)
✅ **Error handling** and loading states
✅ **Responsive design** with clean UI

## 🐳 Docker Details

### Services

- **postgres**: PostgreSQL 16 with health checks
- **redis**: Redis 7 with health checks
- **memcached**: Memcached 1.6 (available but not used by default)
- **api**: Koa backend with auto-restart in dev mode
- **web**: Vue frontend with Vite HMR
- **nginx**: Reverse proxy (optional)

### Startup Order

Docker Compose ensures:
1. Postgres/Redis start with health checks
2. API waits for healthy DB/cache (exponential backoff)
3. API runs migrations + seeds on startup
4. Web starts after API

### Development vs Production

Current setup is **development-oriented**:
- Volumes mounted for live reload
- Seeds run automatically
- Debug logging enabled

For production:
- Remove volume mounts
- Set `NODE_ENV=production`
- Disable seeds
- Use multi-stage Dockerfiles
- Add proper secrets management

## 📝 Notes

### Why JavaScript (not TypeScript)?

Per requirements, backend uses **plain JavaScript with ESM modules** to demonstrate mid-level Node.js patterns without type complexity.

### Why Single Pool?

One shared Pool instance per process is the recommended pattern:
- Connection pooling managed by `pg`
- No per-request Pool creation overhead
- Proper connection reuse and lifecycle management

### Cache Limitations

Current cache invalidation is **coarse for list endpoints** (TTL-based expiration). This is acceptable for many use cases but can be improved with:
- Maintaining active cache key sets
- Using Redis SCAN for pattern-based deletion
- Event-driven invalidation

### Testing

Minimal test coverage provided:
- Cache interface behavior
- Validation schemas

For production, add:
- Integration tests with test containers
- Route/handler tests with mocked dependencies
- E2E tests

## 🛠️ Troubleshooting

**Database connection fails:**
```bash
# Check logs
docker compose logs postgres
docker compose logs api

# Verify environment variables
docker compose exec api env | grep DATABASE
```

**Redis connection fails:**
```bash
docker compose logs redis
docker compose exec redis redis-cli ping
```

**Migrations not running:**
```bash
# Manually run migrations
docker compose exec api npm run migrate
```

**Port already in use:**
```bash
# Edit .env to change ports
API_PORT=3001
WEB_PORT=5174
```

## 📚 Technologies

- **Backend**: Koa 2, @koa/router, koa-bodyparser, pg, redis, zod, pino
- **Frontend**: Vue 3, Vue Router, Vite
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Infrastructure**: Docker, Docker Compose, nginx

## 📄 License

MIT

---

**Built with ❤️ using modern JavaScript and Vue 3**