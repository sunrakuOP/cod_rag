import { pool } from "../db/pool";

export interface MetricsReport {
  scope: { clientSlug: string | null };
  orders: { byStatus: Record<string, number>; total: number };
  confirmationRatePct: number | null;
  noShowRatePct: number | null;
  baselineNoShowRatePct: number | null;
  noShowDeltaPp: number | null;
  cost: {
    totalRecorded: number;
    perConfirmation: number | null;
    configuredPerTemplate: number | null;
  };
  messages: { byStatus: Record<string, number> };
  ordersPerDay: { day: string; count: number }[];
}

/**
 * Shared query logic behind both `npm run report:metrics` (CLI) and
 * `GET /api/metrics` (HTTP) — one source of truth for the SQL instead of
 * duplicating it per caller. Returns structured data; formatting/printing is
 * the caller's job.
 *
 * Baseline no-show rate and per-message cost are never inferred or
 * defaulted — see migration 1786671243376. Null means "operator hasn't
 * configured it," not zero.
 */
export async function getMetricsReport(clientSlug?: string): Promise<MetricsReport> {
  const clientFilter = clientSlug ? `WHERE c.slug = $1` : "";
  const params = clientSlug ? [clientSlug] : [];

  const clientConfig = clientSlug
    ? await pool.query(
        `SELECT baseline_no_show_rate, whatsapp_utility_cost_estimate
         FROM clients WHERE slug = $1`,
        [clientSlug],
      )
    : null;
  const baselineNoShowRate = clientConfig?.rows[0]?.baseline_no_show_rate ?? null;
  const utilityCostEstimate = clientConfig?.rows[0]?.whatsapp_utility_cost_estimate ?? null;

  const totalCostResult = await pool.query(
    `SELECT COALESCE(SUM(m.cost_estimate), 0)::numeric AS total_cost
     FROM messages m
     JOIN clients c ON c.id = m.client_id
     ${clientFilter}
     ${clientFilter ? "AND" : "WHERE"} m.direction = 'outbound' AND m.status IN ('sent', 'delivered')`,
    params,
  );
  const totalCost = Number(totalCostResult.rows[0].total_cost);

  const statusBreakdown = await pool.query(
    `SELECT o.status, COUNT(*)::int AS count
     FROM orders o
     JOIN clients c ON c.id = o.client_id
     ${clientFilter}
     GROUP BY o.status
     ORDER BY o.status`,
    params,
  );

  const messageBreakdown = await pool.query(
    `SELECT m.status, COUNT(*)::int AS count
     FROM messages m
     JOIN clients c ON c.id = m.client_id
     ${clientFilter}
     GROUP BY m.status
     ORDER BY m.status`,
    params,
  );

  const ordersPerDay = await pool.query(
    `SELECT o.created_at::date AS day, COUNT(*)::int AS count
     FROM orders o
     JOIN clients c ON c.id = o.client_id
     ${clientFilter}
     GROUP BY o.created_at::date
     ORDER BY day`,
    params,
  );

  const statusCounts = Object.fromEntries(
    statusBreakdown.rows.map((row) => [row.status, row.count]),
  );
  const totalOrders = statusBreakdown.rows.reduce((sum, row) => sum + row.count, 0);
  const needingConfirmation = totalOrders - (statusCounts.pending_confirmation ?? 0);
  const confirmedLike = (statusCounts.confirmed ?? 0) + (statusCounts.dispatched ?? 0);
  const confirmationRatePct = needingConfirmation > 0 ? (confirmedLike / needingConfirmation) * 100 : null;
  const noShowRatePct =
    needingConfirmation > 0 ? ((statusCounts.no_show ?? 0) / needingConfirmation) * 100 : null;
  const costPerConfirmation = confirmedLike > 0 ? totalCost / confirmedLike : null;

  const baselineNoShowRatePct = baselineNoShowRate === null ? null : Number(baselineNoShowRate);
  const noShowDeltaPp =
    baselineNoShowRatePct !== null && noShowRatePct !== null ? noShowRatePct - baselineNoShowRatePct : null;

  return {
    scope: { clientSlug: clientSlug ?? null },
    orders: { byStatus: statusCounts, total: totalOrders },
    confirmationRatePct,
    noShowRatePct,
    baselineNoShowRatePct,
    noShowDeltaPp,
    cost: {
      totalRecorded: totalCost,
      perConfirmation: costPerConfirmation,
      configuredPerTemplate: utilityCostEstimate === null ? null : Number(utilityCostEstimate),
    },
    messages: {
      byStatus: Object.fromEntries(messageBreakdown.rows.map((row) => [row.status, row.count])),
    },
    ordersPerDay: ordersPerDay.rows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      count: row.count,
    })),
  };
}
