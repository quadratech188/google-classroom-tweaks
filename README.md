# Google Classroom Tweaks

This Firefox extension enhances Google Classroom by adding a "Download" button to assignment and material links. This allows you to download files directly to a pre-configured folder for each classroom.

## Features

- Adds a "Download" button next to downloadable files in Google Classroom.
- Prompts you to set a download path for each classroom the first time you use it.
- Remembers your chosen path for each classroom.
- Uses a native messaging host to move downloaded files to your specified folder.
- Prevents overwriting existing files in the destination folder by throwing an error.

## How to install

### 1. Install the Native Messaging Host

The extension requires a small helper program (the "daemon") to move files to your specified folders.

1.  Navigate to the `google-classroom-tweaks/daemon` directory.
2.  Run the `install.sh` script (or follow manual installation steps if not on Linux/macOS). This will compile the daemon and register it with Firefox.

### 2. Install the Firefox Extension

1.  Open Firefox and navigate to `about:debugging`.
2.  Click on "This Firefox" and then "Load Temporary Add-on".
3.  Select the `manifest.json` file in the `google-classroom-tweaks` directory.

## How to use

1.  Navigate to a Google Classroom page with a downloadable file.
2.  Click the "Download" button next to the file.
3.  The first time you download from a new classroom, a dialog will appear asking you to set a download path for that classroom.
4.  The file will be downloaded and then moved to your specified folder.
5.  You can manage your saved paths in the extension's settings page.