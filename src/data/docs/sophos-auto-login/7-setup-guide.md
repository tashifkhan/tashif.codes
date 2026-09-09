# macOS and linux setup

On Unix-based systems, you can set up the script to run as a standalone application with a virtual environment or as a system service.

## Step 1: creating a virtual environment

A virtual environment isolates the script's dependencies:

```bash
cd sophos-auto-login
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Step 2: creating an executable script

1.  **Add a Shebang Line**: point to your virtual environment's Python interpreter (find it with `which python`).
    ```python
    #!/path/to/sophos-auto-login/venv/bin/python3
    #... rest of autologin.py...
    ```
2.  **Make it Executable**:
    ```bash
    chmod +x autologin.py
    ```
3.  **Run Directly**:
    ```bash
./autologin.py
    ```

## Step 3: creating a system service (linux)

Create a systemd service at `/etc/systemd/system/sophos-autologin.service`:

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

Enable and start:

```bash
sudo systemctl enable sophos-autologin.service
sudo systemctl start sophos-autologin.service
```

## Step 4: creating a launch agent (macOS)

Create a plist file at `~/Library/LaunchAgents/com.user.sophosautologin.plist`:

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

Load the agent:

```bash
launchctl load ~/Library/LaunchAgents/com.user.sophosautologin.plist
```
