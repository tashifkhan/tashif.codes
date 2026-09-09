# Daemon mode

The daemon mode allows you to run the auto-login process in the background without keeping a terminal window open. This feature is only available on Unix-like systems (Linux, macOS).

## Overview

When running in daemon mode:

- The process detaches from the terminal and runs in the background.
- All output is redirected to a log file in `~/.sophos-autologin/sophos-autologin.log`.
- A PID file is created at `~/.sophos-autologin/sophos-autologin.pid`.

## Usage

### Starting the daemon

```bash
python autologin.py --start --daemon
```

### Checking daemon status

You can check if the daemon is running using the `--status` argument:

```bash
python autologin.py --status
```

![Daemon Status](images/status.png)

### Stopping the daemon

```bash
python autologin.py --exit
```

Alternatively, you can use the following command to find and kill the process:

```bash
kill $(cat ~/.sophos-autologin/sophos-autologin.pid)
```
