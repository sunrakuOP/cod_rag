import { pool } from "../pool";

export interface Client {
  id: number;
  name: string;
  slug: string;
  retryCadenceMinutes: number[];
  active: boolean;
}

export async function findClientBySlug(slug: string): Promise<Client | null> {
  const result = await pool.query(
    `SELECT id, name, slug, retry_cadence_minutes, active
     FROM clients
     WHERE slug = $1 AND active = TRUE`,
    [slug],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    retryCadenceMinutes: row.retry_cadence_minutes,
    active: row.active,
  };
}
