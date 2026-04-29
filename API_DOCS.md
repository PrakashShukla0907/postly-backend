# Postly API Documentation

**Base API URL**: `https://postly-backend-production-8277.up.railway.app/api`

For protected endpoints, include the header: `Authorization: Bearer <your_access_token>`.

---

## 0. System & Health

### Health Check
**GET `https://postly-backend-production-8277.up.railway.app/api/health`**
- **Description**: Verify the server is running and check its environment.
- **Response**: `200 OK` - `{ "data": { "status": "ok", "environment": "...", "version": "1.0.0" }, ... }`

---

## 1. Authentication (`/auth`)

### Register
**POST `https://postly-backend-production-8277.up.railway.app/api/auth/register`**
- **Body**: `{ "email": "user@example.com", "password": "password123", "name": "Test User" }`
- **Response**: `201 Created` - `{ "user": { ... }, "tokens": { "access", "refresh" } }`

### Login
**POST `https://postly-backend-production-8277.up.railway.app/api/auth/login`**
- **Body**: `{ "email": "user@example.com", "password": "password123" }`
- **Response**: `200 OK` - `{ "user": { ... }, "tokens": { "access", "refresh" } }`

### Refresh Token
**POST `https://postly-backend-production-8277.up.railway.app/api/auth/refresh`**
- **Header**: `Authorization: Bearer <your_refresh_token>`
- **Response**: `200 OK` - `{ "access_token": "..." }`

### Logout
**POST `https://postly-backend-production-8277.up.railway.app/api/auth/logout`**
- **Header**: `Authorization: Bearer <your_access_token>`
- **Response**: `200 OK` - `{ "message": "Logged out successfully" }`

### Get Current User
**GET `https://postly-backend-production-8277.up.railway.app/api/auth/me`**
- **Response**: `200 OK` - `{ "user": { "id", "email", "name", ... } }`

---

## 2. User & Settings (`/user`)

### Get Profile
**GET `https://postly-backend-production-8277.up.railway.app/api/user/profile`**
- **Response**: `200 OK` - Profile details including default tone and language.

### Update Profile
**PUT `https://postly-backend-production-8277.up.railway.app/api/user/profile`**
- **Body**: `{ "name": "New Name", "default_tone": "professional", "default_language": "en" }` (All optional)
- **Response**: `200 OK` - Updated profile.

### Store AI Keys
**PUT `https://postly-backend-production-8277.up.railway.app/api/user/ai-keys`**
- **Body**: `{ "openai_key": "sk-...", "anthropic_key": "sk-ant-..." }`
- **Response**: `200 OK` - `{ "message": "Keys securely encrypted and stored" }`

### Connect Social Account
**POST `https://postly-backend-production-8277.up.railway.app/api/user/social-accounts`**
- **Body**: `{ "platform": "twitter", "access_token": "abc", "refresh_token": "def" }`
- **Response**: `201 Created` - `{ "id": "uuid", "platform": "twitter" }`

### List Social Accounts
**GET `https://postly-backend-production-8277.up.railway.app/api/user/social-accounts`**
- **Response**: `200 OK` - `[{ "id": "uuid", "platform": "twitter", "connected_at": "..." }]` (tokens are hidden)

### Disconnect Social Account
**DELETE `https://postly-backend-production-8277.up.railway.app/api/user/social-accounts/:id`**
- **Response**: `200 OK` - `{ "message": "Account disconnected" }`

---

## 3. Content Generation (`/content`)

### Generate Post Content
**POST `https://postly-backend-production-8277.up.railway.app/api/content/generate`**
- **Body**: 
  ```json
  {
    "idea": "Write a post about launching a new tech startup",
    "post_type": "announcement",
    "platforms": ["twitter", "linkedin"],
    "tone": "enthusiastic",
    "language": "en",
    "model": "openai" // or "anthropic"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "generated": {
      "twitter": { "content": "...", "char_count": 250, "hashtags": [] },
      "linkedin": { "content": "...", "char_count": 1000, "hashtags": [] }
    },
    "model_used": "gpt-4o",
    "tokens_used": 150
  }
  ```

---

## 4. Post Management (`/posts`)

### Publish Immediately
**POST `https://postly-backend-production-8277.up.railway.app/api/posts/publish`**
- **Body**: `{ "content": { "twitter": "Hello world" }, "platforms": ["twitter"] }`
- **Response**: `201 Created` - `{ "post_id": "uuid", "status": "processing" }`

### Schedule Post
**POST `https://postly-backend-production-8277.up.railway.app/api/posts/schedule`**
- **Body**: `{ "content": { "twitter": "Hello world" }, "platforms": ["twitter"], "scheduled_for": "2026-12-01T10:00:00Z" }`
- **Response**: `201 Created` - `{ "post_id": "uuid", "status": "scheduled" }`

### List Posts
**GET `https://postly-backend-production-8277.up.railway.app/api/posts`**
- **Query Params**: `?page=1&limit=10&status=published`
- **Response**: `200 OK` - Paginated list of posts and their platform delivery statuses.

### Get Post Details
**GET `https://postly-backend-production-8277.up.railway.app/api/posts/:id`**
- **Response**: `200 OK` - Detailed post view including individual platform attempts.

### Retry Failed Post
**POST `https://postly-backend-production-8277.up.railway.app/api/posts/:id/retry`**
- **Response**: `200 OK` - `{ "message": "Post re-queued for failed platforms" }`

### Cancel Scheduled Post
**DELETE `https://postly-backend-production-8277.up.railway.app/api/posts/:id`**
- **Response**: `200 OK` - `{ "message": "Scheduled post cancelled" }`

---

## 5. Dashboard (`/dashboard`)

### Get Stats
**GET `https://postly-backend-production-8277.up.railway.app/api/dashboard/stats`**
- **Response**: `200 OK` - `{ "total_posts": 10, "successful_posts": 8, "failed_posts": 2, "tokens_used": 1500 }`

---

## 6. Telegram Integration (`/telegram`)

### Get Status
**GET `https://postly-backend-production-8277.up.railway.app/api/telegram/status`**
- **Response**: `200 OK` - `{ "linked": true, "telegram_chat_id": "123456789" }`

### Link Telegram Account
**POST `https://postly-backend-production-8277.up.railway.app/api/telegram/link`**
- **Body**: `{ "telegram_chat_id": "123456789" }`
- **Response**: `200 OK` - `{ "message": "Telegram account linked successfully" }`

### Unlink Telegram Account
**DELETE `https://postly-backend-production-8277.up.railway.app/api/telegram/unlink`**
- **Response**: `200 OK` - `{ "message": "Telegram account unlinked" }`

### Webhook Endpoint
**POST `https://postly-backend-production-8277.up.railway.app/api/telegram/webhook`**
- **Description**: Endpoint used by Telegram to send bot updates.
- **Header**: `x-telegram-bot-api-secret-token: <your_secret>`
- **Response**: `200 OK`

---

## 7. Telegram Linking (Browser)

### Telegram Auth Page
**GET `https://postly-backend-production-8277.up.railway.app/auth/telegram?chat_id=<chat_id>`**
- **Description**: A temporary landing page to help users link their Telegram account by providing instructions for Postman.