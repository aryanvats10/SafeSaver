/**
 * YTDL Backend — Express + yt-dlp
 * Runs on http://localhost:3001
 *
 * Prerequisites (run once):
 *   pip install yt-dlp          # or: brew install yt-dlp
 *   brew install ffmpeg         # or: sudo apt install ffmpeg
 *   npm install
 *   node server.js
 */

const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const { execFile, execFileSync, spawn } = require('child_process');
const path       = require('path');
const fs         = require('fs');
const os         = require('os');

const app  = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const YTDLP_CMD = process.env.YTDLP_PATH || (process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const FFMPEG_CMD = process.env.FFMPEG_PATH || 'ffmpeg';

// ── YouTube Cookies (required to bypass bot detection on cloud server IPs) ────
// Set the YOUTUBE_COOKIES environment variable with the full contents of a
// cookies.txt file exported from your browser while logged into YouTube.
const COOKIES_FILE = path.join(os.tmpdir(), 'yt-cookies.txt');
const COOKIES_CONTENT = process.env.YOUTUBE_COOKIES || '';

if (COOKIES_CONTENT) {
  try {
    fs.writeFileSync(COOKIES_FILE, COOKIES_CONTENT, 'utf8');
    console.log('✅ YouTube cookies loaded — bot detection bypass active');
  } catch (e) {
    console.warn('⚠️  Failed to write cookies file:', e.message);
  }
} else {
  console.warn('⚠️  No YOUTUBE_COOKIES set — downloads may fail on cloud server IPs');
}

// Default args added to every yt-dlp call
function getBaseArgs() {
  const args = [
    '--extractor-args', 'youtube:player_client=web,android',
    '--no-check-certificates',
    '--retries', '3',
    '--file-access-retries', '3',
    '--fragment-retries', '3',
  ];
  if (COOKIES_CONTENT && fs.existsSync(COOKIES_FILE)) {
    args.push('--cookies', COOKIES_FILE);
  }
  return args;
}

// ── Temp download directory ──────────────────────────────────────────────────
const TMP_DIR = path.join(os.tmpdir(), 'ytdl-downloads');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ── Check for required commands ──────────────────────────────────────────────
function isCommandAvailable(cmd, args = ['--version']) {
  try {
    execFileSync(cmd, args, { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const missingDeps = [];

if (!isCommandAvailable(YTDLP_CMD, ['--version'])) {
  console.error(`\n❌ CRITICAL: yt-dlp not found at: ${YTDLP_CMD}`);
  console.error('   Install with: pip3 install yt-dlp');
  missingDeps.push('yt-dlp');
}

if (!isCommandAvailable(FFMPEG_CMD, ['-version'])) {
  console.error(`\n❌ CRITICAL: ffmpeg not found at: ${FFMPEG_CMD}`);
  console.error('   Install with: apt install ffmpeg (Linux) or brew install ffmpeg (Mac)');
  missingDeps.push('ffmpeg');
}

if (missingDeps.length > 0) {
  console.error(`\n❌ Cannot start: Missing ${missingDeps.join(', ')}`);
  process.exit(1);
}

console.log('\n✅ All dependencies found!');

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // serves the frontend

// Request timeout
app.use((req, res, next) => {
  req.setTimeout(600000); // 10 minutes for downloads
  res.setTimeout(600000);
  next();
});

// Rate limiting — 30 requests/minute per IP
const limiter = rateLimit({
  windowMs: 60000,
  max: 30,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ── Helpers ──────────────────────────────────────────────────────────────────

function ytdlp(args) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP_CMD, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

function validateYouTubeUrl(url) {
  return /^https?:\/\/(?:www\.)?(?:youtube\.com|m\.youtube\.com|music\.youtube\.com)\/(?:watch\?(?:.*&)?v=|playlist\?list=|watch\?list=|shorts\/|embed\/)|^https?:\/\/youtu\.be\//.test(url);
}

function isPlaylistUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const isKnownHost = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host);
    return isKnownHost && parsed.searchParams.has('list');
  } catch {
    return false;
  }
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9\s\-_.()]/gi, '').trim().replace(/\s+/g, '_').slice(0, 120);
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/info?url=...
 * Returns video metadata + available formats
 */
app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  if (!url || !validateYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const playlistMode = isPlaylistUrl(url);
    const infoArgs = [
      ...getBaseArgs(),
      '--no-warnings',
      ...(playlistMode ? ['--dump-single-json', '--yes-playlist'] : ['--dump-json', '--no-playlist']),
      url
    ];
    const raw = await ytdlp(infoArgs);

    const info = JSON.parse(raw);

    if (playlistMode && info._type === 'playlist') {
      const playlistItems = (info.entries || []).map((entry, index) => ({
        id: entry.id,
        title: entry.title,
        url: entry.webpage_url || entry.url || `https://youtu.be/${entry.id}`,
        duration: entry.duration || null,
        duration_str: entry.duration_string || formatDuration(entry.duration),
        thumbnail: entry.thumbnail || (entry.thumbnails && entry.thumbnails[0] && entry.thumbnails[0].url) || null,
        index: entry.playlist_index || index + 1,
      }));

      return res.json({
        is_playlist: true,
        playlist_id: info.id || null,
        playlist_title: info.title || 'Playlist',
        playlist_uploader: info.uploader || info.uploader_id || info.channel || null,
        playlist_count: Number(info.total_entries || info.entries?.length || playlistItems.length),
        playlist_thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails[0] && info.thumbnails[0].url) || null,
        playlist_url: info.webpage_url || url,
        playlist_items: playlistItems,
      });
    }

    // Build clean format list
    const formats = (info.formats || [])
      .filter(f => f.ext !== 'mhtml')
      .map(f => ({
        format_id:  f.format_id,
        ext:        f.ext,
        resolution: f.resolution || (f.height ? `${f.width}x${f.height}` : null),
        height:     f.height || null,
        fps:        f.fps   || null,
        vcodec:     f.vcodec !== 'none' ? f.vcodec : null,
        acodec:     f.acodec !== 'none' ? f.acodec : null,
        filesize:   f.filesize || f.filesize_approx || null,
        tbr:        f.tbr   || null,  // total bitrate kbps
        abr:        f.abr   || null,  // audio bitrate kbps
        vbr:        f.vbr   || null,  // video bitrate kbps
        hasVideo:   f.vcodec && f.vcodec !== 'none',
        hasAudio:   f.acodec && f.acodec !== 'none',
        note:       f.format_note || '',
      }))
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    // Thumbnail resolution list
    const thumbnails = (info.thumbnails || [])
      .filter(t => t.url)
      .reverse() // highest res first
      .slice(0, 8)
      .map(t => ({
        url:    t.url,
        width:  t.width  || null,
        height: t.height || null,
        id:     t.id,
      }));

    res.json({
      id:          info.id,
      title:       info.title,
      channel:     info.uploader || info.channel,
      duration:    info.duration,          // seconds
      duration_str:info.duration_string,
      thumbnail:   info.thumbnail,
      view_count:  info.view_count,
      upload_date: info.upload_date,
      is_short:    (info.original_url || url).includes('/shorts/'),
      thumbnails,
      formats,
    });

  } catch (err) {
    console.error('[/api/info]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/download?url=...&format_id=...&filename=...
 * Streams the file directly to the browser.
 *
 * format_id can be:
 *   - A raw yt-dlp format_id (e.g. "137")
 *   - "bestaudio/best" style strings
 *   - Special values: "mp3", "m4a", "ogg", "flac", "wav", "opus" → triggers audio conversion
 */
app.get('/api/download', async (req, res) => {
  const { url, format_id, filename: filenameHint } = req.query;

  if (!url || !validateYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  const AUDIO_CONVERT_FORMATS = ['mp3', 'm4a', 'ogg', 'flac', 'wav', 'opus'];
  const isAudioConvert = AUDIO_CONVERT_FORMATS.includes(format_id);

  // Build a unique tmp file path
  const tmpBase = path.join(TMP_DIR, `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const tmpTemplate = `${tmpBase}.%(ext)s`;

  try {
    let ytdlpArgs;

    if (isAudioConvert) {
      // Extract audio and convert
      ytdlpArgs = [
        ...getBaseArgs(),
        ...(isPlaylistUrl(url) ? ['--yes-playlist', '--playlist-items', '1'] : ['--no-playlist']),
        '--no-warnings',
        '-x',                           // extract audio
        '--audio-format', format_id,
        '--audio-quality', '0',         // best quality
        '--ffmpeg-location', FFMPEG_CMD,
        '-o', tmpTemplate,
        url,
      ];
    } else {
      // Video download (merge video+audio if needed)
      ytdlpArgs = [
        ...getBaseArgs(),
        ...(isPlaylistUrl(url) ? ['--yes-playlist', '--playlist-items', '1'] : ['--no-playlist']),
        '--no-warnings',
        '-f', format_id || 'bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
        '--ffmpeg-location', FFMPEG_CMD,
        '-o', tmpTemplate,
        url,
      ];
    }

    // Run yt-dlp and wait for it to finish
    await new Promise((resolve, reject) => {
      const proc = spawn(YTDLP_CMD, ytdlpArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.on('close', code => code === 0 ? resolve() : reject(new Error(`${YTDLP_CMD} exited with code ${code}`)));
      proc.stderr.on('data', d => process.stderr.write(d));
    });

    // Find the output file (yt-dlp fills in the extension)
    const files = fs.readdirSync(TMP_DIR).filter(f => f.startsWith(path.basename(tmpBase)));
    if (!files.length) throw new Error('Download produced no output file');

    const outFile = path.join(TMP_DIR, files[0]);
    const ext     = path.extname(outFile).slice(1);
    const safeName = sanitizeFilename(filenameHint || 'download');
    const dlName  = `${safeName}.${ext}`;

    res.setHeader('Content-Disposition', `attachment; filename="${dlName}"`);
    res.setHeader('Content-Type', getMimeType(ext));
    res.setHeader('Content-Length', fs.statSync(outFile).size);

    const stream = fs.createReadStream(outFile);
    stream.pipe(res);
    stream.on('close', () => {
      // Clean up temp file after sending
      fs.unlink(outFile, () => {});
    });

  } catch (err) {
    console.error('[/api/download]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/stream-progress?url=...&format_id=...
 * Server-Sent Events endpoint — emits yt-dlp progress lines
 */
app.get('/api/stream-progress', (req, res) => {
  const { url, format_id } = req.query;
  if (!url || !validateYouTubeUrl(url)) {
    return res.status(400).end();
  }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const proc = spawn(YTDLP_CMD, [
    ...getBaseArgs(),
    ...(isPlaylistUrl(url) ? ['--yes-playlist', '--playlist-items', '1'] : ['--no-playlist']),
    '--newline',
    '--progress',
    '-f', format_id || 'bestvideo+bestaudio/best',
    '--simulate',
    url,
  ]);

  proc.stdout.on('data', chunk => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    lines.forEach(line => {
      const pct = line.match(/(\d+\.?\d*)%/);
      const spd = line.match(/at\s+([\d.]+\w+\/s)/);
      const eta = line.match(/ETA\s+([\d:]+)/);
      if (pct) send({ percent: parseFloat(pct[1]), speed: spd?.[1], eta: eta?.[1] });
    });
  });

  proc.on('close', () => { send({ done: true }); res.end(); });
  req.on('close', () => proc.kill());
});

/**
 * GET /api/formats?url=...
 * Lightweight alias — just returns available format IDs and quality labels
 */
app.get('/api/formats', async (req, res) => {
  const { url } = req.query;
  if (!url || !validateYouTubeUrl(url)) return res.status(400).json({ error: 'Invalid URL' });

  try {
    const raw = await ytdlp(['--list-formats', '--no-warnings', url]);
    res.json({ raw }); // raw text from yt-dlp --list-formats
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMimeType(ext) {
  const map = {
    mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg',
    flac: 'audio/flac', wav: 'audio/wav', opus: 'audio/opus',
    jpg: 'image/jpeg', png: 'image/png',
  };
  return map[ext] || 'application/octet-stream';
}

// Aggressive cleanup: remove files older than 30 minutes
// (Free servers have limited storage!)
setInterval(() => {
  const cutoff = Date.now() - (30 * 60 * 1000); // 30 minutes
  try {
    fs.readdirSync(TMP_DIR).forEach(f => {
      const fp = path.join(TMP_DIR, f);
      const stats = fs.statSync(fp);
      if (stats.mtimeMs < cutoff || stats.size > 500 * 1024 * 1024) { // 500MB max
        fs.unlink(fp, () => {});
      }
    });
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// On startup, clean old files
(() => {
  try {
    if (fs.existsSync(TMP_DIR)) {
      fs.readdirSync(TMP_DIR).forEach(f => {
        fs.unlink(path.join(TMP_DIR, f), () => {});
      });
    }
  } catch (err) {
    console.error('Initial cleanup error:', err.message);
  }
})();

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
  });
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
let server;

function gracefulShutdown(signal) {
  console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('✅ Server closed');
    // Clean up temp files
    try {
      fs.readdirSync(TMP_DIR).forEach(f => {
        fs.unlink(path.join(TMP_DIR, f), () => {});
      });
    } catch (err) {
      console.error('Cleanup error:', err.message);
    }
    process.exit(0);
  });
  // Force exit after 30 seconds
  setTimeout(() => {
    console.error('❌ Forced exit after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ── Start ─────────────────────────────────────────────────────────────────────
server = app.listen(PORT, HOST, () => {
  console.log(`\n✅ YTDL backend running at http://${HOST}:${PORT}`);
  console.log(`   Frontend:  http://localhost:${PORT}`);
  console.log(`   Info API:  http://localhost:${PORT}/api/info?url=...`);
  console.log(`   Download:  http://localhost:${PORT}/api/download?url=...&format_id=...`);
  console.log(`   Health:    http://localhost:${PORT}/health\n`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
  process.exit(1);
});
