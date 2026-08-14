import { pool } from "../db/pool";

/**
 * First cut at CLAUDE.md §6's reporting requirement (confirmation %,
 * no-shows, orders/day) — a console report, not an HTTP endpoint yet.
 * Optional `--client=<slug>` scopes to one tenant; without it, reports
 * across all clients. Run with `npm run report:metrics -- --client=dovi`.
 */
async function main() {
  const clientArg = process.argv.find((arg) => arg.startsWith("--client="));
  const clientSlug = clientArg?.split("=")[1];

  const clientFilter = clientSlug ? `WHERE c.slug = $1` : "";
  const params = clientSlug ? [clientSlug] : [];

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
