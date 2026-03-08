# Getting Started

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [app/README.md](file://app/README.md)
- [app/main.py](file://app/main.py)
- [app/core/config.py](file://app/core/config.py)
- [app/servers/bot_server.py](file://app/servers/bot_server.py)
- [app/services/telegram_service.py](file://app/services/telegram_service.py)
- [app/services/notification_service.py](file://app/services/notification_service.py)
- [app/runners/update_runner.py](file://app/runners/update_runner.py)
- [app/runners/notification_runner.py](file://app/runners/notification_runner.py)
- [docs/CONFIGURATION.md](file://docs/CONFIGURATION.md)
- [docs/TROUBLESHOOTING.md](file://docs/TROUBLESHOOTING.md)
- [app/docker-compose.dev.yaml](file://app/docker-compose.dev.yaml)
- [app/pyproject.toml](file://app/pyproject.toml)
- [app/requirements.txt](file://app/requirements.txt)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Quick Start: Live Bot Usage](#quick-start-live-bot-usage)
3. [Self-Hosted Setup](#self-hosted-setup)
4. [Prerequisites](#prerequisites)
5. [Installation Steps](#installation-steps)
6. [Initial Configuration](#initial-configuration)
7. [Environment Variables](#environment-variables)
8. [Basic Command Usage](#basic-command-usage)
9. [Architecture Overview](#architecture-overview)
10. [Verification Checklist](#verification-checklist)
11. [Troubleshooting Common Issues](#troubleshooting-common-issues)
12. [Next Steps](#next-steps)

## Introduction
The SuperSet Telegram Notification Bot is a placement notification system for JIIT students. It aggregates job postings, placement offers, and placement updates from JIIT's SuperSet portal, email sources, and official websites, then distributes them via Telegram and Web Push channels. The system includes automated scraping, LLM-powered content processing, and multi-channel notifications.

Key capabilities:
- Automated scraping of SuperSet portal, emails, and official websites
- Smart duplicate detection to prevent repeated notifications
- LLM-powered extraction and structuring of placement data
- Multi-channel broadcasting (Telegram and Web Push)
- User management with simple commands (/start, /stop, /status)
- Scheduled updates (3x daily IST)
- Admin dashboard and daemon mode for production deployments

## Quick Start: Live Bot Usage
No setup required! The bot is already running and ready to use:

- **Telegram Bot**: [@SupersetNotificationBot](https://t.me/SupersetNotificationBot)
- **Web Dashboard**: [JIIT Placement Updates](https://jiit-placement-updates.tashif.codes)

Steps:
1. Open Telegram and search for [@SupersetNotificationBot](https://t.me/SupersetNotificationBot)
2. Send `/start` to register for notifications
3. You'll receive updates via Telegram automatically
4. Use `/help` to see all available commands

## Self-Hosted Setup
For advanced users who want to run their own instance, follow these steps:

### Prerequisites
- **Python**: 3.12 or higher
- **MongoDB**: Local or Atlas (cloud)
- **Telegram Bot**: Created via @BotFather
- **Email Account**: Gmail with app password (for email monitoring)
- **API Key**: Google API key for Gemini (optional, for LLM features)

### Installation Steps

#### 1. Clone Repository
```bash
git clone https://github.com/tashifkhan/placement-alerts-superset-telegram-notification-bot.git
cd placement-alerts-superset-telegram-notification-bot
```

#### 2. Install Dependencies
```bash
cd app

# Using uv (recommended)
pip install uv
uv sync

# OR using pip
pip install -r requirements.txt
```

#### 3. Get Credentials

**Telegram Bot Token:**
1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Follow the prompts and copy your token

**Chat ID:**
- Message [@userinfobot](https://t.me/userinfobot) to get your user ID
- Or use the getUpdates API endpoint for group/channel IDs

**MongoDB Connection String:**
1. Create free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create a cluster
3. Click "Connect" → "Connect Your Application"
4. Copy the connection string

**Gmail App Password:**
1. Enable 2-factor authentication on Google Account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Generate password for "Mail" and "Windows Computer"
4. Copy the 16-character password

#### 4. Configure Environment
Create `.env` file in the `app/` directory:

```bash
# MongoDB
MONGO_CONNECTION_STR=mongodb+srv://username:password@cluster.mongodb.net/SupersetPlacement

# Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
TELEGRAM_CHAT_ID=987654321

# SuperSet Credentials (JSON format)
SUPERSET_CREDENTIALS=[{"email": "cse_email@jiit.ac.in", "password": "password"}]

# Email & Gmail
PLACEMENT_EMAIL=your_gmail@gmail.com
PLACEMENT_PASSWORD=your_app_password
GOOGLE_API_KEY=your_google_api_key

# Optional
DEBUG=false
```

#### 5. Run the Bot
```bash
# Run in foreground (development)
python main.py bot

# Run in background (daemon mode - production)
python main.py bot --daemon

# Run one-time update
python main.py update

# Send pending notifications
python main.py send --telegram

# Start webhook server
python main.py webhook --port 8000
```

## Architecture Overview
The application follows a service-oriented architecture with dependency injection:

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
SSC[SupersetScraperClient]
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
OW --> SSC
SC --> NFS
ENS --> NFS
NFS --> DB
SSC --> DB
DB --> TS
DB --> WS
```

**Diagram sources**
- [app/servers/bot_server.py](file://app/servers/bot_server.py#L1-L519)
- [app/services/notification_service.py](file://app/services/notification_service.py#L1-L237)
- [app/runners/update_runner.py](file://app/runners/update_runner.py#L1-L278)

## Environment Variables
The application uses Pydantic's BaseSettings for type-safe configuration. All configuration is managed through environment variables loaded from a `.env` file.

### Required Variables
- **Database**: `MONGO_CONNECTION_STR` - MongoDB connection URI
- **Telegram**: `TELEGRAM_BOT_TOKEN` - API Token from @BotFather, `TELEGRAM_CHAT_ID` - Channel or Chat ID
- **SuperSet Credentials**: `SUPERSET_CREDENTIALS` - JSON list of SuperSet credentials
- **Email Intelligence**: `PLACEMENT_EMAIL` - Gmail address, `PLACEMENT_PASSWORD` - Gmail App Password, `GOOGLE_API_KEY` - Google API Key

### Optional Variables
- **Web Push**: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_EMAIL`
- **Server Configuration**: `WEBHOOK_PORT`, `WEBHOOK_HOST`
- **Daemon Mode**: `DAEMON_MODE`
- **Logging**: `LOG_LEVEL`, `LOG_FILE`, `SCHEDULER_LOG_FILE`

**Section sources**
- [docs/CONFIGURATION.md](file://docs/CONFIGURATION.md#L1-L724)
- [app/core/config.py](file://app/core/config.py#L1-L254)

## Basic Command Usage
The application is controlled via a unified CLI entry point `main.py`.

### Available Commands
- `bot` - Starts the Telegram Bot server (commands only)
- `scheduler` - Runs scheduled update jobs server
- `webhook` - Starts the FastAPI Webhook server
- `update` - Full update: SuperSet + Emails (Placements + Notices)
- `send` - Sending engine (dispatch pending messages)
- `official` - Runs the official website scraper

### Command Options
- `--daemon` - Run in daemon mode (suppress stdout)
- `--telegram` - Via Telegram
- `--web` - Via Web Push
- `--both` - Via both channels
- `--fetch` - Fetch first before sending
- `--host` - Host for webhook server
- `--port` - Port for webhook server

**Section sources**
- [app/main.py](file://app/main.py#L370-L632)
- [app/README.md](file://app/README.md#L187-L252)

## Verification Checklist
Before you begin, verify your environment meets all requirements:

### 1. Prerequisites Verification
- [ ] Python 3.12+ installed
- [ ] MongoDB instance available (local or Atlas)
- [ ] Telegram account with @BotFather access
- [ ] Gmail account with 2FA enabled and app password
- [ ] Google API key for Gemini (optional)

### 2. Environment Setup
- [ ] `.env` file created in `app/` directory
- [ ] All required environment variables configured
- [ ] MongoDB connection string valid
- [ ] Telegram bot token and chat ID configured
- [ ] SuperSet credentials in JSON format
- [ ] Gmail credentials properly set up

### 3. Initial Testing
- [ ] Run `python main.py bot` to start bot server
- [ ] Test `/start` command in Telegram
- [ ] Verify user registration in database
- [ ] Run `python main.py update` for manual update
- [ ] Check logs for any errors

### 4. Production Readiness
- [ ] Set up daemon mode with `--daemon` flag
- [ ] Configure proper logging and monitoring
- [ ] Set up backup procedures for MongoDB
- [ ] Configure firewall and network access
- [ ] Set up process management (systemd or similar)

## Troubleshooting Common Issues

### Bot Not Receiving Messages
**Symptoms**: Commands not responding, users not registering
**Common Causes**:
- Bot server not running
- Long-polling vs Webhook confusion
- User not registered
- Chat ID mismatch

**Solutions**:
1. Verify bot server is running: `ps aux | grep main.py | grep bot`
2. Check command format: `/start` (lowercase, no spaces)
3. Verify TELEGRAM_CHAT_ID format (numeric only)
4. Test manually with curl: `curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" -d "chat_id=$TELEGRAM_CHAT_ID&text=Test"`

### Database Connection Issues
**Symptoms**: Connection timeout, authentication failed
**Common Causes**:
- Invalid connection string format
- IP whitelist not configured
- Incorrect credentials
- Firewall blocking port 27017

**Solutions**:
1. Check connection string format: `mongodb+srv://user:pass@cluster.mongodb.net/db`
2. Add IP to MongoDB Atlas whitelist
3. URL-encode special characters in passwords
4. Test connectivity: `telnet cluster.mongodb.net 27017`

### Email Processing Problems
**Symptoms**: Emails not being processed, offers not extracted
**Common Causes**:
- Gmail App Password incorrect
- 2-Factor Authentication not enabled
- LLM not working
- Email format not recognized

**Solutions**:
1. Regenerate app password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Enable 2-Step Verification in Google Account
3. Check GOOGLE_API_KEY format (should start with AIzaSy)
4. Test email processing manually

### Notification Delivery Issues
**Symptoms**: Notices processed but not sent to Telegram
**Common Causes**:
- sent_to_telegram flag already true
- Telegram service connection issue
- Chat ID not valid
- Message too long

**Solutions**:
1. Check and reset sent flags if needed
2. Test Telegram API connectivity
3. Verify chat ID format (all numeric with optional minus)
4. Check message length (Telegram has 4096 character limit)

**Section sources**
- [docs/TROUBLESHOOTING.md](file://docs/TROUBLESHOOTING.md#L1-L615)

## Next Steps
Once your bot is running successfully:

### 1. Monitor Operations
- Set up logging and monitoring
- Configure alerts for critical errors
- Monitor database performance
- Track user engagement metrics

### 2. Scale and Customize
- Add more data sources
- Implement user filtering options
- Enhance notification templates
- Add analytics dashboard

### 3. Maintenance
- Regular database backups
- Update credentials periodically
- Monitor service health
- Review and optimize performance

### 4. Community
- Share your deployment experience
- Contribute improvements
- Report bugs and issues
- Help other users deploy

The bot is designed for both personal use and production deployment. Start with the live bot for immediate use, then consider self-hosting for customization and privacy requirements.