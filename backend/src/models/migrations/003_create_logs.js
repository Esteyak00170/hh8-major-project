/**
 * Migration: Create Logs Table
 */

exports.up = function(knex) {
  return knex.schema.createTable('logs', (table) => {
    table.string('id').primary();
    table.string('server_id').notNullable().references('server_id').inTable('servers').onDelete('CASCADE');
    table.string('source').notNullable();
    table.string('severity').defaultTo('info');  // debug, info, warning, error, critical
    table.text('message').notNullable();
    table.text('metadata');                       // JSON string
    table.timestamp('logged_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['server_id', 'logged_at']);
    table.index('severity');
    table.index('logged_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('logs');
};
