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

# Create config directory
mkdir -p ./config

# Create yt-dlp config file with additional settings
cat > ./config/yt-dlp.conf << EOL
--no-check-certificate
--no-call-home
--no-cache-dir
--geo-bypass
--force-ipv4
--extractor-args youtube:player_client=android
--extractor-args youtube:player_skip=webpage
--extractor-args youtube:player_params={"hl":"en"}
--socket-timeout 30
--retries 10
--fragment-retries 10
--file-access-retries 10
--extractor-retries 10
--downloader-args "aria2c:--min-split-size=1M --max-connection-per-server=16 --max-concurrent-downloads=16 --split=16"
EOL

# Confirm installation
./bin/yt-dlp --version
