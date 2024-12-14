const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { spawn } = require('child_process');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Fetch video details using yt-dlp
app.post('/api/video-details', (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    console.log('Fetching video details for:', url);
    const ytDlpPath = process.platform === 'win32'
  ? `${process.env.USERPROFILE}\\bin\\yt-dlp`
  : `${process.env.HOME}/bin/yt-dlp`;
    const process = spawn(ytDlpPath, ['-j', url]);    

    let output = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      console.error('Error fetching video details:', data.toString());
    });

    process.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: 'Failed to fetch video details' });
      }

      try {
        const videoDetails = JSON.parse(output);

        const formats = videoDetails.formats
          .filter(
            (format) =>
              format.ext === 'mp4' && // Only MP4
              format.url && // Must have a URL
              (format.filesize || format.filesize_approx || format.tbr) // Must have size or bitrate info
          )
          .reduce((acc, format) => {
            const resolution = format.resolution || `${format.width}x${format.height}`;
            if (!acc[resolution]) {
              acc[resolution] = format;
            } else {
              // Prioritize formats with more detailed info (filesize > filesize_approx > tbr)
              const existing = acc[resolution];
              if (format.filesize || format.filesize_approx || format.tbr > existing.tbr) {
                acc[resolution] = format;
              }
            }
            return acc;
          }, {});

        const filteredFormats = Object.values(formats).map((format) => ({
          quality: format.quality_label || format.resolution || 'Unknown',
          format: format.ext || 'Unknown',
          size: format.filesize
            ? (format.filesize / (1024 * 1024)).toFixed(2) + ' MB'
            : format.filesize_approx
            ? (format.filesize_approx / (1024 * 1024)).toFixed(2) + ' MB'
            : format.tbr
            ? `${(format.tbr / 8).toFixed(2)} KBps`
            : 'Unknown',
          resolution: format.resolution || `${format.width}x${format.height}` || 'Unknown',
          fps: format.fps || 'Unknown',
          url: format.url,
        }));

        res.json({
          title: videoDetails.title,
          thumbnail: videoDetails.thumbnail,
          formats: filteredFormats.sort((a, b) => parseInt(a.resolution) - parseInt(b.resolution)), // Sort by resolution
        });
      } catch (err) {
        console.error('Error parsing video details:', err.message);
        res.status(500).json({ error: 'Error parsing video details' });
      }
    });
  } catch (error) {
    console.error('Error fetching video details:', error.message);
    res.status(500).json({ error: 'Error fetching video details' });
  }
});

// Download video using yt-dlp
app.get('/api/download', (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    console.log('Starting download for:', url);

    // Redirect to the video URL directly for download
    res.redirect(url);
  } catch (error) {
    console.error('Error during video download:', error.message);
    res.status(500).json({ error: 'Error during video download' });
  }
});
console.log('Runtime PATH:', process.env.PATH);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
