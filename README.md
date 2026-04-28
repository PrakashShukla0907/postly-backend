# Postly - AI Content Publishing Engine 
**Live Base URL**: `https://postly-backend-production-8277.up.railway.app` 

Postly is a production-ready backend engine that enables users to publish content to multiple social platforms simultaneously through a conversational Telegram bot interface. 
---

## API Documentation & Endpoints

All REST API routes, schemas, and endpoint definitions are thoroughly documented in **[API_DOCS.md](./API_DOCS.md)**.

---

## Local Setup

You can spin up the entire architecture locally (including PostgreSQL and Redis) in just 3 steps.

### Prerequisites
- Node.js v18+
- Docker & Docker Compose

### 1. Clone & Setup
```bash
git clone https://github.com/yourusername/postly.git
cd postly
npm install
```

### 2. Configure Environment
Copy the example environment file and fill in your secrets (see Environment Variables section below):
```bash
cp .env.example .env
```

### 3. Boot Services & Start
This single sequence will spin up your databases via Docker, apply the Prisma schemas, and start the hot-reloading Express server.
```bash
docker-compose up -d
npx prisma migrate dev
npm run dev
```
The server will now be listening at `http://localhost:3000`.

---

## Environment Variables

You must configure the `.env` file for the application to function. A fully documented `.env.example` is provided in the root directory.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Docker sets this automatically). |
| `REDIS_URL` | Redis connection string (Docker sets this automatically). |
| `JWT_SECRET` | Secret key used to sign short-lived access tokens. |
| `JWT_REFRESH_SECRET`| Secret key used to sign 7-day refresh tokens. |
| `ENCRYPTION_KEY` | 64-character hex string used for AES-256 encryption of user API keys. |
| `TELEGRAM_BOT_TOKEN`| Token received from BotFather. |
| `TELEGRAM_WEBHOOK_URL`| The public `https://` endpoint Telegram will send updates to (leave blank for local polling). |
| `OPENAI_API_KEY` | Optional globally, but required if a user hasn't supplied their own key. |
| `ANTHROPIC_API_KEY` | Optional globally, but required if a user hasn't supplied their own key. |

---

## Telegram Bot Setup Instructions

To interface with the backend, you must create a Telegram Bot.

1. **Get your Token**:
  - Open Telegram and search for `@BotFather`.
  - Send `/newbot` and follow the prompts to name your bot.
  - BotFather will give you an HTTP API Token. Copy this and paste it as your `TELEGRAM_BOT_TOKEN` in your `.env` file.

2. **Configure Local Testing (Polling)**:
  - Ensure `TELEGRAM_WEBHOOK_URL` is completely empty in your `.env` file.
  - When you run `npm run dev`, the bot will automatically start in long-polling mode, making it instantly responsive on your local machine.

3. **Configure Production (Webhook)**:
  - Once deployed to Railway, set your `TELEGRAM_WEBHOOK_URL` environment variable to `https://<your-railway-domain>/api/telegram/webhook`.
  - The backend will automatically inform Telegram to switch from polling to sending HTTP POST requests to your live URL.

---

## Architecture & Design Decisions

Curious about how conversation state is managed in Redis, how partial failures are handled via BullMQ fanning, or why Prisma was chosen over traditional query builders?

 Please read **[ARCHITECTURE.md](./ARCHITECTURE.md)** for deep-dive diagrams and engineering breakdowns.
