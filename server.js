const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { exec, spawn } = require('child_process');
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;


// Middleware
app.use(bodyParser.json());
app.use(cors());

// Dynamically find the yt-dlp executable path
exec("which yt-dlp", (error, stdout, stderr) => {
  if (error) {
    console.error("yt-dlp not found", stderr);
    return;
  }
  const ytDlpPath = stdout.trim(); // Remove any new line

  // Log the found path
  console.log(`Found yt-dlp at: ${ytDlpPath}`);

  app.post("/api/video-details", (req, res) => {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    try {
      const ytDlpProcess = spawn(ytDlpPath, ["-j", url]);

      let output = "";
      ytDlpProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      ytDlpProcess.stderr.on("data", (data) => {
        console.error("Error:", data.toString());
      });

      ytDlpProcess.on("close", (code) => {
        if (code !== 0) {
          return res
            .status(500)
            .json({ error: "Failed to fetch video details" });
        }

        try {
          const videoDetails = JSON.parse(output);

          // Get video formats that include both video and audio
          let videoFormats = videoDetails.formats
            .filter(
              (format) =>
                format.ext === "mp4" && // Must be MP4
                format.url && // Must have a URL
                format.acodec !== "none" && // Includes audio
                format.vcodec !== "none" && // Includes video
                (format.filesize || format.filesize_approx) // Must have size information
            )
            .map((format) => ({
              resolution:
                format.resolution ||
                `${format.width}x${format.height}` ||
                "Unknown",
              quality: format.quality_label || "Unknown",
              format: format.ext,
              size: format.filesize
                ? `${(format.filesize / (1024 * 1024)).toFixed(2)} MB`
                : format.filesize_approx
                ? `${(format.filesize_approx / (1024 * 1024)).toFixed(2)} MB`
                : "Unknown",
              url: format.url,
            }));

          // If no video formats with audio, pair best audio with video-only formats
          if (videoFormats.length === 0) {
            const videoOnlyFormats = videoDetails.formats.filter(
              (format) =>
                format.vcodec !== "none" &&
                format.acodec === "none" &&
                format.url // Video-only formats
            );
            const bestAudio = videoDetails.formats
              .filter(
                (format) =>
                  format.acodec !== "none" &&
                  format.vcodec === "none" &&
                  format.url
              ) // Audio-only formats
              .sort((a, b) => b.abr - a.abr)[0]; // Best audio format

            videoFormats = videoOnlyFormats.map((format) => ({
              resolution:
                format.resolution ||
                `${format.width}x${format.height}` ||
                "Unknown",
              quality: format.quality_label || "Unknown",
              format: format.ext,
              size: format.filesize
                ? `${(format.filesize / (1024 * 1024)).toFixed(2)} MB`
                : format.filesize_approx
                ? `${(format.filesize_approx / (1024 * 1024)).toFixed(2)} MB`
                : "Unknown",
              url: format.url,
              pairedAudio: bestAudio ? bestAudio.url : null, // Pair video-only with audio
            }));
          }

          // Deduplicate formats by resolution
          const uniqueVideoFormats = Object.values(
            videoFormats.reduce((acc, format) => {
              if (
                acc[format.resolution] &&
                parseFloat(format.size) >
                  parseFloat(acc[format.resolution].size)
              ) {
                return acc; // Keep the smaller size
              }
              acc[format.resolution] = format;
              return acc;
            }, {})
          );

          // Get valid audio formats
          const audioFormats = videoDetails.formats
            .filter(
              (format) =>
                (format.ext === "mp3" || format.ext === "webm") && // Allow MP3 and WebM formats
                format.url && // Must have a URL
                format.acodec !== "none" && // Must include audio
                format.vcodec === "none" // Exclude video
            )
            .sort((a, b) => b.abr - a.abr) // Sort by bitrate (highest first)
            .map((format) => ({
              quality: format.abr
                ? `${Math.round(format.abr)} kbps`
                : "Unknown",
              format: format.ext,
              size: format.filesize
                ? `${(format.filesize / (1024 * 1024)).toFixed(2)} MB`
                : "Unknown",
              url: format.url,
            }));

          // Send response
          res.json({
            title: videoDetails.title,
            thumbnail: videoDetails.thumbnail,
            videoFormats: uniqueVideoFormats,
            audioFormats: audioFormats,
          });
        } catch (err) {
          console.error("Error parsing video details:", err.message);
          res.status(500).json({ error: "Error parsing video details" });
        }
      });
    } catch (error) {
      console.error("Error:", error.message);
      res.status(500).json({ error: "Error fetching video details" });
    }
  });
});

// Download video using yt-dlp
app.get("/api/download", (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    // console.log('Starting download for:', url);

    // Redirect to the video URL directly for download
    res.redirect(url);
  } catch (error) {
    console.error("Error during video download:", error.message);
    res.status(500).json({ error: "Error during video download" });
  }
});

app.get("/api/stream-merge", (req, res) => {
  const { videoUrl, audioUrl } = req.query;

  if (!videoUrl || !audioUrl) {
    return res
      .status(400)
      .json({ error: "Video URL and Audio URL are required" });
  }

  res.setHeader(
    "Content-Disposition",
    'attachment; filename="merged_video.webm"'
  );
  res.setHeader("Content-Type", "video/webm");

  // Use ffmpeg to stream and merge
  const ffmpegProcess = spawn("ffmpeg", [
    "-i",
    videoUrl, // Input video URL
    "-i",
    audioUrl, // Input audio URL
    "-c:v",
    "copy", // Copy video codec (no re-encoding)
    "-c:a",
    "libopus", // Re-encode audio to Opus
    "-f",
    "webm", // Output format (WebM is stream-friendly)
    "pipe:1", // Output to stdout
  ]);

  ffmpegProcess.stdout.pipe(res); // Pipe merged output directly to response

  ffmpegProcess.stderr.on("data", (data) => {
    console.error("FFmpeg error:", data.toString());
  });

  ffmpegProcess.on("close", (code) => {
    if (code !== 0) {
      console.error("FFmpeg process failed with code:", code);
      res.status(500).json({ error: "Failed to merge video and audio" });
    }
  });
});

// app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
