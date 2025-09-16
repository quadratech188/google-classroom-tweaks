#!/bin/bash

set -e

# --- Configuration ---
GITHUB_REPO="quadratech188/google-classroom-tweaks"

# The ID of your extension
EXTENSION_ID="gct-downloader@quadratech"

# --- Script ---

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for dependencies
if ! command_exists curl; then
    echo "Error: curl is not installed. Please install it to continue." >&2
    exit 1
fi
if ! command_exists jq; then
    echo "Error: jq is not installed. Please install it to continue." >&2
    exit 1
fi

# Determine OS, asset name, and Firefox native messaging host path
OS="$(uname -s)"
case "$OS" in
    Linux*)
        ASSET_NAME="daemon-linux"
        HOST_PATH="$HOME/.mozilla/native-messaging-hosts"
        ;;
    Darwin*)
        ASSET_NAME="daemon-macos"
        HOST_PATH="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
        ;;
    *)
        echo "Error: Unsupported OS '$OS'. This script only supports Linux and macOS." >&2
        exit 1
        ;;
esac

# Get the URL for the latest release asset
API_URL="https://api.github.com/repos/$GITHUB_REPO/releases/latest"

echo "Fetching latest release from $GITHUB_REPO..."
ASSET_URL=$(curl -s "$API_URL" | jq -r ".assets[] | select(.name == \"$ASSET_NAME\") | .browser_download_url")

if [ -z "$ASSET_URL" ] || [ "$ASSET_URL" == "null" ]; then
    echo "Error: Could not find asset '$ASSET_NAME' in the latest release of $GITHUB_REPO." >&2
    echo "Please make sure a release exists and contains an asset with that exact name." >&2
    exit 1
fi

# Download the daemon to the same directory as the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
DAEMON_PATH="$SCRIPT_DIR/daemon"

echo "Downloading $ASSET_NAME to $DAEMON_PATH..."
curl -L -o "$DAEMON_PATH" "$ASSET_URL"

# Make it executable
chmod +x "$DAEMON_PATH"

echo "Daemon downloaded to $DAEMON_PATH"

# Ensure the host path directory exists
mkdir -p "$HOST_PATH"

# Create the manifest file content
MANIFEST_PATH="$HOST_PATH/${EXTENSION_ID//[@]/_}.json"

cat > "$MANIFEST_PATH" << EOL
{
  "name": "gct_download_manager",
  "description": "Google Classroom Tweaks Download Manager",
  "path": "$DAEMON_PATH",
  "type": "stdio",
  "allowed_extensions": [
    "$EXTENSION_ID"
  ]
}
EOL

echo "Manifest file created at $MANIFEST_PATH"

echo "Installation complete!"