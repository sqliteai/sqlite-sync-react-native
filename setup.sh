#!/bin/bash

# Download CloudSync.xcframework for iOS if it doesn't exist
# This script is run during `yarn prepare`

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$ROOT_DIR/ios"
XCFRAMEWORK_DIR="$IOS_DIR/CloudSync.xcframework"

# Read version from package.json
VERSION=$(node -p "require('$ROOT_DIR/package.json').version")

if [ -d "$XCFRAMEWORK_DIR" ]; then
  echo "[sqlite-sync] CloudSync.xcframework already exists, skipping download"
  exit 0
fi

echo "[sqlite-sync] Downloading CloudSync.xcframework v${VERSION}..."

# Create ios directory if it doesn't exist
mkdir -p "$IOS_DIR"

# Download and extract
DOWNLOAD_URL="https://github.com/sqliteai/sqlite-sync-dev/releases/download/${VERSION}/cloudsync-apple-xcframework-${VERSION}.zip"
TEMP_ZIP="$IOS_DIR/cloudsync.zip"

curl -L -o "$TEMP_ZIP" "$DOWNLOAD_URL"
unzip -o "$TEMP_ZIP" -d "$IOS_DIR"
rm "$TEMP_ZIP"

echo "[sqlite-sync] CloudSync.xcframework downloaded successfully"
