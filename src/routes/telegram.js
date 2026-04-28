// Telegram routes: /api/telegram/*
// - POST /api/telegram/webhook   — receive updates in webhook mode
// - POST /api/telegram/link      — link a Telegram chat ID to a user account
// - DELETE /api/telegram/unlink  — unlink a Telegram chat ID
import { Router } from "express";
import { authenticate } from "../middlewares/index.js";
import prisma from "../database/index.js";
import { successResponse, errorResponse } from "../utils/response.js";
import logger from "../utils/logger.js";

const router = Router();

// POST /api/telegram/webhook — receives Telegram updates (webhook mode)
// This endpoint must be whitelisted in CORS (Telegram IPs) and is token-validated
router.post("/webhook", async (req, res) => {
  const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (expectedSecret && secretHeader !== expectedSecret) {
    return res.status(403).json(errorResponse("FORBIDDEN", "Invalid webhook secret"));
  }

  // The bot instance processes the update
  try {
    // Dynamic import to avoid loading bot if token not set
    const { createBot } = await import("../bot/index.js");
    const bot = createBot();
    if (bot) {
      await bot.handleUpdate(req.body);
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error(`Webhook processing error: ${err.message}`);
    res.status(200).json({ ok: true }); // Always return 200 to Telegram
  }
});

// POST /api/telegram/link — links a Telegram chat ID to the authenticated user
// Body: { telegram_chat_id: "123456789" }
router.post("/link", authenticate, async (req, res, next) => {
  try {
    const { telegram_chat_id } = req.body;
    if (!telegram_chat_id) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "telegram_chat_id is required"));
    }

    const userId = req.user.sub;

    // Check if this Telegram chat is already linked to another user
    const existing = await prisma.telegramChatMapping.findUnique({
      where: { telegramChatId: String(telegram_chat_id) },
    });

    if (existing && existing.userId !== userId) {
      return res.status(409).json(
        errorResponse("CONFLICT", "This Telegram account is already linked to another user")
      );
    }

    const mapping = await prisma.telegramChatMapping.upsert({
      where: { telegramChatId: String(telegram_chat_id) },
      update: { userId },
      create: { userId, telegramChatId: String(telegram_chat_id) },
      select: { id: true, telegramChatId: true, connectedAt: true },
    });

    res.json(successResponse({ mapping, message: "Telegram account linked successfully" }));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/telegram/unlink — removes the Telegram linking for the authenticated user
router.delete("/unlink", authenticate, async (req, res, next) => {
  try {
    const userId = req.user.sub;

    await prisma.telegramChatMapping.deleteMany({
      where: { userId },
    });

    res.json(successResponse({ message: "Telegram account unlinked" }));
  } catch (err) {
    next(err);
  }
});

// GET /api/telegram/status — check if user has a linked Telegram account
router.get("/status", authenticate, async (req, res, next) => {
  try {
    const userId = req.user.sub;

    const mapping = await prisma.telegramChatMapping.findFirst({
      where: { userId },
      select: { telegramChatId: true, connectedAt: true },
    });

    res.json(
      successResponse({
        linked: !!mapping,
        telegram_chat_id: mapping?.telegramChatId ?? null,
        connected_at: mapping?.connectedAt ?? null,
      })
    );
  } catch (err) {
    next(err);
  }
});

export default router;
