# Screenshots

Terminal shots from the Rich TUI. Filenames match `quickstart/static/screenshots/` in the repo, typos included.

## Interactive menu

`python autologin.py` with no flags. Options 1 to 11.

![Interactive Menu](images/interative_menu.png)

## Starting auto-login

`--start` / menu option 2. Foreground `run_auto_login()`.

![Start Auto-Login via CLI](images/autologin-start.png)

## Daemon status

`--status` / menu option 10. Parsed from `~/.sophos-autologin/sophos-autologin.log`.

![Daemon Status via CLI](images/status.png)

## Exit daemon

`--exit` / `-q`. Logout of the active ID, then kill the daemon.

![Exit Daemon via CLI](images/exit.png)

## Logout

`--logout` / `-lo` / menu option 9. Every stored credential, daemon left running.

![Logout via CLI](images/logout.png)

## Speed test

`--speedtest` / `-t` / menu option 8.

![Speed Test via CLI](images/sppedtest.png)
