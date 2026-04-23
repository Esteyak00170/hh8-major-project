/**
 * Knex Configuration — Database Migrations & Query Builder
 * 
 * SMART DATABASE SELECTION:
 * 
 * This config supports both PostgreSQL (production) and SQLite (development).
 * 
 * Why two databases?
 * - SQLite: Zero setup. Perfect for local development. Just works.
 * - PostgreSQL: Production-grade. Handles concurrent connections, large datasets.
 * 
 * Knex abstracts the differences — your services use the same query syntax
 * regardless of which database is running underneath. This is the beauty
 * of a query builder vs raw SQL.
 * 
 * The system auto-detects: if DB_HOST is set and reachable → use PostgreSQL.
 * Otherwise → fall back to SQLite.
 */

const path = require('path');
const config = require('./index');

// Determine which database to use
const usePostgres = config.db.host && config.db.host !== 'localhost-disabled';

let knexConfig;

if (usePostgres && config.env === 'production') {
  // Production: PostgreSQL
  knexConfig = {
    client: 'pg',
    connection: {
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password,
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: path.resolve(__dirname, '../models/migrations'),
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: path.resolve(__dirname, '../models/seeds'),
    },
  };
} else {
  // Development: SQLite (zero setup)
  knexConfig = {
    client: 'better-sqlite3',
    connection: {
      filename: path.resolve(__dirname, '../../data/aisd.sqlite'),
    },
    useNullAsDefault: true,  // SQLite requires this
    migrations: {
      directory: path.resolve(__dirname, '../models/migrations'),
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: path.resolve(__dirname, '../models/seeds'),
    },
  };
}

module.exports = knexConfig;
