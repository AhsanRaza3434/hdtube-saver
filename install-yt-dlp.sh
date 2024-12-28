#!/bin/bash

echo "Upgrading Python to version 3.9..."

# Install pyenv and Python 3.9
curl https://pyenv.run | bash
export PATH="$HOME/.pyenv/bin:$PATH"
eval "$(pyenv init --path)"
eval "$(pyenv init -)"

pyenv install 3.9.10
pyenv global 3.9.10

echo "Installing yt-dlp..."
echo "Current PATH: $PATH"  # Debug line

# Create the ~/bin directory if it doesn't exist
mkdir -p ~/bin

# Try to use /usr/local/bin if accessible
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp || echo "Failed to download yt-dlp"
chmod +x /usr/local/bin/yt-dlp || echo "Failed to make yt-dlp executable"

# Confirm installation
/usr/local/bin/yt-dlp --version || echo "yt-dlp not functional"

