/**
 * Migration: Create Users Table
 *
 * Stores dashboard admin accounts.
 *
 * SECURITY NOTES:
 * - Passwords are NEVER stored as plain text — only bcrypt hashes
 * - bcrypt is a slow hashing algorithm by design (makes brute-force expensive)
 * - refresh_token stores a hashed token for session renewal
 * - failed_login_attempts + locked_until implement account lockout
 *   (blocks attacker after N failed attempts — prevents credential stuffing)
 */

exports.up = function(knex) {
  return knex.schema.createTable('users', (table) => {
    table.string('id').primary();
    table.string('email').unique().notNullable();
    table.string('name').notNullable();
    table.string('password_hash').notNullable();
    table.string('role').defaultTo('viewer');        // viewer, admin, superadmin
    table.string('refresh_token');                    // Hashed refresh token
    table.integer('failed_login_attempts').defaultTo(0);
    table.timestamp('locked_until');
    table.timestamp('last_login_at');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('email');
    table.index('role');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users');
};
