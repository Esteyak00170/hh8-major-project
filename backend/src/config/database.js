/**
 * Database Connection (Singleton)
 * 
 * Creates a single Knex instance that's reused across the entire app.
 * This is important because each Knex instance manages a connection pool.
 * Multiple instances = multiple pools = wasted database connections.
 */

const knex = require('knex');
const knexConfig = require('./knexfile');

const db = knex(knexConfig);

module.exports = db;
