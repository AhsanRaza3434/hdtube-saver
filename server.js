const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.set('trust proxy', 1);
app.use(compression());
app.use(cors({ origin: '*' }));

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'REDACTED_RAPIDAPI_KEY';
const RAPIDAPI_HOST = 'youtube-video-fast-downloader-24-7.p.rapidapi.com';

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
const conversionProgress = new Map();

function extractVideoId(url) {
  let videoId = url.split('v=')[1]?.split('&')[0];
  if (!videoId) videoId = url.split('youtu.be/')[1]?.split('?')[0];
  return videoId;
}

// 1. GET VIDEO DETAILS
app.get('/api/video-details', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

    console.log('Fetching details for:', videoId);
    
    const response = await axios.get(`https://${RAPIDAPI_HOST}/get-video-info/${videoId}?return_available_quality=false&response_mode=default`, {
      headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': RAPIDAPI_KEY }
    });
    const data = response.data;

    function getSizeMB(size) {
      if (!size) return 'UNKNOWN';
      return (size / (1024 * 1024)).toFixed(2) + ' MB';
    }

    const videoFormats = data.availableQuality.filter(q => q.type === 'video').map(q => ({
      itag: q.id,
      resolution: q.quality,
      format: q.mime ? q.mime.split(';')[0].replace('video/', '') : 'mp4',
      size: getSizeMB(q.size),
      hasAudio: true, // Assuming RapidAPI merges them
      needsMerging: false
    }));

    const audioFormats = data.availableQuality.filter(q => q.type === 'audio').map(q => ({
      itag: q.id,
      quality: q.quality || (q.bitrate ? Math.round(parseInt(q.bitrate)/1000)+'kbps' : 'audio'),
      format: q.mime ? q.mime.split(';')[0].replace('audio/', '') : 'mp3',
      size: getSizeMB(q.size)
    }));

    res.json({
      title: data.title,
      thumbnail: data.thumbnail && data.thumbnail.length > 0 ? data.thumbnail[data.thumbnail.length - 1].url : null,
      videoFormats,
      audioFormats,
      originalUrl: url
    });
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch video details' });
  }
});

// Helper: Download from RapidAPI URL directly to tempDir
async function downloadRapidApiFile(conversionId, rapidApiUrl, finalFilename, res) {
  const filePath = path.join(tempDir, finalFilename);
  conversionProgress.set(conversionId, { progress: 0, status: 'Preparing file on API server...', filename: finalFilename, filePath });
  res.json({ conversionId });

  // Poll until it's ready
  let readyUrl = null;
  for (let i = 0; i < 60; i++) {
    try {
      conversionProgress.set(conversionId, { progress: Math.min(10 + i, 80), status: 'Preparing file on API server...', filename: finalFilename, filePath });
      const headCheck = await axios.head(rapidApiUrl, { timeout: 5000 });
      if (headCheck.status === 200) {
        readyUrl = rapidApiUrl;
        break;
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  if (!readyUrl) {
    conversionProgress.set(conversionId, { progress: 0, status: 'error', filename: finalFilename, filePath });
    return;
  }

  conversionProgress.set(conversionId, { progress: 85, status: 'Downloading to our server...', filename: finalFilename, filePath });
  try {
    const fileResponse = await axios({
      method: 'GET',
      url: readyUrl,
      responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(filePath);
    fileResponse.data.pipe(writer);
    
    writer.on('finish', () => {
      conversionProgress.set(conversionId, { progress: 100, status: 'completed', filename: finalFilename, filePath });
    });
    writer.on('error', () => {
      conversionProgress.set(conversionId, { progress: 0, status: 'error', filename: finalFilename, filePath });
    });
  } catch (e) {
    conversionProgress.set(conversionId, { progress: 0, status: 'error', filename: finalFilename, filePath });
  }
}

app.get('/api/progress', (req, res) => {
  const data = conversionProgress.get(req.query.conversionId);
  if (data) res.json(data);
  else res.status(404).json({ error: 'not found' });
});

app.get('/api/convert', async (req, res) => {
  try {
    const videoId = extractVideoId(req.query.url);
    const itag = req.query.videoItag;
    const conversionId = Date.now().toString();
    const filename = (req.query.title || 'video').replace(/[^a-z0-9]/gi, '_') + '.mp4';
    
    const rapidRes = await axios.get(`https://${RAPIDAPI_HOST}/download_video/${videoId}?quality=${itag}`, {
      headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': RAPIDAPI_KEY }
    });
    
    downloadRapidApiFile(conversionId, rapidRes.data.file, filename, res);
  } catch (e) {
    res.status(500).json({ error: 'error' });
  }
});

app.get('/api/merge', async (req, res) => {
  try {
    const videoId = extractVideoId(req.query.url);
    const itag = req.query.videoItag;
    const conversionId = Date.now().toString();
    const filename = (req.query.title || 'video').replace(/[^a-z0-9]/gi, '_') + '.mp4';
    
    const rapidRes = await axios.get(`https://${RAPIDAPI_HOST}/download_video/${videoId}?quality=${itag}`, {
      headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': RAPIDAPI_KEY }
    });
    
    downloadRapidApiFile(conversionId, rapidRes.data.file, filename, res);
  } catch (e) {
    res.status(500).json({ error: 'error' });
  }
});

app.get('/api/audio-to-mp3', async (req, res) => {
  try {
    const videoId = extractVideoId(req.query.url);
    const itag = req.query.audioItag;
    const conversionId = Date.now().toString();
    const filename = (req.query.title || 'audio').replace(/[^a-z0-9]/gi, '_') + '.mp3';
    
    const rapidRes = await axios.get(`https://${RAPIDAPI_HOST}/download_audio/${videoId}?quality=${itag}`, {
      headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': RAPIDAPI_KEY }
    });
    
    downloadRapidApiFile(conversionId, rapidRes.data.file, filename, res);
  } catch (e) {
    res.status(500).json({ error: 'error' });
  }
});

const handleDownload = (req, res) => {
  const data = conversionProgress.get(req.query.conversionId);
  if (!data || data.status !== 'completed' || !fs.existsSync(data.filePath)) return res.status(404).json({error: 'File not ready'});
  res.download(data.filePath, data.filename, () => {
    fs.unlink(data.filePath, ()=>{});
    conversionProgress.delete(req.query.conversionId);
  });
};

app.get('/api/download-merged', handleDownload);
app.get('/api/download-audio-mp3', handleDownload);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.listen(PORT, () => console.log('Server running on', PORT));
