const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { rateLimit } = require('express-rate-limit');

// Local development: load RAPIDAPI_KEY and other settings from a git-ignored .env file.
// On Render the values come from the dashboard, and no .env file exists.
if (typeof process.loadEnvFile === 'function' && fs.existsSync(path.join(__dirname, '.env'))) {
  process.loadEnvFile(path.join(__dirname, '.env'));
}

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.set('trust proxy', 1);
app.use(compression());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '32kb' }));

app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait and try again.' }
}));

const conversionRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many download requests. Please wait before starting another.' }
});

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'youtube-video-fast-downloader-24-7.p.rapidapi.com';
if (!RAPIDAPI_KEY) {
  console.error('FATAL: RAPIDAPI_KEY environment variable is not set.');
  process.exit(1);
}

const crypto = require('crypto');
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
const conversionProgress = new Map();

// Unique per-request ID: used both as conversionId and as the on-disk filename,
// so two users downloading the same video never overwrite each other.
function newConversionId() {
  return crypto.randomBytes(12).toString('hex');
}

// Drop finished/abandoned conversions (and their files) after 30 minutes.
const MAX_AGE_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of conversionProgress) {
    if (now - (data.createdAt || now) > MAX_AGE_MS) {
      if (data.filePath) fs.unlink(data.filePath, () => {});
      conversionProgress.delete(id);
    }
  }
}, 5 * 60 * 1000).unref();

function extractVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getSizeMB(size) {
  if (!size) return 'UNKNOWN';
  return (size / (1024 * 1024)).toFixed(2) + ' MB';
}

function getCodecScore(mime) {
  if (!mime) return 0;
  if (mime.includes('avc1')) return 100; // Prefer standard MP4/H264
  if (mime.includes('vp09')) return 50;
  return 0; // AV1 usually fails on some API merges
}

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

    const seenResolutions = new Set();
    const videoFormats = data.availableQuality
      .filter(q => q.type === 'video')
      .sort((a, b) => {
        // Sort highest resolution first
        const resA = parseInt(a.quality);
        const resB = parseInt(b.quality);
        if (resA !== resB) return resB - resA;
        // If same resolution, prefer avc1
        return getCodecScore(b.mime) - getCodecScore(a.mime);
      })
      .filter(q => {
        if (seenResolutions.has(q.quality)) return false;
        seenResolutions.add(q.quality);
        return true;
      })
      .map(q => ({
        itag: q.id,
        resolution: q.quality,
        format: q.mime ? q.mime.split(';')[0].replace('video/', '') : 'mp4',
        size: getSizeMB(q.size),
        hasAudio: true,
        needsMerging: false
      }));

    const seenAudio = new Set();
    const audioFormats = data.availableQuality
      .filter(q => q.type === 'audio' && q.id && String(q.id) !== '0' && q.size > 0 && parseInt(q.bitrate) > 0)
      .sort((a, b) => parseInt(b.bitrate) - parseInt(a.bitrate))
      .map(q => ({ q, kbps: Math.round(parseInt(q.bitrate) / 1000) }))
      .filter(({ kbps }) => {
        if (seenAudio.has(kbps)) return false;
        seenAudio.add(kbps);
        return true;
      })
      .map(({ q, kbps }) => ({
        itag: q.id,
        quality: `${kbps}kbps`,
        abr: kbps,
        format: 'm4a', // RapidAPI's download_audio always returns an M4A (AAC) file
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

// Poll RapidAPI until the prepared file exists, then stream it to tempDir.
// The on-disk name is the unique conversionId; `filename` is only the name shown to the user.
async function prepareFile(conversionId, rapidApiUrl, filename, ext) {
  const filePath = path.join(tempDir, `${conversionId}.${ext}`);
  const createdAt = Date.now();
  const set = (progress, status) =>
    conversionProgress.set(conversionId, { progress, status, filename, filePath, createdAt });

  set(5, 'Preparing file on API server...');

  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {          // ~5 minutes max (RapidAPI says 20-300s)
    set(Math.min(10 + i, 80), 'Preparing file on API server...');
    try {
      const head = await axios.head(rapidApiUrl, { timeout: 5000 });
      ready = head.status === 200;
    } catch (e) { /* 404 until ready */ }
    if (!ready) await new Promise(r => setTimeout(r, 3000));
  }
  if (!ready) return set(0, 'error');

  set(85, 'Downloading to our server...');
  try {
    const fileResponse = await axios({ method: 'GET', url: rapidApiUrl, responseType: 'stream', timeout: 120000 });
    const writer = fs.createWriteStream(filePath);
    fileResponse.data.pipe(writer);
    writer.on('finish', () => set(100, 'completed'));
    writer.on('error', () => set(0, 'error'));
    fileResponse.data.on('error', () => { writer.destroy(); set(0, 'error'); });
  } catch (e) {
    set(0, 'error');
  }
}

function safeTitle(title, fallback) {
  return (title || fallback).replace(/[^a-z0-9]/gi, '_').substring(0, 80) || fallback;
}

// Shared handler for all three "start" endpoints.
function startConversion(kind, itagField, ext) {
  return async (req, res) => {
    const videoId = extractVideoId(req.body && req.body.url);
    const itag = req.body && req.body[itagField];
    if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });
    if (!itag || !/^\d+$/.test(String(itag))) return res.status(400).json({ error: 'Invalid format id' });

    try {
      const endpoint = kind === 'audio' ? 'download_audio' : 'download_video';
      const rapidRes = await axios.get(`https://${RAPIDAPI_HOST}/${endpoint}/${videoId}?quality=${itag}`, {
        headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': RAPIDAPI_KEY },
        timeout: 20000
      });
      if (!rapidRes.data || !rapidRes.data.file) {
        console.error(`${endpoint} returned no file:`, rapidRes.data);
        return res.status(502).json({ error: 'Upstream did not return a file' });
      }
      const conversionId = newConversionId();
      const filename = `${safeTitle(req.body.title, kind)}.${ext}`;
      // Register state before responding so the first progress poll never 404s
      conversionProgress.set(conversionId, { progress: 0, status: 'starting', filename, filePath: null, createdAt: Date.now() });
      res.json({ conversionId });
      prepareFile(conversionId, rapidRes.data.file, filename, ext);
    } catch (e) {
      console.error(`${kind} start error:`, e.response ? e.response.data : e.message);
      res.status(502).json({ error: 'Failed to start conversion' });
    }
  };
}

app.get('/api/conversion-progress', (req, res) => {
  const data = conversionProgress.get(req.query.conversionId);
  if (!data) return res.status(404).json({ error: 'not found' });
  res.json({ progress: data.progress, status: data.status, filename: data.filename }); // don't leak server paths
});

app.post('/api/convert-to-mp4', conversionRateLimit, startConversion('video', 'itag', 'mp4'));
// RapidAPI returns video already muxed with audio, so stream-merge only needs the video itag.
app.post('/api/stream-merge', conversionRateLimit, startConversion('video', 'videoItag', 'mp4'));
app.post('/api/audio-to-mp3', conversionRateLimit, startConversion('audio', 'audioItag', 'm4a')); // route name kept for frontend compatibility

const handleDownload = (req, res) => {
  const id = req.query.conversionId;
  const data = conversionProgress.get(id);
  if (!data || data.status !== 'completed' || !data.filePath || !fs.existsSync(data.filePath)) {
    return res.status(404).json({ error: 'File not ready' });
  }
  res.download(data.filePath, data.filename, () => {
    fs.unlink(data.filePath, () => {});
    conversionProgress.delete(id);
  });
};

app.get('/api/download-merged', handleDownload);
app.get('/api/download-audio-mp3', handleDownload);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.listen(PORT, () => console.log('Server running on', PORT));
