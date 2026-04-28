# Postly API Documentation

All API requests must be prefixed with `/api`.
For protected endpoints, include the header: `Authorization: Bearer <your_access_token>`.

---

## 1. Authentication (`/api/auth`)

### Register
**POST `/api/auth/register`**
- **Body**: `{ "email": "user@example.com", "password": "password123", "name": "Test User" }`
- **Response**: `201 Created` - `{ "user": { ... }, "tokens": { "access", "refresh" } }`

### Login
**POST `/api/auth/login`**
- **Body**: `{ "email": "user@example.com", "password": "password123" }`
- **Response**: `200 OK` - `{ "user": { ... }, "tokens": { "access", "refresh" } }`

### Refresh Token
**POST `/api/auth/refresh`**
- **Header**: `Authorization: Bearer <your_refresh_token>`
- **Response**: `200 OK` - `{ "access_token": "..." }`

### Get Current User
**GET `/api/auth/me`**
- **Response**: `200 OK` - `{ "user": { "id", "email", "name", ... } }`

---

## 2. User & Settings (`/api/user`)

### Get Profile
**GET `/api/user/profile`**
- **Response**: `200 OK` - Profile details including default tone and language.

### Update Profile
**PUT `/api/user/profile`**
- **Body**: `{ "name": "New Name", "default_tone": "professional", "default_language": "en" }` (All optional)
- **Response**: `200 OK` - Updated profile.

### Store AI Keys
**PUT `/api/user/ai-keys`**
- **Body**: `{ "openai_key": "sk-...", "anthropic_key": "sk-ant-..." }`
- **Response**: `200 OK` - `{ "message": "Keys securely encrypted and stored" }`

### Connect Social Account
**POST `/api/user/social-accounts`**
- **Body**: `{ "platform": "twitter", "access_token": "abc", "refresh_token": "def" }`
- **Response**: `201 Created` - `{ "id": "uuid", "platform": "twitter" }`

### List Social Accounts
**GET `/api/user/social-accounts`**
- **Response**: `200 OK` - `[{ "id": "uuid", "platform": "twitter", "connected_at": "..." }]` (tokens are hidden)

### Disconnect Social Account
**DELETE `/api/user/social-accounts/:id`**
- **Response**: `200 OK` - `{ "message": "Account disconnected" }`

---

## 3. Content Generation (`/api/content`)

### Generate Post Content
**POST `/api/content/generate`**
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

## 4. Post Management (`/api/posts`)

### Publish Immediately
**POST `/api/posts/publish`**
- **Body**: `{ "content": { "twitter": "Hello world" }, "platforms": ["twitter"] }`
- **Response**: `201 Created` - `{ "post_id": "uuid", "status": "processing" }`

### Schedule Post
**POST `/api/posts/schedule`**
- **Body**: `{ "content": { "twitter": "Hello world" }, "platforms": ["twitter"], "scheduled_for": "2026-12-01T10:00:00Z" }`
- **Response**: `201 Created` - `{ "post_id": "uuid", "status": "scheduled" }`

### List Posts
**GET `/api/posts`**
- **Query Params**: `?page=1&limit=10&status=published`
- **Response**: `200 OK` - Paginated list of posts and their platform delivery statuses.

### Get Post Details
**GET `/api/posts/:id`**
- **Response**: `200 OK` - Detailed post view including individual platform attempts.

### Retry Failed Post
**POST `/api/posts/:id/retry`**
- **Response**: `200 OK` - `{ "message": "Post re-queued for failed platforms" }`

### Cancel Scheduled Post
**DELETE `/api/posts/:id`**
- **Response**: `200 OK` - `{ "message": "Scheduled post cancelled" }`

---

## 5. Dashboard (`/api/dashboard`)

### Get Stats
**GET `/api/dashboard/stats`**
- **Response**: `200 OK` - `{ "total_posts": 10, "successful_posts": 8, "failed_posts": 2, "tokens_used": 1500 }`

---

## 6. Telegram Integration (`/api/telegram`)

### Get Status
**GET `/api/telegram/status`**
- **Response**: `200 OK` - `{ "linked": true, "telegram_username": "testuser" }`

### Link Telegram Account
**POST `/api/telegram/link`**
- **Body**: `{ "telegram_chat_id": "123456789" }`
- **Response**: `200 OK` - `{ "message": "Telegram account linked successfully" }`

### Unlink Telegram Account
**DELETE `/api/telegram/unlink`**
- **Response**: `200 OK` - `{ "message": "Telegram account unlinked" }`