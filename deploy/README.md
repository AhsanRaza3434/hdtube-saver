# HDTube-Saver Server Deployment

This package contains the server-side components of HDTube-Saver. Follow these instructions to deploy it on your Windows server.

## Prerequisites

1. Node.js (v14 or higher) installed on your server
2. Administrator access to the server
3. Internet connection for initial setup

## Deployment Steps

1. Copy all files from this folder to your desired location on the Windows server
2. Run `setup.bat` as administrator
   - This will:
     - Check for Node.js installation
     - Create necessary directories
     - Install required npm packages
     - Download yt-dlp executable

3. After setup is complete, start the server by running:
   ```
   node server.js
   ```

## Important Notes

- The server runs on port 3000 by default
- Make sure the port is not blocked by your firewall
- The `temp` directory is used for temporary file storage during downloads
- Keep yt-dlp.exe in the same directory as server.js

## Troubleshooting

If you encounter any issues:

1. Make sure Node.js is properly installed
2. Check if all dependencies were installed correctly
3. Ensure you have write permissions in the directory
4. Verify that port 3000 is not in use by another application

## Security Considerations

- The server should be placed behind a reverse proxy in production
- Consider implementing rate limiting
- Regularly update yt-dlp to the latest version 