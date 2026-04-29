// Postly Backend - Main Entry Point
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { createServer } from "http";

import logger from "./utils/logger.js";
import apiRouter from "./routes/index.js";
import { errorHandler } from "./middlewares/index.js";
import { startWorkers } from "./queue/workers.js";
import { startBot } from "./bot/index.js";

const app = express();

// ── Security & Performance ─────────────────────────────────────────────
app.use(helmet());
app.use(compression());

// CORS
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
 .split(",")
 .map((o) => o.trim());

app.use(
 cors({
 origin: (origin, cb) => {
 if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
 cb(new Error(`CORS blocked: ${origin}`));
 },
 credentials: true,
 })
);

// Rate limiting
app.use(
 rateLimit({
 windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"),
 max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
 standardHeaders: true,
 legacyHeaders: false,
 message: {
 data: null,
 meta: { timestamp: new Date().toISOString() },
 error: { code: "RATE_LIMITED", message: "Too many requests, please try again later." },
 },
 })
);

// ── Request Parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging (skip in test env)
if (process.env.NODE_ENV !== "test" && process.env.LOG_REQUESTS !== "false") {
 app.use(
 morgan("dev", {
 stream: { write: (msg) => logger.info(msg.trim()) },
 })
 );
}

// ── Health Check (no auth required) ───────────────────────────────────
app.get("/api/health", (req, res) => {
 res.json({
 data: {
 status: "ok",
 environment: process.env.NODE_ENV || "development",
 version: "1.0.0",
 },
 meta: { timestamp: new Date().toISOString() },
 error: null,
 });
});

// ── Temporary Frontend Placeholder for Telegram Linking ───────────
app.get("/auth/telegram", (req, res) => {
 const chatId = req.query.chat_id;
 const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
 res.send(`
 <html>
 <head><title>Postly — Link Telegram Account</title></head>
 <body style="font-family: sans-serif; padding: 40px; text-align: center; background: #f5f5f5;">
 <h2>🔗 Link Your Telegram Account</h2>
 <p>Your Telegram Chat ID: <strong>${chatId}</strong></p>
 <p>Step 1 — Register or Login via Postman to get your Bearer token:</p>
 <pre style="background: #222; color: #0f0; padding: 12px; display: inline-block; text-align: left; border-radius: 6px;">
POST ${baseUrl}/api/auth/login
Content-Type: application/json

{ "email": "you@email.com", "password": "yourpassword" }</pre>
 <p>Step 2 — Link your Telegram account using the token from Step 1:</p>
 <pre style="background: #222; color: #0f0; padding: 12px; display: inline-block; text-align: left; border-radius: 6px;">
POST ${baseUrl}/api/telegram/link
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{ "telegram_chat_id": "${chatId}" }</pre>
 <p>After linking, go back to Telegram and send <strong>/start</strong></p>
 </body>
 </html>
 `);
});


// ── API Routes ─────────────────────────────────────────────────────────
app.use("/api", apiRouter);

// ── 404 Handler ────────────────────────────────────────────────────────
app.use((req, res) => {
 res.status(404).json({
 data: null,
 meta: { timestamp: new Date().toISOString() },
 error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` },
 });
});

// ── Global Error Handler ───────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3000");
const server = createServer(app);

if (process.env.NODE_ENV !== "test") {
 server.listen(PORT, "0.0.0.0", () => {
 logger.info(` Postly server running on port ${PORT}`);
 logger.info(` Health check: http://0.0.0.0:${PORT}/api/health`);
 logger.info(` Environment: ${process.env.NODE_ENV || "development"}`);

 // Start queue workers (no-op if Redis unavailable)
 try { startWorkers(); } catch (e) { logger.error(`Workers failed: ${e.message}`); }

 // Start Telegram bot (no-op if token not set)
 if (process.env.TELEGRAM_BOT_TOKEN) {
 startBot().catch((e) => logger.error(`Bot init failed: ${e.message}`));
 }
 });
}

// ── Graceful Shutdown ──────────────────────────────────────────────────
const shutdown = (signal) => {
 logger.info(`${signal} received — shutting down gracefully`);
 server.close(() => {
 logger.info("HTTP server closed");
 process.exit(0);
 });
 setTimeout(() => process.exit(1), 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason, promise) => {
 logger.error(`Unhandled rejection: ${reason}`);
 // Prevent Node.js 15+ from terminating on unhandled rejections
});
process.on("uncaughtException", (err) => {
 logger.error(`Uncaught exception: ${err.message}`);
});

export default app;
