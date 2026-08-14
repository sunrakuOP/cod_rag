import { pool } from "../db/pool";

/**
 * CLAUDE.md §6's reporting requirement (confirmation %, no-shows, orders/day,
 * cost per confirmation) — a console report, not an HTTP endpoint yet.
 * Optional `--client=<slug>` scopes to one tenant; without it, reports
 * across all clients. Run with `npm run report:metrics -- --client=dovi`.
 *
 * Baseline no-show rate is never inferred or defaulted — it comes from
 * clients.baseline_no_show_rate, set manually by the operator (see migration
 * 1786671243376). Only shown with --client: it's a per-tenant estimate, no
 * meaningful aggregate across clients. Cost per confirmation works in both
 * scopes — it sums whatever cost_estimate was actually recorded per message
 * at send time (0 unless the operator had configured
 * clients.whatsapp_utility_cost_estimate before that message was sent).
 */
async function main() {
  const clientArg = process.argv.find((arg) => arg.startsWith("--client="));
  const clientSlug = clientArg?.split("=")[1];

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
  const confirmationRate = needingConfirmation > 0 ? (confirmedLike / needingConfirmation) * 100 : null;
  const noShowRate =
    needingConfirmation > 0 ? ((statusCounts.no_show ?? 0) / needingConfirmation) * 100 : null;
  const costPerConfirmation = confirmedLike > 0 ? totalCost / confirmedLike : null;

  console.log(`\n=== Reporte de métricas${clientSlug ? ` — cliente: ${clientSlug}` : " — todos los clientes"} ===\n`);

  console.log("Pedidos por estado:");
  for (const row of statusBreakdown.rows) {
    console.log(`  ${row.status}: ${row.count}`);
  }
  console.log(`  TOTAL: ${totalOrders}`);

  console.log(
    `\nTasa de confirmación (confirmed+dispatched / ya-procesados): ${
      confirmationRate === null ? "sin datos" : `${confirmationRate.toFixed(1)}%`
    }`,
  );

  console.log(
    `Tasa de no-show (no_show / ya-procesados): ${
      noShowRate === null ? "sin datos" : `${noShowRate.toFixed(1)}%`
    }`,
  );

  if (baselineNoShowRate !== null && noShowRate !== null) {
    const delta = noShowRate - Number(baselineNoShowRate);
    const direction = delta <= 0 ? "mejora" : "empeora";
    console.log(
      `  Línea base configurada: ${Number(baselineNoShowRate).toFixed(1)}% → delta: ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pp (${direction})`,
    );
  } else if (clientSlug) {
    console.log("  Línea base: sin configurar (clients.baseline_no_show_rate)");
  }

  console.log(
    `\nCosto por confirmación: ${
      costPerConfirmation === null ? "sin datos" : `$${costPerConfirmation.toFixed(4)} (costo total registrado: $${totalCost.toFixed(2)})`
    }`,
  );
  if (clientSlug) {
    console.log(
      `  Costo configurado por plantilla: ${
        utilityCostEstimate === null ? "sin configurar (clients.whatsapp_utility_cost_estimate)" : `$${Number(utilityCostEstimate).toFixed(4)}`
      }`,
    );
  }

  console.log("\nMensajes por estado:");
  for (const row of messageBreakdown.rows) {
    console.log(`  ${row.status}: ${row.count}`);
  }

  console.log("\nPedidos por día:");
  for (const row of ordersPerDay.rows) {
    console.log(`  ${row.day.toISOString().slice(0, 10)}: ${row.count}`);
  }

  console.log("");
  await pool.end();
}

main().catch((err) => {
  console.error("Error generando el reporte:", err);
  process.exit(1);
});
