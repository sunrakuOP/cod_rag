import { env } from "../../config/env";
import { logger } from "../../observability/logger";
import type { Client } from "../../db/repositories/clientsRepository";

/**
 * Text interpolated into a Markdown-formatted Telegram message needs
 * escaping — a customer-controlled field (name, address) containing
 * `[text](url)` would otherwise render as a clickable link in the operator's
 * chat. Same fix already applied in the sibling Dovi backend.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([_*`[\]])/g, "\\$1");
}

/**
 * Operator notifications are a convenience, never a dependency: a Telegram
 * outage or missing config must not affect order processing (CLAUDE.md
 * §4.6, "fallo seguro"). No-ops (logs only) when the bot token or the
 * client's chat id isn't configured, and never throws on a failed send.
 */
export async function notifyOperator(client: Client, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !client.telegramChatId) {
    return;
  }

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: client.telegramChatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error({ clientId: client.id, status: response.status, body }, "telegram notify failed");
    }
  } catch (err) {
    logger.error({ clientId: client.id, err }, "telegram notify network error");
  }
}
