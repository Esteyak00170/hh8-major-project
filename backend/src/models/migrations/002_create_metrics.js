/**
 * Migration: Create Metrics Table
 * 
 * Stores every metric snapshot from every server.
 * Uses JSON (text in SQLite) for the full payload,
 * with indexed columns for the most-queried values.
 */

exports.up = function(knex) {
  return knex.schema.createTable('metrics', (table) => {
    table.string('id').primary();
    table.string('server_id').notNullable().references('server_id').inTable('servers').onDelete('CASCADE');
    table.float('cpu_usage');
    table.float('memory_usage');
    table.float('disk_usage');
    table.text('full_metrics');        // JSON string
    table.timestamp('recorded_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['server_id', 'recorded_at']);
    table.index('recorded_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('metrics');
};
