# ⛏ GoldMine VK Bot

Smart VK group bot + admin panel for the **GoldMine** Minecraft/gaming community.

## 🚀 Features

- **VK Bot** — long-polling bot with command handling and moderation
- **Auto Content Pipeline** — search YouTube, download via yt-dlp, add outro, upload to VK, schedule posts
- **Anti-Spam & Moderation** — flood detection, profanity filter, ad/link filter, raid quarantine mode, risk scoring
- **Role System** — Banned / User / Trusted / Moderator / Admin / Owner
- **Minecraft Status** — live server ping with caching
- **Scheduler** — cron-based posting with quiet hours and daily post limits
- **Duplicate Detection** — YouTube ID check, SHA-256 file hash, perceptual hash (pHash)
- **Admin Panel** — dark-themed SPA with dashboard, queue, schedule, moderation, settings, logs
- **SQLite Database** — WAL mode, full persistence of tasks, events, roles, settings
- **In-Memory Queue** — persistent via SQLite, no Redis required

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 + TypeScript 5 |
| VK API | vk-io 4.x |
| Web API | Express.js 4 |
| Database | better-sqlite3 (SQLite WAL) |
| Queue | In-memory + SQLite persistence |
| Logging | Winston (file + console) |
| Auth | bcrypt + express-session |
| Scheduler | node-cron |
| Video | fluent-ffmpeg + @ffmpeg-installer/ffmpeg |
| Duplicate Check | sharp (pHash) + SHA-256 |
| Minecraft Ping | minecraft-server-util |
| HTTP Client | axios |
| Validation | zod |
| Frontend | Vanilla JS SPA |

## 📁 Project Structure

```
goldmine-vk-bot/
├── src/
│   ├── index.ts                    # Entry point
│   ├── logger/index.ts             # Winston loggers
│   ├── db/index.ts                 # SQLite init & migrations
│   ├── config/settings.ts          # Config + env parsing
│   ├── queue/queue.ts              # In-memory task queue
│   ├── bot/
│   │   ├── index.ts                # VK bot setup
│   │   └── handlers/
│   │       ├── commands.ts         # Bot commands (/status, /queue, etc.)
│   │       └── moderation.ts       # Auto-moderation handler
│   ├── modules/
│   │   ├── content/
│   │   │   ├── youtube.ts          # YouTube search + yt-dlp download
│   │   │   ├── video-processor.ts  # ffmpeg outro + frame extraction
│   │   │   ├── duplicate-checker.ts# SHA256 + pHash dedup
│   │   │   └── vk-uploader.ts      # VK video.save + wall.post
│   │   ├── moderation/
│   │   │   ├── roles.ts            # Role system (0-5)
│   │   │   ├── anti-spam.ts        # Flood/profanity/ad checker
│   │   │   ├── risk-score.ts       # Risk scoring with decay
│   │   │   └── commands.ts         # /warn /mute /kick /ban commands
│   │   ├── minecraft/
│   │   │   └── status.ts           # Minecraft server ping
│   │   └── scheduler/
│   │       └── scheduler.ts        # Cron-based posting scheduler
│   └── api/
│       ├── index.ts                # Express app factory
│       ├── middleware/auth.ts       # Session auth + bcrypt
│       └── routes/
│           ├── dashboard.ts
│           ├── queue.ts
│           ├── schedule.ts
│           ├── moderation.ts
│           ├── minecraft.ts
│           ├── settings.ts
│           └── logs.ts
├── admin/
│   ├── index.html                  # Admin panel SPA
│   ├── style.css                   # Dark theme CSS
│   └── app.js                      # Vanilla JS SPA router
├── data/                           # SQLite database (gitignored)
├── logs/                           # Log files (gitignored)
├── .env.example
├── package.json
├── tsconfig.json
├── Dockerfile
└── docker-compose.yml
```

## ⚙️ Setup

### 1. Clone and install

```bash
git clone <repo>
cd goldmine-vk-bot
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

Required:
- `VK_GROUP_TOKEN` — VK group access token (with `messages`, `wall`, `video` permissions)
- `VK_GROUP_ID` — Your VK group ID (number only)
- `VK_BOT_OWNER_ID` — Your VK user ID (bot owner)
- `ADMIN_PASSWORD` — Admin panel password (change from default!)
- `SESSION_SECRET` — Random secret for sessions

Optional but recommended:
- `VK_USER_TOKEN` — User token for video uploads (if group token doesn't have video.save)
- `YOUTUBE_API_KEY` — YouTube Data API v3 key for content search
- `MINECRAFT_HOST` — Your Minecraft server host

### 3. Build & run

```bash
# Development (ts-node)
npm run dev

# Production build
npm run build
npm start

# Admin panel only
npm run dev:api
```

### 4. Docker

```bash
docker-compose up -d
```

## 🤖 Bot Commands

All commands start with `/` and can be used in group chats or private messages.

| Command | Role Required | Description |
|---------|--------------|-------------|
| `/status` | Everyone | Show bot & Minecraft status |
| `/queue` | Moderator | Show content queue |
| `/cancel <taskId>` | Admin | Cancel a queue task |
| `/fetch [query]` | Admin | Search and queue a YouTube video |
| `/schedule` | Moderator | Show scheduled posts |
| `/settings <key> <value>` | Admin | Update a setting |
| `/role` | Admin | Show your role |

### Moderation commands (in group chats)

| Command | Role Required | Description |
|---------|--------------|-------------|
| `/warn [id\|mention] [reason]` | Moderator | Warn a user |
| `/unwarn [id\|mention]` | Moderator | Remove last warning |
| `/mute [id\|mention] [minutes] [reason]` | Moderator | Mute a user |
| `/unmute [id\|mention]` | Moderator | Unmute a user |
| `/kick [id\|mention] [reason]` | Moderator | Kick a user |
| `/ban [id\|mention] [days] [reason]` | Admin | Ban a user |
| `/unban [id\|mention]` | Admin | Unban a user |
| `/stats [id\|mention]` | Moderator | Show user stats |
| `/role [id\|mention] <roleName>` | Admin | Set user role |

## 🛡️ Roles

| Role | Level | Description |
|------|-------|-------------|
| Banned | 0 | Blocked from all interactions |
| User | 1 | Default role |
| Trusted | 2 | Trusted member, fewer restrictions |
| Moderator | 3 | Can warn, mute, kick |
| Admin | 4 | Can ban, manage roles, configure bot |
| Owner | 5 | Full access (set via VK_BOT_OWNER_ID) |

## 📺 Content Pipeline

1. **Search** — YouTube API searches for videos matching configured topics
2. **Filter** — Duration filter (min/max), existing duplicate check
3. **Download** — yt-dlp downloads best quality up to 1080p
4. **Dedup check** — SHA-256 file hash + perceptual hash (8×8 DCT)
5. **Outro** — ffmpeg appends outro card with group name
6. **Upload** — VK video.save API, file upload
7. **Schedule** — wall.post with publish_date, or immediate posting
8. **Cleanup** — Local files deleted after upload

### Scheduler settings

- `DAILY_POST_LIMIT` — Max posts per day (default: 3)
- `POST_SCHEDULE_HOURS` — Hours to post at, comma-separated (default: 10,14,18)
- `QUIET_HOURS_START` / `QUIET_HOURS_END` — No posting during these hours

## 🛡️ Anti-Spam

The bot automatically detects and handles:

- **Flood** — 5+ messages in 10 seconds → mute
- **Profanity** — Russian/English profanity list → warn
- **Ads/Links** — External links and competing communities → mute
- **Raid** — 10+ joins in 60 seconds → quarantine mode (30 min)

### Risk Score

Each user has a 0-100 risk score:
- Increases on violations (+5 to +20)
- Decays by 10%/day when inactive
- Auto-actions: warn at 50, mute at 75, kick at 90

## 🖥️ Admin Panel

Access at `http://localhost:3000` (or configured `ADMIN_PORT`).

Default password: `changeme` — **change this immediately** via `ADMIN_PASSWORD` env var.

### Pages

- **Dashboard** — Live stats: queue, posts today, mutes, bans, Minecraft status, audit log
- **Queue** — View and cancel tasks, manually trigger content fetch
- **Schedule** — View and cancel scheduled video posts
- **Moderation** — Browse events, search user by ID, warn/mute/ban actions
- **Minecraft** — Server status card with player count
- **Settings** — View/edit database settings (key-value store)
- **Logs** — Read app/error/audit/moderation/content log files

## 📊 Database Schema

- `videos` — Content pipeline records
- `queue_tasks` — Task queue persistence
- `moderation_events` — Moderation action log
- `user_roles` — User role assignments
- `user_warnings` — Warning records
- `user_stats` — Message counts, risk scores
- `audit_log` — Admin panel actions
- `settings` — Key-value configuration store

## 🔒 Security Notes

- Admin password is bcrypt-hashed and stored in DB on first run
- Sessions use httpOnly cookies with 24h TTL
- Sensitive settings (`admin_password_hash`) are filtered from API responses
- All SQL queries use parameterized statements (SQLite prepared statements)
- Log path traversal is prevented by an allowlist of log type names

## 📝 Logs

| File | Contents |
|------|----------|
| `logs/app.log` | General application log |
| `logs/error.log` | Error-level events only |
| `logs/audit.log` | Admin panel actions |
| `logs/moderation.log` | Moderation events |
| `logs/content.log` | Content pipeline events |

All logs rotate at 10MB, keeping 5-10 files.

## 🐳 Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

The container installs ffmpeg and yt-dlp automatically.

## 📄 License

MIT — see [LICENSE](LICENSE)
