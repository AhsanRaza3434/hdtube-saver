#!/bin/bash

echo "Installing yt-dlp..."

# Create a local bin directory
mkdir -p ./bin

# Download yt-dlp to ./bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./bin/yt-dlp
chmod +x ./bin/yt-dlp

# Install ffmpeg if not already installed (if possible)
if ! command -v ffmpeg &> /dev/null; then
    echo "Installing ffmpeg..."
    apt-get update && apt-get install -y ffmpeg
fi

# Confirm installation
./bin/yt-dlp --version
