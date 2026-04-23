/**
 * Migration: Create Servers Table
 * 
 * This is the registry of all monitored servers.
 * When an agent sends its first report, the server is auto-registered here.
 * 
 * Compatible with both PostgreSQL and SQLite.
 */

exports.up = function(knex) {
  return knex.schema.createTable('servers', (table) => {
    table.string('id').primary();              // UUID generated in code
    table.string('server_id').unique().notNullable();
    table.string('name').notNullable();
    table.string('hostname');
    table.string('ip_address');
    table.string('os_platform');
    table.string('os_distro');
    table.string('os_release');
    table.string('status').defaultTo('online');  // online, offline, warning, critical
    table.timestamp('last_seen_at').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('servers');
};
