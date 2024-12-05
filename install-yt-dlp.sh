#!/bin/bash
echo "Installing yt-dlp..."

# Install yt-dlp locally in the current directory or another writable directory
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp

# Move it to a directory within the project or user space
mkdir -p ~/bin
mv yt-dlp ~/bin/

# Optionally, add to PATH if necessary (but this may not persist across deployments)
echo 'export PATH=$PATH:~/bin' >> ~/.bashrc
source ~/.bashrc
