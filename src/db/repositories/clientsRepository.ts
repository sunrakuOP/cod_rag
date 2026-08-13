import { pool } from "../pool";

export interface Client {
  id: number;
  name: string;
  slug: string;
  retryCadenceMinutes: number[];
  active: boolean;
}

const SELECT_CLIENT_COLUMNS = `id, name, slug, retry_cadence_minutes, active`;

function mapClientRow(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    retryCadenceMinutes: row.retry_cadence_minutes,
    active: row.active,
  };
}

export async function findClientById(id: number): Promise<Client | null> {
  const result = await pool.query(
    `SELECT ${SELECT_CLIENT_COLUMNS} FROM clients WHERE id = $1 AND active = TRUE`,
    [id],
  );

  const row = result.rows[0];
  return row ? mapClientRow(row) : null;
}

export async function findClientBySlug(slug: string): Promise<Client | null> {
  const result = await pool.query(
    `SELECT ${SELECT_CLIENT_COLUMNS} FROM clients WHERE slug = $1 AND active = TRUE`,
    [slug],
  );

  const row = result.rows[0];
  return row ? mapClientRow(row) : null;
}

/**
 * Resolves a Shopify webhook to a tenant. The HMAC secret is per-app, not
 * per-store, so the shop domain from X-Shopify-Shop-Domain is the only
 * signal that tells us which client's order this is.
 */
export async function findClientByShopDomain(shopDomain: string): Promise<Client | null> {
  const result = await pool.query(
    `SELECT ${SELECT_CLIENT_COLUMNS} FROM clients WHERE shopify_shop_domain = $1 AND active = TRUE`,
    [shopDomain],
  );

  const row = result.rows[0];
  return row ? mapClientRow(row) : null;
}

/**
 * Resolves an inbound WhatsApp webhook to a tenant, from the phone_number_id
 * in value.metadata — the only identifier Meta includes on an inbound
 * message.
 */
export async function findClientByWhatsappPhoneNumberId(
  phoneNumberId: string,
): Promise<Client | null> {
  const result = await pool.query(
    `SELECT ${SELECT_CLIENT_COLUMNS} FROM clients WHERE whatsapp_phone_number_id = $1 AND active = TRUE`,
    [phoneNumberId],
  );

  const row = result.rows[0];
  return row ? mapClientRow(row) : null;
}
