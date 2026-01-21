import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from './pool.js';
import { logger } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations() {
  const result = await query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map((row) => row.name);
}

async function executeMigration(name, sql) {
  logger.info({ migration: name }, 'Executing migration');
  await query('BEGIN');
  try {
    await query(sql);
    await query('INSERT INTO migrations (name) VALUES ($1)', [name]);
    await query('COMMIT');
    logger.info({ migration: name }, 'Migration executed successfully');
  } catch (error) {
    await query('ROLLBACK');
    logger.error({ migration: name, error }, 'Migration failed');
    throw error;
  }
}

async function runMigrations() {
  await createMigrationsTable();
  const executed = await getExecutedMigrations();

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = await fs.readdir(migrationsDir);
  const migrationFiles = files.filter((f) => f.endsWith('.sql')).sort();

  for (const file of migrationFiles) {
    const name = file.replace('.sql', '');
    if (executed.includes(name)) {
      logger.debug({ migration: name }, 'Migration already executed');
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = await fs.readFile(filePath, 'utf-8');
    await executeMigration(name, sql);
  }

  logger.info('All migrations completed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      logger.info('Migration process complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Migration process failed');
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

export { runMigrations };
