# Overview

This Python script automates the login process for a Sophos internet web authentication portal. It ensures uninterrupted connectivity by automatically re-authenticating you every 2 minutes to prevent logout.

[Download Latest Release](https://github.com/tashifkhan/sophos-auto-login/releases)

## Documentation sections

- [Overview](1-overview)
- [Quick Start](2-quick-start)
- [Command-Line Usage](3-cli-usage)
- [Interactive Menu](4-interactive-menu)
- [Daemon Mode](5-daemon-mode)
- [Advanced Features](6-advanced-features)
- [Setup Guide](7-setup-guide)
- [Screenshots](8-screenshots)

## Features

- **SQLite Integration** - Credentials are securely stored in an SQLite database.
- **Automatic ID Switching** - Automatically switches to the next available ID if the current one fails or reaches its data limit.
- **Command-Line Arguments** - Supports various system arguments for automation and management.
- **Credential Management** - Add, edit, delete, import, and export credentials.
- **Interactive Menu** - User-friendly menu for managing credentials and starting the auto-login process.
- **CSV Import/Export** - Easily import/export credentials to/from a CSV file.
- **Auto-Logout Handling** - Ensures smooth reconnection by automatically logging in when disconnected.
- **Cross-Platform Compatibility** - Works on both Windows and Unix-based systems.
- **Daemon Mode** - Run the auto-login process in the background (Unix-like systems only).
- **Connection Check** - Periodically checks for internet connectivity and logs in if disconnected.
- **Scheduled Re-login** - Performs a scheduled re-login every 30 minutes to maintain connection.
