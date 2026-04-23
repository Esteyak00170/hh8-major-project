/**
 * Migration: Create Alerts Table
 */

exports.up = function(knex) {
  return knex.schema.createTable('alerts', (table) => {
    table.string('id').primary();
    table.string('severity').notNullable().defaultTo('info');   // info, warning, critical
    table.string('type').notNullable();                          // cpu_spike, brute_force, etc.
    table.string('title').notNullable();
    table.text('message').notNullable();
    table.string('source');
    table.string('server_id').references('server_id').inTable('servers').onDelete('SET NULL');
    table.string('website_url');
    table.text('context');                // JSON string
    table.string('status').defaultTo('active');  // active, acknowledged, resolved
    table.string('acknowledged_by');
    table.timestamp('acknowledged_at');
    table.timestamp('resolved_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('status');
    table.index('severity');
    table.index('server_id');
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('alerts');
};
