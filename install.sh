#!/bin/bash

# --- Configuration ---
# Get the absolute path to the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
DAEMON_DIR="${SCRIPT_DIR}/daemon"
MANIFEST_FILE="${DAEMON_DIR}/gct_download_manager.json"
DAEMON_GO_SOURCE="${DAEMON_DIR}/daemon.go"
DAEMON_EXECUTABLE="${DAEMON_DIR}/daemon" # Name of the compiled executable

NATIVE_HOSTS_DIR="$HOME/.mozilla/native-messaging-hosts"
NATIVE_MANIFEST_LINK="${NATIVE_HOSTS_DIR}/gct_download_manager.json"

# --- Check for Go installation ---
if ! command -v go &> /dev/null
then
    echo "Error: Go is not installed or not in your PATH."
    echo "Please install Go (https://golang.org/doc/install) and try again."
    exit 1
fi

# --- Extension ID (hardcoded as it's stable for permanent add-on) ---
EXTENSION_ID="gct-downloader@quadratech"

echo "--- Starting Native Messaging Host Installation ---"

# --- Step 1: Compile the Go Daemon ---
echo "1. Compiling Go daemon..."
(cd "$DAEMON_DIR" && go build -o daemon daemon.go)
if [ $? -ne 0 ]; then
    echo "Error: Go daemon compilation failed."
    exit 1
fi
echo "   Daemon compiled successfully: $DAEMON_EXECUTABLE"

# --- Step 2: Edit gct_download_manager.json ---
echo "2. Editing Native Messaging manifest file..."

# Escape paths for sed
ESCAPED_DAEMON_EXECUTABLE=$(echo "$DAEMON_EXECUTABLE" | sed 's/[\/&]/\\&/g')
ESCAPED_EXTENSION_ID=$(echo "$EXTENSION_ID" | sed 's/[\/&]/\\&/g')

# Replace path placeholder
sed -i "s|/path/to/your/google-classroom-tweaks/daemon/daemon|$ESCAPED_DAEMON_EXECUTABLE|g" "$MANIFEST_FILE"
if [ $? -ne 0 ]; then
    echo "Error: Failed to update daemon path in manifest."
    exit 1
fi

# Replace extension ID placeholder
sed -i "s|your_extension_id@your_domain.com|$ESCAPED_EXTENSION_ID|g" "$MANIFEST_FILE"
if [ $? -ne 0 ]; then
    echo "Error: Failed to update extension ID in manifest."
    exit 1
fi
echo "   Manifest updated: $MANIFEST_FILE"

# --- Step 3: Install the Native Messaging Host Manifest ---
echo "3. Installing Native Messaging Host manifest..."

mkdir -p "$NATIVE_HOSTS_DIR"
if [ $? -ne 0 ]; then
    echo "Error: Failed to create native messaging hosts directory."
    exit 1
fi

# Remove existing symlink if it exists
if [ -L "$NATIVE_MANIFEST_LINK" ]; then
    rm "$NATIVE_MANIFEST_LINK"
    echo "   Removed existing symlink."
fi

ln -s "$MANIFEST_FILE" "$NATIVE_MANIFEST_LINK"
if [ $? -ne 0 ]; then
    echo "Error: Failed to create symbolic link for manifest."
    exit 1
fi
echo "   Manifest linked to: $NATIVE_MANIFEST_LINK"

echo "--- Installation Complete ---"
echo "Please restart Firefox for the changes to take effect."
echo "You can verify the daemon setup by going to about:debugging#/runtime/this-firefox"
echo "and checking for 'Native messaging hosts' section."
