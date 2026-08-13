/**
 * Confirmed by reading X-Shopify-Shop-Domain on a real Shopify test
 * notification (2026-08-12) — dovi-9909.myshopify.com is also connected in
 * Settings > Domains but is NOT what Shopify sends on webhook delivery.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`UPDATE clients SET shopify_shop_domain = 'f1zauf-q1.myshopify.com' WHERE slug = 'dovi';`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {
  pgm.sql(`UPDATE clients SET shopify_shop_domain = NULL WHERE slug = 'dovi';`);
};

module.exports = {
  up,
  down,
};
