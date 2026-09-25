# Quick start

Two ways in. Grab a binary from [Releases](https://github.com/tashifkhan/sophos-auto-login/releases) if you do not want a Python install, or clone and run `autologin.py`.

You still need to be on the campus network that can reach `http://172.16.68.6:8090/httpclient.html`. Off campus this script has nothing to talk to.

## Pre-built executable

1. Open [Releases](https://github.com/tashifkhan/sophos-auto-login/releases).
2. Download the build for your OS.
3. Run it.

**Windows.** Double-click `autologin.exe`.

**macOS.** Extract `autologin-mac.zip` (release zips have also been named `autologin_script-mac.zip`). Gatekeeper will block an unsigned binary. Either:

- In Terminal, `cd` to the extract folder and run `xattr -d com.apple.quarantine autologin`, then run `./autologin`.
- Right-click the file, choose Open, confirm the dialog. Or allow it under System Settings, Privacy & Security.

**Linux.** Extract `autologin-linux.zip` (or `autologin_script-linux.zip`), `cd` there, run `./autologin`.

The frozen binary carries its own deps. First launch copies `credentials.db` into the persistent path if that file is still empty.

## From source

```bash
git clone https://github.com/tashifkhan/sophos-auto-login.git
cd sophos-auto-login
pip install -r requirements.txt
python autologin.py
```

`python3` works the same. No flags opens the [interactive menu](4-interactive-menu). Add at least one ID before you start auto-login. Empty database, `run_auto_login()` prints an error and returns.

Pinned packages live in `requirements.txt`. The ones the script actually imports:

- `requests` for the portal POSTs
- `rich` for the TUI
- `speedtest-cli` for `--speedtest`
- `win10toast` on Windows, `notify2` listed for Linux (the notifier itself shells out to `notify-send`)

`sqlite3` is in the stdlib. README still mentions `lxml` and `colorama`. Login parsing uses `xml.etree.ElementTree`, not lxml.

## First session

1. Add an ID: menu option 1, or `python autologin.py --add`.
2. Start the loop: menu option 2, or `python autologin.py --start`.
3. Leave that terminal open, or on Unix use [daemon mode](5-daemon-mode).

Ctrl+C hits `exit_handler` / `signal_handler`, which POSTs logout for the active credential before the process dies.
