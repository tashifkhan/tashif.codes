# Advanced features

## Automatic ID switching

The script automatically switches to the next available ID in the database if:

- The current ID reaches its data limit.
- The current ID fails to log in.

This ensures uninterrupted connectivity.

## Internet connection check

The script periodically checks for internet connectivity every 90 seconds. If the internet connection is lost, the script will attempt to log in again.

## Scheduled re-login

To ensure continuous connectivity, the script performs a scheduled re-login every 30 minutes, even if the internet connection is active.

## Creating an executable

To create a standalone executable from the Python script:

1.  **Clone and Install**:

    ```bash
    git clone https://github.com/tashifkhan/sophos-auto-login.git
    cd sophos-auto-login
    pip install -r requirements.txt
    pip install pyinstaller
    ```

2.  **Build**:

    ```bash
    # For MacOS / Linux
    pyinstaller --onefile --add-data "db/credentials.db:." autologin.py

    # For Windows
    pyinstaller --onefile --add-data "db/credentials.db;." autologin.py
    ```

This will create an executable file in the `dist` directory.
