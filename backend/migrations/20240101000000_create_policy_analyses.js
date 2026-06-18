// backend/migrations/YYYYMMDDHHMMSS_create_policy_analyses.js
// Run: npx knex migrate:latest

exports.up = function (knex) {
  return knex.schema.createTable("policy_analyses", (t) => {
    t.increments("id").primary();
    t.integer("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("file_name").notNullable();
    t.string("policy_holder");
    t.string("policy_number");
    t.string("plan_name");
    t.string("policy_type");
    t.string("policy_period");
    t.string("zone");
    t.string("pre_existing_diseases");
    t.jsonb("insured_members").defaultTo("[]");
    t.jsonb("nominee").defaultTo("{}");
    t.jsonb("premium").defaultTo("{}");
    t.decimal("tax_benefit", 14, 2).defaultTo(0);
    t.decimal("total_effective_coverage", 14, 2).defaultTo(0);
    t.decimal("bonus_accumulated", 14, 2).defaultTo(0);
    t.string("bonus_type");
    t.jsonb("coverage_projection").defaultTo("[]");
    t.jsonb("key_benefits").defaultTo("[]");
    t.jsonb("waiting_periods").defaultTo("[]");
    t.text("zone_rule");
    t.jsonb("addons").defaultTo("[]");
    t.text("premium_waiver");
    // TTL: auto-delete after 24 hours (set by a cron or just checked on read)
    t.timestamp("expires_at").notNullable();
    t.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("policy_analyses");
};
