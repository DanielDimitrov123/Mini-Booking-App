exports.up = async function (knex) {
  await knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.string("full_name", 150).notNullable();
    table.string("email", 255).notNullable().unique();
    table.string("password_hash", 255).notNullable();
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("treatments", (table) => {
    table.increments("id").primary();
    table.string("name", 100).notNullable().unique();
    table.integer("duration_minutes").notNullable();
    table.integer("price_pence").notNullable();
    table.boolean("active").notNullable().defaultTo(true);
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("bookings", (table) => {
    table.increments("id").primary();
    table.string("reference", 20).notNullable().unique();

    table
      .integer("user_id")
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");

    table
      .integer("treatment_id")
      .notNullable()
      .references("id")
      .inTable("treatments")
      .onDelete("RESTRICT");

    table.string("customer_name", 150).notNullable();
    table.string("customer_email", 255).notNullable();
    table.string("postcode", 20).notNullable();

    table.timestamp("starts_at", { useTz: true }).notNullable();
    table.timestamp("ends_at", { useTz: true }).notNullable();

    // Snapshot the price and duration so later treatment edits don't alter old bookings.
    table.integer("price_pence").notNullable();
    table.integer("duration_minutes").notNullable();

    table.string("status", 20).notNullable().defaultTo("booked");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index("starts_at");
    table.index("user_id");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("bookings");
  await knex.schema.dropTableIfExists("treatments");
  await knex.schema.dropTableIfExists("users");
};