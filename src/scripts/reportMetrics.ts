import { pool } from "../db/pool";
import { getMetricsReport } from "../observability/metricsReport";

/**
 * CLAUDE.md §6's reporting requirement (confirmation %, no-shows, orders/day,
 * cost per confirmation), printed to console. Query logic lives in
 * getMetricsReport (src/observability/metricsReport.ts), shared with
 * GET /api/metrics — this file only formats. Optional `--client=<slug>`
 * scopes to one tenant; without it, reports across all clients.
 * Run with `npm run report:metrics -- --client=dovi`.
 */
async function main() {
  const clientArg = process.argv.find((arg) => arg.startsWith("--client="));
  const clientSlug = clientArg?.split("=")[1];

  const report = await getMetricsReport(clientSlug);

  console.log(`\n=== Reporte de métricas${clientSlug ? ` — cliente: ${clientSlug}` : " — todos los clientes"} ===\n`);

  console.log("Pedidos por estado:");
  for (const [status, count] of Object.entries(report.orders.byStatus)) {
    console.log(`  ${status}: ${count}`);
  }
  console.log(`  TOTAL: ${report.orders.total}`);

  console.log(
    `\nTasa de confirmación (confirmed+dispatched / ya-procesados): ${
      report.confirmationRatePct === null ? "sin datos" : `${report.confirmationRatePct.toFixed(1)}%`
    }`,
  );

  console.log(
    `Tasa de no-show (no_show / ya-procesados): ${
      report.noShowRatePct === null ? "sin datos" : `${report.noShowRatePct.toFixed(1)}%`
    }`,
  );

  if (report.baselineNoShowRatePct !== null && report.noShowDeltaPp !== null) {
    const direction = report.noShowDeltaPp <= 0 ? "mejora" : "empeora";
    console.log(
      `  Línea base configurada: ${report.baselineNoShowRatePct.toFixed(1)}% → delta: ${
        report.noShowDeltaPp >= 0 ? "+" : ""
      }${report.noShowDeltaPp.toFixed(1)} pp (${direction})`,
    );
  } else if (clientSlug) {
    console.log("  Línea base: sin configurar (clients.baseline_no_show_rate)");
  }

  console.log(
    `\nCosto por confirmación: ${
      report.cost.perConfirmation === null
        ? "sin datos"
        : `$${report.cost.perConfirmation.toFixed(4)} (costo total registrado: $${report.cost.totalRecorded.toFixed(2)})`
    }`,
  );
  if (clientSlug) {
    console.log(
      `  Costo configurado por plantilla: ${
        report.cost.configuredPerTemplate === null
          ? "sin configurar (clients.whatsapp_utility_cost_estimate)"
          : `$${report.cost.configuredPerTemplate.toFixed(4)}`
      }`,
    );
  }

  console.log("\nMensajes por estado:");
  for (const [status, count] of Object.entries(report.messages.byStatus)) {
    console.log(`  ${status}: ${count}`);
  }

  console.log("\nPedidos por día:");
  for (const { day, count } of report.ordersPerDay) {
    console.log(`  ${day}: ${count}`);
  }

  console.log("");
  await pool.end();
}

main().catch((err) => {
  console.error("Error generando el reporte:", err);
  process.exit(1);
});
