# System Architecture & Design

This document details the architectural decisions, database schemas, and engineering trade-offs made while building the Postly engine.

---

## Architecture Overview & Data Flow Diagram

Postly operates on a layered micro-service-like architecture within a monolith, strictly separating concerns between the presentation layer (Telegram/API), the business logic (Services), and asynchronous background workers (BullMQ).

```text
User (Telegram)
   ↓
[Telegram Bot API]
   ↓
(Webhook / Polling)
   ↓
+-------------------------------------------------------+
| POSTLY EXPRESS SERVER                |
|                            |
| 1. Bot Router (Handles /start, /post)        |
| 2. Redis Session Middleware (Checks auth/state)   |
| 3. ContentService (Calls OpenAI / Anthropic APIs)  |
| 4. PublishService (Fans out jobs to queues)     |
+-------------------------------------------------------+
   ↓                   ↓
[PostgreSQL DB]            [Redis Queue]
(Stores Users, encrypted        (Stores Jobs & Bot State)
 keys, and Post status)           ↓
                    +------------------+
                    | BullMQ Workers  |
                    | - Twitter Queue |
                    | - LinkedIn Queue |
                    | - Threads Queue |
                    +------------------+
                        ↓
                   [External Social APIs]
```

---

## How a Post Flows (The Lifecycle)

1. **Telegram Trigger**: The user sends `/post` to the bot.
2. **State Management**: The bot asks for the platform and topic. Each step is temporarily saved in Redis.
3. **AI Generation**: Once the prompt is complete, `ContentService` decrypts the user's AI keys (AES-256) from PostgreSQL, selects the chosen model (GPT-4o or Claude), and requests platform-optimized content.
4. **Queue Fanning**: `PublishService` creates a master `Post` record in the database. Instead of one massive job, it creates **independent BullMQ jobs** for each requested platform (e.g., `twitter-queue`, `linkedin-queue`) and corresponding `platform_posts` rows.
5. **Worker Execution**: Background workers pick up the jobs, execute the actual HTTP calls to the external Social APIs, and update the database row to `published` or `failed`.

---

## Redis Conversation State Management

The `grammY` bot framework manages multi-step conversations statelessly. When a user begins the post-creation flow, their "session" (current step, selected platforms, generated content) is injected into a custom Redis-backed session store.
- **TTL Constraint**: Sessions have a strict 30-minute Time-To-Live (TTL). If a user walks away halfway through creating a post, Redis automatically wipes the incomplete state to prevent memory leaks.

---

## Handling Partial Failures

Publishing to multiple external APIs is highly volatile due to rate limits and network latency. By **fanning out** jobs (creating one BullMQ job per platform), we achieve perfect isolation. - If Twitter's API goes down, the `twitter-queue` job fails and enters our custom exponential backoff retry loop (`1s -> 5s -> 25s`).
- Meanwhile, the `linkedin-queue` job executes completely unaffected. - The user's dashboard will reflect Twitter as `pending` or `failed` and LinkedIn as `published`.

---

## Schema Design & Indexing Strategy

The PostgreSQL database is managed via Prisma.

### Core Tables
- `users`: Identity and hashed passwords.
- `social_accounts` & `ai_keys`: Encrypted OAuth tokens and API keys.
- `posts` (1) to `platform_posts` (Many): This relationship allows us to track the exact lifecycle of a single prompt across multiple platforms independently.

### Indexing Strategy
To ensure the dashboard API remains highly performant as users generate thousands of posts:
- `INDEX on platform_posts(post_id)`: Speeds up JOINs when retrieving the full status of a single post.
- `INDEX on platform_posts(status)`: Enables fast filtering for "show me all failed posts".
- `UNIQUE INDEX on telegram_chat_mappings(telegram_chat_id)`: Provides O(1) lookups to instantly authenticate incoming Telegram webhook payloads.

---

## Design Decisions & Trade-offs

1. **Why PostgreSQL + Prisma?**
  - *Decision*: Chose a relational DB over MongoDB.
  - *Trade-off*: Slower initial prototyping speed, but absolute data integrity for critical relational data (like tracking which child-post belongs to which parent-post). Prisma provides end-to-end type safety which prevents runtime null errors in the workers.

2. **Why BullMQ over AWS SQS?**
  - *Decision*: Used BullMQ (Redis) for job queuing instead of a managed cloud service.
  - *Trade-off*: We have to host and monitor Redis ourselves, but we gain incredible speed, local testability, and built-in exponential backoff logic without paying for AWS requests.

3. **Military-Grade Encryption**
  - *Decision*: User API keys are symmetrically encrypted (AES-256-GCM) in the database.
  - *Trade-off*: Adds slight CPU overhead and complexity to the service layer, but protects user data if the database is compromised.

---

## Known Issues & Limitations

1. **OAuth Redirects**: Currently, social accounts are linked by manually POSTing tokens via Postman. A full Next.js/React frontend is required to handle the actual OAuth 2.0 callback redirects from Twitter/LinkedIn.
2. **Media Uploads**: The AI generation and queue systems only support text-based posts. Handling image/video binary streams would require implementing AWS S3 for temporary storage before queuing.
3. **Bot Scaling**: The Telegram bot currently runs in the same Express process as the API. Under massive load, the bot webhook listener should be decoupled into its own microservice to prevent heavy API requests from delaying bot responses.
