/**
 * Migration: Create Website Checks Table
 */

exports.up = function(knex) {
  return knex.schema.createTable('website_checks', (table) => {
    table.string('id').primary();
    table.string('url').notNullable();
    table.string('name');
    table.boolean('is_up').defaultTo(true);
    table.integer('status_code');
    table.float('response_time_ms');
    table.text('error_message');
    table.timestamp('ssl_expiry');
    table.boolean('ssl_valid').defaultTo(true);
    table.text('headers');                // JSON string
    table.timestamp('checked_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['url', 'checked_at']);
    table.index('checked_at');
    table.index('is_up');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('website_checks');
};
