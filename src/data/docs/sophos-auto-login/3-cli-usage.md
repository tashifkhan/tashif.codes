# Command-Line usage

The script supports various command-line arguments for automation and management.

## Available arguments

| Argument                         | Description                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `--start` or `-s`                | Start the auto-login process immediately.                                    |
| `--add` or `-a`                  | Add new credentials to the database.                                         |
| `--edit` or `-e`                 | Edit existing credentials.                                                   |
| `--delete` or `-del`             | Delete credentials from the database.                                        |
| `--export [path]` or `-x [path]` | Export credentials to a CSV file (optional path).                            |
| `--import [path]` or `-i [path]` | Import credentials from a CSV file.                                          |
| `--show` or `-l`                 | Display all stored credentials.                                              |
| `--daemon` or `-d`               | Run the auto-login process in background mode (must be used with `--start`). |
| `--exit` or `-q`                 | Stop the daemon process and logout all credentials.                          |
| `--logout` or `-lo`              | Logout from all credentials without stopping the daemon process.             |
| `--speedtest` or `-t`            | Run a speed test to measure your current internet connection performance.    |
| `--status` or `-st`              | Display the current status of the daemon process.                            |

## Examples

```bash
# Start the auto-login process
python autologin.py --start

# Run in daemon mode (background process)
python autologin.py --start --daemon

# Stop the daemon process
python autologin.py --exit

# Add new credentials
python autologin.py --add

# Import credentials from CSV
python autologin.py --import credentials.csv
```
