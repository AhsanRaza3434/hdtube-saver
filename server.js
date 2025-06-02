const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const https = require('https');

const app = express();
const PORT = 3000;

// Store conversion progress
const conversionProgress = new Map();

// Add this near the top of the file after the imports
const tempDir = path.join(__dirname, 'temp');

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Add this near the top of the file after the imports
const videoUrls = new Map();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Get video details endpoint
app.get('/api/video-details', async (req, res) => {
  try {
    const url = req.query.url;
  if (!url) {
      console.error('URL is missing from request');
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Fetching details for URL:', url);

    // Store the original URL
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('youtu.be/')[1]?.split('?')[0];
    if (videoId) {
      videoUrls.set(videoId, url);
      console.log('Stored video ID:', videoId);
    } else {
      console.warn('Could not extract video ID from URL:', url);
  }

    // Use yt-dlp to get video info
    const ytdlpProcess = spawn('yt-dlp', [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      url
    ]);

    let output = '';
    let errorOutput = '';

    ytdlpProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytdlpProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('yt-dlp stderr:', data.toString());
    });

    await new Promise((resolve, reject) => {
      ytdlpProcess.on('close', (code) => {
      if (code !== 0) {
          console.error('yt-dlp process failed with code:', code);
          console.error('Error output:', errorOutput);
          reject(new Error(`yt-dlp process failed with code ${code}`));
          return;
        }
        resolve();
      });
    });

    const videoInfo = JSON.parse(output);
    console.log('Raw formats from yt-dlp:', videoInfo.formats);
    console.log('Video info fetched successfully');

    // Helper to get size in MB, only from filesize, filesize_approx, or clen
    function getSizeMB(format) {
      let sizeBytes = format.filesize || format.filesize_approx || format.clen || null;
      if (!sizeBytes) return 'UNKNOWN';
      if (typeof sizeBytes === 'string') sizeBytes = parseInt(sizeBytes);
      if (isNaN(sizeBytes) || sizeBytes <= 0) return 'UNKNOWN';
      return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    // Process video formats: only direct video files, not manifests
    const seenResolutions = new Set();
    const videoFormats = videoInfo.formats
      .filter(format => {
        // Only direct video files, not manifests
        if (!format.url) return false;
        if (format.url.includes('manifest.googlevideo.com')) return false;
        if (format.url.endsWith('.m3u8') || format.url.endsWith('.mpd')) return false;
        if (format.vcodec === 'none') return false; // skip audio-only
        // Only show formats with a real size
        if (!format.filesize && !format.filesize_approx && !format.clen) return false;
        // Only mp4/webm containers
        if (!(format.ext === 'mp4' || format.ext === 'webm')) return false;
        // Only 240p and above
        const height = format.height || 0;
        if (height < 240) return false;
        return true;
      })
      .sort((a, b) => (b.height || 0) - (a.height || 0)) // Highest to lowest
      .filter(format => {
        // Only keep the best quality for each resolution
        const resKey = `${format.width || ''}x${format.height || ''}`;
        if (seenResolutions.has(resKey)) return false;
        seenResolutions.add(resKey);
        return true;
      })
      .map(format => ({
        itag: format.format_id,
        resolution: format.resolution || (format.height ? `${format.height}p` : 'unknown'),
            format: format.ext,
        size: getSizeMB(format),
            url: format.url,
        hasAudio: format.acodec !== 'none',
        needsMerging: format.acodec === 'none',
      }));

    // Process audio formats: best audio only, unique by abr
    const seenAudio = new Set();
    const audioFormats = videoInfo.formats
      .filter(format => format.vcodec === 'none' && format.acodec !== 'none' && format.url)
      .filter(format => format.abr && (format.filesize || format.filesize_approx || format.clen)) // Only with valid bitrate and size
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))
      .filter(format => {
        // Only keep the best for each bitrate
        const key = `${format.abr || format.format_id}`;
        if (seenAudio.has(key)) return false;
        seenAudio.add(key);
        return true;
      })
      .map(format => ({
        itag: format.format_id,
        quality: format.abr ? `${format.abr}kbps` : 'audio',
            format: format.ext,
        size: getSizeMB(format),
            url: format.url,
        abr: format.abr // Pass abr for frontend estimation if needed
      }));

    console.log('Processed formats:', {
      videoFormats: videoFormats.length,
      audioFormats: audioFormats.length
    });

    const response = {
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      videoFormats,
      audioFormats,
      originalUrl: url
    };

    console.log('Sending response for video:', videoInfo.title);
    res.json(response);
  } catch (error) {
    console.error('Detailed error in video-details endpoint:', {
      message: error.message,
      stack: error.stack,
      url: req.query.url
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch video details',
      details: error.message
    });
  }
});

// Also keep the POST endpoint for backward compatibility
app.post('/api/video-details', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Store the original URL
    const videoId = url.split('v=')[1]?.split('&')[0];
    if (videoId) {
      videoUrls.set(videoId, url);
    }

    const info = await ytdl.getInfo(url);
    const formats = ytdl.filterFormats(info.formats, 'videoandaudio');

    // Group formats by type
    const videoFormats = formats
      .filter(format => format.hasVideo)
      .map(format => ({
        itag: format.itag,
        quality: format.qualityLabel || format.quality,
        mimeType: format.mimeType,
        hasAudio: format.hasAudio,
        url: format.url,
        container: format.container,
        contentLength: format.contentLength,
        pairedAudio: format.hasAudio ? null : formats.find(f => f.hasAudio && !f.hasVideo)?.url
      }));

    const audioFormats = formats
      .filter(format => !format.hasVideo && format.hasAudio)
      .map(format => ({
        itag: format.itag,
        quality: format.audioQuality || 'audio',
        mimeType: format.mimeType,
            url: format.url,
        container: format.container,
        contentLength: format.contentLength
          }));

        res.json({
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails[0].url,
      videoFormats,
      audioFormats,
      originalUrl: url
    });
  } catch (error) {
    console.error('Error fetching video details:', error);
    res.status(500).json({ error: 'Failed to fetch video details' });
  }
});

// Download video using yt-dlp
app.get('/api/download', async (req, res) => {
  try {
    const { url, title } = req.query;
    if (!url || !title) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    const filename = `${sanitizedTitle}_HDTube.mp4`;
    const tempFilePath = path.join(__dirname, filename);

    // Check if the file exists
    if (!fs.existsSync(tempFilePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file to the response
    const fileStream = fs.createReadStream(tempFilePath);
    fileStream.pipe(res);

    // Clean up the file after sending
    fileStream.on('end', () => {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('Error deleting temporary file:', err);
      });
    });

  } catch (error) {
    console.error('Error in download endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/stream-merge', async (req, res) => {
  try {
    const { url, title, videoItag, audioItag } = req.body;
    if (!url || !title || !videoItag || !audioItag) {
      return res.status(400).json({ error: 'Video URL, title, videoItag, and audioItag are required' });
  }

    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('youtu.be/')[1]?.split('?')[0];
    const originalUrl = videoUrls.get(videoId) || url;
    const conversionId = Date.now().toString();
    const tempVideoPath = path.join(tempDir, `${conversionId}.video.mp4`);
    const tempAudioPath = path.join(tempDir, `${conversionId}.audio.m4a`);
    const tempFilePath = path.join(tempDir, `${conversionId}.mp4`);
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    const filename = `${sanitizedTitle}_HDTube.mp4`;

    // Initialize progress
    conversionProgress.set(conversionId, {
      progress: 0,
      status: 'starting',
      filename: filename,
      filePath: tempFilePath
    });

    // Return the conversion ID immediately
    res.json({ conversionId: conversionId });

    // Download video stream
    let lastVideoProgress = 0;
    const videoProc = spawn('yt-dlp', [
      '-f', videoItag,
      '-o', tempVideoPath,
      '--newline',
      '--progress',
      '--no-simulate',
      '--no-warnings',
      originalUrl
    ]);

    console.log('Starting video download with command:', videoProc.spawnargs.join(' '));

    videoProc.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('Video download raw output:', output);

      // Try different progress patterns
      const patterns = [
        /\[download\]\s+(\d+\.?\d*)%/,
        /(\d+\.?\d*)%/,
        /Downloading.*?(\d+\.?\d*)%/
      ];

      for (const pattern of patterns) {
        const match = output.match(pattern);
        if (match) {
          const progress = Math.round(parseFloat(match[1]));
          console.log('Found progress match:', progress, 'using pattern:', pattern);
          if (progress > lastVideoProgress) {
            lastVideoProgress = progress;
            const videoProgress = Math.min(progress, 45); // up to 45% for video
            console.log('Setting video progress:', videoProgress);
            conversionProgress.set(conversionId, {
              progress: videoProgress,
              status: 'downloading video',
              filename: filename,
              filePath: tempFilePath
            });
            break;
          }
        }
      }
    });

    videoProc.on('close', (code) => {
      console.log('Video download completed with code:', code);
      if (code !== 0) {
        console.error('Failed to download video stream');
        // Clean up temp files on error
        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
        if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        conversionProgress.set(conversionId, {
          progress: 0,
          status: 'error',
          filename: filename,
          filePath: tempFilePath
        });
        return;
      }

      // Download audio stream
      let lastAudioProgress = 0;
      const audioProc = spawn('yt-dlp', [
        '-f', audioItag,
        '-o', tempAudioPath,
        '--newline',
        '--progress',
        '--no-simulate',
        '--no-warnings',
        originalUrl
      ]);

      console.log('Starting audio download with command:', audioProc.spawnargs.join(' '));

      audioProc.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('Audio download raw output:', output);

        // Try different progress patterns
        const patterns = [
          /\[download\]\s+(\d+\.?\d*)%/,
          /(\d+\.?\d*)%/,
          /Downloading.*?(\d+\.?\d*)%/
        ];

        for (const pattern of patterns) {
          const match = output.match(pattern);
          if (match) {
            const progress = Math.round(parseFloat(match[1]));
            console.log('Found progress match:', progress, 'using pattern:', pattern);
            if (progress > lastAudioProgress) {
              lastAudioProgress = progress;
              // Progress: video (45%) + audio (45%)
              const totalProgress = Math.min(45, lastVideoProgress) + Math.round(progress * 0.45);
              console.log('Setting audio progress:', totalProgress);
              conversionProgress.set(conversionId, {
                progress: Math.min(totalProgress, 90),
                status: 'downloading audio',
                filename: filename,
                filePath: tempFilePath
              });
              break;
            }
          }
        }
      });

      audioProc.on('close', (code2) => {
        console.log('Audio download completed with code:', code2);
        if (code2 !== 0) {
          console.error('Failed to download audio stream');
          // Clean up temp files on error
          if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
          if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          conversionProgress.set(conversionId, {
            progress: 0,
            status: 'error',
            filename: filename,
            filePath: tempFilePath
          });
          return;
        }

        // Merging with ffmpeg
        conversionProgress.set(conversionId, {
          progress: 95,
          status: 'merging',
          filename: filename,
          filePath: tempFilePath
        });

        const ffmpegProc = spawn('ffmpeg', [
          '-i', tempVideoPath,
          '-i', tempAudioPath,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-ar', '44100',
          '-ac', '2',
          '-movflags', '+faststart',
          '-y', tempFilePath
        ]);

        console.log('Starting FFmpeg merge with command:', ffmpegProc.spawnargs.join(' '));

        ffmpegProc.stderr.on('data', (data) => {
          const output = data.toString();
          console.log('FFmpeg output:', output);
        });

        ffmpegProc.on('close', (code3) => {
          console.log('FFmpeg merge completed with code:', code3);
          // Always clean up temp video/audio
          if (fs.existsSync(tempVideoPath)) fs.unlink(tempVideoPath, () => {});
          if (fs.existsSync(tempAudioPath)) fs.unlink(tempAudioPath, () => {});
          if (code3 !== 0) {
            console.error('Failed to merge video and audio');
            // Clean up merged file on error
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            conversionProgress.set(conversionId, {
              progress: 0,
              status: 'error',
              filename: filename,
              filePath: tempFilePath
            });
            return;
          }

          // Set final progress
          conversionProgress.set(conversionId, {
            progress: 100,
            status: 'completed',
            filename: filename,
            filePath: tempFilePath
          });
        });
      });
    });
  } catch (error) {
    console.error('Error in stream-merge:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update the /api/download-merged endpoint
app.get('/api/download-merged', (req, res) => {
  const { conversionId } = req.query;

  if (!conversionId) {
    return res.status(400).json({ error: 'Conversion ID is required' });
  }

  const progress = conversionProgress.get(conversionId);
  if (!progress) {
    console.error('Conversion not found:', conversionId);
    return res.status(404).json({ error: 'Conversion not found' });
  }

  if (progress.status !== 'completed') {
    console.error('Conversion not completed:', progress.status);
    return res.status(400).json({ error: 'Conversion not completed yet' });
  }

  const tempFilePath = progress.filePath;
  if (!tempFilePath) {
    console.error('No file path found for conversion:', conversionId);
    return res.status(404).json({ error: 'File path not found' });
  }

  // Check if the file exists
  if (!fs.existsSync(tempFilePath)) {
    // Clean up progress entry if file is missing
    conversionProgress.delete(conversionId);
    return res.status(404).json({ error: 'File not found' });
  }

  // Set headers for MP4 download
  res.setHeader('Content-Disposition', `attachment; filename="${progress.filename}"`);
  res.setHeader('Content-Type', 'video/mp4');
  
  // Stream the file to the response
  const fileStream = fs.createReadStream(tempFilePath);
  fileStream.pipe(res);

  const cleanup = () => {
    if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    conversionProgress.delete(conversionId);
  };

  fileStream.on('end', cleanup);
  fileStream.on('error', cleanup);
  res.on('close', cleanup); // Clean up if user disconnects
});

app.post('/api/convert-to-mp4', async (req, res) => {
  try {
    const { url, title, itag } = req.body;
    console.log('convert-to-mp4 received:', { url, title, itag });
    if (!url || !title || !itag) {
      return res.status(400).json({ error: 'Video URL, title, and itag are required' });
    }

    // Get the original YouTube URL
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('youtu.be/')[1]?.split('?')[0];
    const originalUrl = videoUrls.get(videoId) || url;

    // Get video info using yt-dlp
    const ytdlpProcess = spawn('yt-dlp', [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      originalUrl
    ]);
    let output = '';
    ytdlpProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    await new Promise((resolve, reject) => {
      ytdlpProcess.on('close', (code) => {
        if (code !== 0) reject(new Error('yt-dlp failed'));
        else resolve();
      });
    });
    const videoInfo = JSON.parse(output);
    const availableItags = videoInfo.formats.map(f => f.format_id);
    console.log('Available format_ids:', availableItags);
    const selectedFormat = videoInfo.formats.find(f => f.format_id == itag);
    if (!selectedFormat) {
      console.error('Selected itag not found:', itag, 'Available:', availableItags);
      return res.status(400).json({ error: 'Selected video format not found' });
    }

    const conversionId = Date.now().toString();
    const tempFilePath = path.join(tempDir, `${conversionId}.mp4`);
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    const filename = `${sanitizedTitle}_HDTube.mp4`;

    // Initialize progress
    conversionProgress.set(conversionId, {
      progress: 0,
      status: 'starting',
      filename: filename,
      filePath: tempFilePath
    });

    // Return the conversion ID immediately
    res.json({ conversionId: conversionId });

    // Download using yt-dlp with specific format
    const downloadProcess = spawn('yt-dlp', [
      '-f', itag,
      '-o', tempFilePath,
      originalUrl
    ]);

    downloadProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('Download progress:', output);
      
      // Extract progress from output
      const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%/);
      if (progressMatch) {
        const progress = Math.round(parseFloat(progressMatch[1]));
        conversionProgress.set(conversionId, {
          progress: progress,
          status: 'converting',
          filename: filename,
          filePath: tempFilePath
        });
      }
    });

    downloadProcess.on('close', (code) => {
    if (code !== 0) {
        // Clean up temp file on error
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        conversionProgress.set(conversionId, {
          progress: 0,
          status: 'error',
          filename: filename,
          filePath: tempFilePath
        });
        return;
      }

      conversionProgress.set(conversionId, {
        progress: 100,
        status: 'completed',
        filename: filename,
        filePath: tempFilePath
      });
    });
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    console.error('Error in convert-to-mp4:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update the /api/conversion-progress endpoint
app.get('/api/conversion-progress', (req, res) => {
  const { conversionId } = req.query;
  
  if (!conversionId) {
    return res.status(400).json({ error: 'Conversion ID is required' });
  }

  const progress = conversionProgress.get(conversionId);
  if (!progress) {
    return res.status(404).json({ error: 'Conversion not found' });
  }

  res.json(progress);
});

// Add audio-to-mp3 endpoint
app.post('/api/audio-to-mp3', async (req, res) => {
  try {
    const { url, title, audioItag, abr } = req.body;
    if (!url || !title || !audioItag) {
      return res.status(400).json({ error: 'Audio URL, title, and audioItag are required' });
    }

    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('youtu.be/')[1]?.split('?')[0];
    const originalUrl = videoUrls.get(videoId) || url;
    const conversionId = Date.now().toString();
    const tempAudioPath = path.join(tempDir, `${conversionId}.audio`);
    const tempMp3Path = path.join(tempDir, `${conversionId}.mp3`);
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    const filename = `${sanitizedTitle}_HDTube.mp3`;

    // Get video info for expected size
    let expectedSize = null;
    try {
      const ytdlpInfo = await new Promise((resolve, reject) => {
        const proc = spawn('yt-dlp', [
          '--dump-json',
          '--no-playlist',
          '--no-warnings',
          originalUrl
        ]);
        let output = '';
        proc.stdout.on('data', (data) => { output += data.toString(); });
        proc.on('close', (code) => {
          if (code !== 0) reject(new Error('yt-dlp info failed'));
          else resolve(JSON.parse(output));
        });
      });
      const format = ytdlpInfo.formats.find(f => f.format_id == audioItag);
      if (format) {
        expectedSize = format.filesize || format.filesize_approx || format.clen || null;
        console.log(`[audio-to-mp3] For itag ${audioItag}, expected size: ${expectedSize} bytes`);
      } else {
        console.warn(`[audio-to-mp3] Could not find format for itag ${audioItag}`);
      }
    } catch (e) {
      console.warn('[audio-to-mp3] Could not fetch expected size:', e.message);
    }

    // Initialize progress
    conversionProgress.set(conversionId, {
      progress: 0,
      status: 'starting',
      filename: filename,
      filePath: tempMp3Path
    });

    // Return the conversion ID immediately
    res.json({ conversionId: conversionId });

    // Log the yt-dlp command
    const ytdlpArgs = [
      '-f', `${audioItag}`,
      '--no-playlist',
      '--no-part',
      '--no-mtime',
      '--no-continue',
      '--no-overwrites',
      '--no-check-certificate',
      '--no-call-home',
      '--no-cache-dir',
      '-o', tempAudioPath,
      '--newline',
      '--progress',
      '--no-simulate',
      '--no-warnings',
      originalUrl
    ];
    console.log(`[audio-to-mp3] conversionId=${conversionId}, itag=${audioItag}, tempAudioPath=${tempAudioPath}, tempMp3Path=${tempMp3Path}`);
    console.log('yt-dlp command:', 'yt-dlp', ytdlpArgs.join(' '));

    // Download audio stream
    const audioProc = spawn('yt-dlp', ytdlpArgs);

    audioProc.stdout.on('data', (data) => {
      console.log('yt-dlp stdout:', data.toString());
    });
    audioProc.stderr.on('data', (data) => {
      console.log('yt-dlp stderr:', data.toString());
      const output = data.toString();
      const match = output.match(/\[download\]\s+(\d+\.?\d+)%/);
      if (match) {
        const progress = Math.round(parseFloat(match[1]) * 0.7); // 70% for download
        conversionProgress.set(conversionId, {
          progress: progress,
          status: 'downloading audio',
          filename: filename,
          filePath: tempMp3Path
        });
      }
    });

    audioProc.on('close', (code) => {
      let actualSize = null;
      if (fs.existsSync(tempAudioPath)) {
        const stats = fs.statSync(tempAudioPath);
        actualSize = stats.size;
        console.log(`[audio-to-mp3] Downloaded audio file size (bytes):`, actualSize);
        if (expectedSize && Math.abs(actualSize - expectedSize) > 1024 * 100) {
          console.warn(`[audio-to-mp3] WARNING: Downloaded file size (${actualSize}) does not match expected size (${expectedSize}) for itag ${audioItag}`);
        }
      } else {
        console.log('[audio-to-mp3] Downloaded audio file not found:', tempAudioPath);
      }
      if (code !== 0) {
        // Clean up temp files on error
        if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
        if (fs.existsSync(tempMp3Path)) fs.unlinkSync(tempMp3Path);
        conversionProgress.set(conversionId, {
          progress: 0,
          status: 'error',
          filename: filename,
          filePath: tempMp3Path
        });
        return;
      }

      // Convert to MP3
      const ffmpegProc = spawn('ffmpeg', [
        '-i', tempAudioPath,
        '-vn',
        '-ar', '44100',
        '-ac', '2',
        '-b:a', abr || '128k',
        '-y',
        tempMp3Path
      ]);

      ffmpegProc.stderr.on('data', (data) => {
        // Optionally parse progress here
        conversionProgress.set(conversionId, {
          progress: 90,
          status: 'converting to mp3',
          filename: filename,
          filePath: tempMp3Path
  });
});

      ffmpegProc.on('close', (code2) => {
        if (fs.existsSync(tempAudioPath)) fs.unlink(tempAudioPath, () => {});
        if (code2 !== 0) {
          // Clean up mp3 file on error
          if (fs.existsSync(tempMp3Path)) fs.unlinkSync(tempMp3Path);
          conversionProgress.set(conversionId, {
            progress: 0,
            status: 'error',
            filename: filename,
            filePath: tempMp3Path
          });
          return;
        }
        // Log final MP3 file size
        if (fs.existsSync(tempMp3Path)) {
          const stats = fs.statSync(tempMp3Path);
          console.log(`[audio-to-mp3] Final MP3 file size (bytes):`, stats.size);
        }
        conversionProgress.set(conversionId, {
          progress: 100,
          status: 'completed',
          filename: filename,
          filePath: tempMp3Path
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add download-audio-mp3 endpoint
app.get('/api/download-audio-mp3', (req, res) => {
  const { conversionId } = req.query;

  if (!conversionId) {
    return res.status(400).json({ error: 'Conversion ID is required' });
  }

  const progress = conversionProgress.get(conversionId);
  if (!progress) {
    return res.status(404).json({ error: 'Conversion not found' });
  }

  if (progress.status !== 'completed') {
    return res.status(400).json({ error: 'Conversion not completed yet' });
  }

  const tempFilePath = progress.filePath;
  if (!tempFilePath) {
    return res.status(404).json({ error: 'File path not found' });
  }

  if (!fs.existsSync(tempFilePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Log download details
  const stats = fs.statSync(tempFilePath);
  console.log(`[download-audio-mp3] conversionId=${conversionId}, filePath=${tempFilePath}, size=${stats.size}`);

  res.setHeader('Content-Disposition', `attachment; filename="${progress.filename}"`);
  res.setHeader('Content-Type', 'audio/mpeg');

  const fileStream = fs.createReadStream(tempFilePath);
  fileStream.pipe(res);

  const cleanup = () => {
    if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    conversionProgress.delete(conversionId);
  };

  fileStream.on('end', cleanup);
  fileStream.on('error', cleanup);
  res.on('close', cleanup); // Clean up if user disconnects
});

// Periodic temp file cleanup job (runs every 15 minutes, only deletes files older than 15 minutes)
setInterval(() => {
  const activeFiles = new Set();
  for (const entry of conversionProgress.values()) {
    if (entry.filePath) activeFiles.add(entry.filePath);
  }
  fs.readdir(tempDir, (err, files) => {
    if (err) return;
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);
        if (!activeFiles.has(filePath) && ageMinutes > 15) {
          fs.unlink(filePath, (err) => {
            if (!err) {
              console.log('Periodic cleanup: deleted orphaned temp file', filePath);
            }
          });
        }
      });
    });
  });
}, 15 * 60 * 1000); // Every 15 minutes

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
