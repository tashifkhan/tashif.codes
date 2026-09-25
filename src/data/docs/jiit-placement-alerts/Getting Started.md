# Getting started

## Introduction
JIIT placement alerts. The bot scrapes SuperSet, placement email, and the official site, stores the result in MongoDB, then pushes it on Telegram and Web Push.

The hosted bot is enough if you only want alerts. Self-host if you want your own credentials, years, or filters.

What it does:
- Scrapes SuperSet, email, and the official JIIT placement pages
- Dedupes so the same notice does not go out twice
- Uses Gemini (optional) to extract offers and notices from email
- Sends on Telegram and Web Push
- Registers users with `/start`, `/stop`, `/status`, `/placement_year`
- Runs SuperSet plus email on the hour at midnight and 8 AM through 11 PM IST, and scrapes official data at 12 PM IST
- Ships admin commands and daemon mode for a VPS

## Quick start: live bot usage
Already running:

- Telegram: [@SupersetNotificationBot](https://t.me/SupersetNotificationBot)
- Site: [JIIT Placement Updates](https://jiit-placement-updates.tashif.codes)

1. Open [@SupersetNotificationBot](https://t.me/SupersetNotificationBot)
2. Send `/start`
3. Pick a year with `/placement_year` if the default is wrong
4. `/help` lists the rest

User commands: `/start`, `/stop`, `/status`, `/placement_year`, `/stats`, `/noticestats`, `/web`, `/help`.

## Self-hosted setup

### Prerequisites
- Python 3.12+
- MongoDB, local or Atlas
- A Telegram bot token from @BotFather
- SuperSet login(s)
- Gmail app password if you want email ingestion
- `GOOGLE_API_KEY` if you want Gemini extraction

Local MongoDB from `app/docker-compose.dev.yaml`:

```bash
cd app
docker compose -f docker-compose.dev.yaml up -d
```

### Installation steps

#### 1. clone repository
```bash
git clone https://github.com/tashifkhan/JIIT-placement-alerts.git
cd JIIT-placement-alerts
```

#### 2. install dependencies
Code lives in `app/` (`pyproject.toml`, clients, core, model, servers). Install from there.

```bash
cd app
uv sync

# or with pip
pip install -r requirements.txt
```

`uv` is the lockfile path (`uv.lock`). Install uv first if you do not have it. Do not `pip install uv` as the main setup step.

#### 3. get credentials

Telegram bot token:
1. Message [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Copy the token into `.env`

Chat ID:
- Personal use: message [@userinfobot](https://t.me/userinfobot) and use the `user_id` as `TELEGRAM_CHAT_ID`
- Channel or group: add the bot as admin, post something, then open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` and read `"chat":{"id":...}`. Group and channel IDs are negative.

MongoDB:
1. Atlas free tier, or the compose service above
2. Copy the connection string into `MONGO_CONNECTION_STR`

Gmail app password (email ingestion):
1. Turn on 2-step verification
2. Create an app password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Put it in `PLACEMENT_APP_PASSWORD` (the old `PLCAMENT_*` names still work)

#### 4. configure environment
Copy `.env.example` to `app/.env` and fill it in. Protected webhook routes fail closed unless `WEBHOOK_API_KEY` is set. Admin commands fail closed unless your Telegram user ID is in `ADMIN_TELEGRAM_USER_IDS`.

```
# MongoDB
MONGO_CONNECTION_STR=mongodb+srv://username:password@cluster.mongodb.net/database
MONGO_DATABASE_NAME=2025-26
GLOBAL_DATABASE_NAME=PlacementBotGlobal
ACTIVE_PLACEMENT_YEAR=202526
DEFAULT_PLACEMENT_YEAR=202526
PLACEMENT_YEARS=["202526", "202627"]

# Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ
TELEGRAM_CHAT_ID=your_chat_id
ADMIN_TELEGRAM_USER_IDS=[123456789]

# SuperSet credentials grouped by ingestion year
SUPERSET_CREDENTIALS=[]
SUPERSET_CREDENTIALS_BY_YEAR={"202526":[{"email":"senior@example.com","password":"replace-me"}],"202627":[{"email":"junior@example.com","password":"replace-me"}]}

# Email + Gemini (optional)
PLACEMENT_EMAIL=your_gmail@gmail.com
PLACEMENT_APP_PASSWORD=your_app_password
GOOGLE_API_KEY=your_google_api_key

# Protected webhook API
WEBHOOK_API_KEY=generate_a_long_random_secret
CORS_ORIGINS=["https://your-dashboard.example.com"]
```

Placement-year settings:
- `PLACEMENT_YEARS` is what the bot UI and notification routing show.
- `SUPERSET_CREDENTIALS_BY_YEAR` is what `update` and `update-supersets` scrape. Every year you want scraped needs a key with at least one credential.
- `ACTIVE_PLACEMENT_YEAR` is the fallback year for operations.
- `DEFAULT_PLACEMENT_YEAR` is assigned to new users until they pick one.

Without `--year`, an update scrapes every year in `SUPERSET_CREDENTIALS_BY_YEAR`:

```bash
cd app
uv run main.py update --year 202627
```

Email ingestion reads the year from a plus alias such as `placement+202627@example.com`. An unread email with no valid year alias goes to `ACTIVE_PLACEMENT_YEAR` unless `--year` sets another fallback.

#### 5. run the bot
The bot server handles commands. The scheduler runs scraping and Telegram sends. You need both for a complete setup.

```bash
cd app

python main.py bot                  # bot server, foreground
python main.py scheduler            # scheduled jobs, foreground

python main.py bot --daemon         # bot server, background
python main.py scheduler --daemon   # scheduled jobs, background
```

Daemon control:

```bash
python main.py status               # both daemons
python main.py stop bot
python main.py stop scheduler
```

One-off runs:

```bash
python main.py update               # SuperSet + emails
python main.py send --telegram
python main.py send --web
python main.py send --both
python main.py official             # official site scrape
python main.py webhook --port 8000
python main.py                      # update + send (legacy)
```

Tests:

```bash
cd app
pytest
```

## Architecture overview
Services plus dependency injection. Clients fetch, services process, runners and servers talk to Telegram and the webhook API.

```mermaid
graph TB
subgraph "Data Sources"
SS[SuperSet Portal]
GM[Gmail/Emails]
OW[Official Website]
end
subgraph "Service Layer"
SC[SupersetClientService]
PS[PlacementService]
ENS[EmailNoticeService]
NFS[NoticeFormatterService]
OPS[OfficialPlacementService]
end
subgraph "Storage"
DB[(MongoDB)]
NC[Notices Collection]
JC[Jobs Collection]
PC[PlacementOffers Collection]
UC[Users Collection]
end
subgraph "Notification Channels"
TS[Telegram Bot Server]
WS[Web Push Service]
end
SS --> SC
GM --> ENS
OW --> OPS
SC --> NFS
ENS --> NFS
NFS --> DB
OPS --> DB
DB --> TS
DB --> WS
```

## Environment variables
Pydantic `BaseSettings` loads `.env` from `app/`.

### Required
- `MONGO_CONNECTION_STR`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `SUPERSET_CREDENTIALS_BY_YEAR` (preferred) or `SUPERSET_CREDENTIALS`

### Optional
- `PLACEMENT_YEARS`, `ACTIVE_PLACEMENT_YEAR`, `DEFAULT_PLACEMENT_YEAR`, `MONGO_DATABASE_NAME`, `GLOBAL_DATABASE_NAME`
- `PLACEMENT_EMAIL`, `PLACEMENT_APP_PASSWORD` (aliases `PLCAMENT_EMAIL`, `PLCAMENT_APP_PASSWORD`)
- `GOOGLE_API_KEY`, `LLM_MODEL`
- `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_EMAIL`
- `WEBHOOK_PORT`, `WEBHOOK_HOST`, `WEBHOOK_API_KEY`, `CORS_ORIGINS`
- `ADMIN_TELEGRAM_USER_IDS`
- `LOG_LEVEL`, `LOG_FILE`, `SCHEDULER_LOG_FILE`

## Basic command usage
Entry point is `app/main.py`.

### Commands
- `bot` - Telegram bot (commands only)
- `scheduler` - APScheduler jobs
- `webhook` - FastAPI webhook server
- `update` - SuperSet + emails (placements + notices)
- `update-supersets` - SuperSet only
- `update-emails` - email only
- `send` - dispatch unsent notices
- `official` - official website scrape
- `official-seed` - seed frozen prior-year official batches
- `stop` / `status` - daemon control

### Options
- `--daemon` / `-d` - background
- `--year YEAR` - one SuperSet year, and email fallback year
- `--telegram` / `--web` / `--both` - send channels
- `--fetch` - update before send
- `--host` / `--port` - webhook bind

## Verification checklist

### 1. prerequisites
- [ ] Python 3.12+
- [ ] MongoDB reachable
- [ ] Telegram token from @BotFather
- [ ] SuperSet credentials for each year you scrape
- [ ] Gmail app password if you ingest email
- [ ] Gemini key if you want LLM extraction

### 2. environment
- [ ] `app/.env` filled in
- [ ] `MONGO_CONNECTION_STR` works
- [ ] `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` set
- [ ] `SUPERSET_CREDENTIALS_BY_YEAR` covers every year you scrape
- [ ] `ADMIN_TELEGRAM_USER_IDS` includes your user ID if you want admin commands
- [ ] `WEBHOOK_API_KEY` set if you expose the webhook

### 3. first run
- [ ] `python main.py bot` responds to `/start`
- [ ] User shows up in the global Users collection
- [ ] `python main.py update` completes
- [ ] `python main.py scheduler` is running if you want the cron
- [ ] Logs under `logs/` look clean

### 4. production
- [ ] `python main.py bot --daemon` and `python main.py scheduler --daemon`
- [ ] `python main.py status` shows both
- [ ] MongoDB backups
- [ ] Firewall and webhook auth

## Troubleshooting common issues

### Bot not receiving messages
Commands ignored, users not registering: bot process down, user never sent `/start`, or chat ID mismatch.

1. `ps aux | grep main.py | grep bot` or `python main.py status`
2. Commands are lowercase: `/start`
3. `TELEGRAM_CHAT_ID` is numeric. Groups are negative.
4. Smoke test: `curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" -d "chat_id=$TELEGRAM_CHAT_ID&text=Test"`

### Database connection issues
Timeout or auth failed:

1. URI shape: `mongodb+srv://user:pass@cluster.mongodb.net/db`
2. Atlas IP allowlist
3. URL-encode special characters in the password
4. `telnet cluster.mongodb.net 27017`

### Email processing problems
Unread mail sits there, offers never land:

1. New app password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. 2-step verification on
3. `GOOGLE_API_KEY` present if you expect LLM extraction
4. `python main.py update-emails` by hand and read the log

### Notification delivery issues
Notices in Mongo, nothing on Telegram:

1. Check `sent_to_telegram` and re-send with `python main.py send --telegram`
2. Telegram API connectivity
3. Chat IDs numeric, optional leading minus
4. Telegram caps a message at 4096 characters. The service splits long ones.

## Next steps
Use the live bot if you just want alerts. Self-host when you need your own SuperSet accounts or year routing.

Keep `python main.py scheduler` up. The cron is in code (`hour="0,8-23"` plus noon official scrape), not a GitHub Action. Workflows under `.github/workflows/` are disabled (`.legacy`).
