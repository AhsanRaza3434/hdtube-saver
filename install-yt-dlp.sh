#!/bin/bash
echo "Installing yt-dlp..."
echo "Current PATH: $PATH"  # Debug line

# Create the ~/bin directory if it doesn't exist
mkdir -p ~/bin

# Install yt-dlp to the user's home directory
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/yt-dlp
chmod +x ~/yt-dlp

# Move yt-dlp to ~/bin
mv ~/yt-dlp ~/bin/yt-dlp

# Confirm installation
~/bin/yt-dlp --version
