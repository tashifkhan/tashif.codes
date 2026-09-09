# Quick start

## Using pre-built executable

You can download the latest pre-built executable from the [Releases](https://github.com/tashifkhan/sophos-auto-login/releases) section without installing Python or any dependencies:

1.  Go to the Releases section on GitHub.
2.  Download the executable for your operating system (Windows, macOS, or Linux).
3.  Run the downloaded file:
    - **Windows**: Double-click the `autologin.exe` file.
    - **macOS**:
      - Extract the downloaded `autologin-mac.zip` file.
      - **Option 1**: Remove the quarantine attribute by opening Terminal, navigating to the extraction location, and running `xattr -d com.apple.quarantine autologin` before executing it.
      - **Option 2**: Right-click on the extracted file, select "Open" from the context menu, then confirm the security dialog.
    - **Linux**:
      - Extract the downloaded `autologin-linux.zip` file.
      - Open Terminal, navigate to the extraction location and run `./autologin`.

## Building from source

If you prefer to run the Python script directly:

1.  Clone the repository:
    ```bash
    git clone https://github.com/tashifkhan/sophos-auto-login.git
    cd sophos-auto-login
    ```
2.  Install the required dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Run the script:
    ```bash
    python autologin.py
    ```
