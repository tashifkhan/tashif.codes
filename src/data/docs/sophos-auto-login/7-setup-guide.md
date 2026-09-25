# macOS and linux setup

On Unix you can keep the script in a venv, run it as a daemon, or wrap that daemon in systemd / launchd so it comes back after reboot.

Windows has no `daemonize()`. Use `--start` in a terminal, or the [release `.exe`](https://github.com/tashifkhan/sophos-auto-login/releases).

## 1. Virtual environment

```bash
cd sophos-auto-login
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Confirm you can reach the portal from this machine before you bother with services.

```bash
python autologin.py --add
python autologin.py --start
```

## 2. Runnable script

Point the shebang at the venv interpreter (`which python` while the venv is active):

```python
#!/path/to/sophos-auto-login/venv/bin/python3
```

```bash
chmod +x autologin.py
./autologin.py
```

`daemonize()` still `chdir("/")`, so systemd `WorkingDirectory` and launchd `WorkingDirectory` should stay the repo if you care about relative paths. The SQLite file does not use the cwd. It uses `~/.autologin_script/credentials.db`.

## 3. systemd (linux)

`/etc/systemd/system/sophos-autologin.service`:

```ini
[Unit]
Description=Sophos Auto Login Service
After=network.target

[Service]
ExecStart=/path/to/sophos-auto-login/venv/bin/python3 /path/to/sophos-auto-login/autologin.py --start --daemon
WorkingDirectory=/path/to/sophos-auto-login
Restart=always
RestartSec=10
User=your_username

[Install]
WantedBy=multi-user.target
```

Replace the three paths and `User`. The process must run as the user who owns `~/.autologin_script/` and `~/.sophos-autologin/`. Running it as root stores the DB in root's home, then your login session cannot see those IDs.

```bash
sudo systemctl enable sophos-autologin.service
sudo systemctl start sophos-autologin.service
```

`--start --daemon` double-forks. systemd may think the service exited. If `Restart=always` fights the PID file, drop `--daemon` and let systemd hold the foreground `--start` process instead:

```ini
ExecStart=/path/to/sophos-auto-login/venv/bin/python3 /path/to/sophos-auto-login/autologin.py --start
```

Logs then go to the journal, not `~/.sophos-autologin/sophos-autologin.log`. `--status` reads that log file, so it will look idle unless you also daemonize.

## 4. LaunchAgent (macOS)

`~/Library/LaunchAgents/com.user.sophosautologin.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.user.sophosautologin</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/to/sophos-auto-login/venv/bin/python3</string>
    <string>/path/to/sophos-auto-login/autologin.py</string>
    <string>--start</string>
    <string>--daemon</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>/Users/your_username/.sophos-autologin/error.log</string>
  <key>StandardOutPath</key>
  <string>/Users/your_username/.sophos-autologin/output.log</string>
  <key>WorkingDirectory</key>
  <string>/path/to/sophos-auto-login</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.user.sophosautologin.plist
```

Create `~/.sophos-autologin` first so the stdout/stderr paths exist. `KeepAlive` plus double-fork has the same double-supervisor problem as systemd. If launchd keeps spawning extras, remove `--daemon` and let launchd keep `--start` in the foreground.

## 5. After it is running

```bash
python autologin.py --status
tail -f ~/.sophos-autologin/sophos-autologin.log
python autologin.py --exit
```

`--exit` logs out then kills autologin PIDs. Prefer that over `launchctl unload` or `systemctl stop` if you want the portal session closed too.
