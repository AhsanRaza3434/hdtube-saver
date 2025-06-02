#!/bin/bash

echo "Installing yt-dlp..."

# Create a local bin directory
mkdir -p ./bin

# Download yt-dlp to ./bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./bin/yt-dlp
chmod +x ./bin/yt-dlp

# Install ffmpeg if not already installed
if ! command -v ffmpeg &> /dev/null; then
    echo "Installing ffmpeg..."
    apt-get update && apt-get install -y ffmpeg
fi

# Ensure cookies file exists
if [ ! -f ./cookies.txt ]; then
    echo "Creating cookies file..."
    cat > ./cookies.txt << EOL
# Netscape HTTP Cookie File
# https://curl.haxx.se/rfc/cookie_spec.html
# This is a generated file!  Do not edit.

.youtube.com	TRUE	/	TRUE	2147483647	CONSENT	YES+cb
.youtube.com	TRUE	/	TRUE	2147483647	VISITOR_INFO1_LIVE	random_string
.youtube.com	TRUE	/	TRUE	2147483647	YSC	random_string
.youtube.com	TRUE	/	TRUE	2147483647	GPS	1
EOL
fi

# Confirm installation
./bin/yt-dlp --version
