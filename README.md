# YTDL — YouTube Downloader (Self-Hosted)

A self-hosted YouTube downloader. No third-party services. Everything runs locally.

---

## ⚡ Quick Start (2 minutes)

### 1. Install prerequisites

**macOS**
```bash
brew install yt-dlp ffmpeg
```

**Ubuntu / Debian**
```bash
sudo apt update && sudo apt install ffmpeg python3-pip -y
pip3 install yt-dlp
```

**Windows**
```powershell
winget install yt-dlp ffmpeg
# or use Chocolatey: choco install yt-dlp ffmpeg
```

Verify:
```bash
yt-dlp --version   # should print a version number
ffmpeg -version    # should print build info
```

---

### 2. Install Node dependencies

```bash
npm install
```

---

### 3. Start the server

```bash
node server.js
```

Open your browser at **http://localhost:3001** — done! ✅

---

## 📡 API Reference

All endpoints accept any valid YouTube URL:
`https://youtube.com/watch?v=...` | `https://youtu.be/...` | `https://youtube.com/shorts/...`

### `GET /api/info?url=URL`
Returns full metadata + all available formats from yt-dlp.

```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Video Title",
  "channel": "Channel Name",
  "duration": 212,
  "duration_str": "3:32",
  "thumbnail": "https://...",
  "is_short": false,
  "thumbnails": [ { "url": "...", "width": 1280, "height": 720 } ],
  "formats": [
    {
      "format_id": "137",
      "ext": "mp4",
      "height": 1080,
      "fps": 30,
      "vcodec": "avc1.640028",
      "acodec": null,
      "filesize": 450000000,
      "hasVideo": true,
      "hasAudio": false
    }
  ]
}
```

---

### `GET /api/download?url=URL&format_id=FMT&filename=NAME`

Downloads and streams the file to the browser.

| `format_id` value | Result |
|---|---|
| A yt-dlp format ID (e.g. `137`) | Downloads that exact stream |
| `mp3` | Extracts audio and converts to MP3 |
| `m4a` | Extracts audio as M4A/AAC |
| `ogg` | Extracts audio, converts to OGG Vorbis |
| `flac` | Extracts audio, converts to FLAC (lossless) |
| `wav` | Extracts audio, converts to WAV |
| `opus` | Extracts audio as Opus |

yt-dlp automatically merges video+audio streams using ffmpeg when needed.

---

### `GET /api/stream-progress?url=URL&format_id=FMT`

Server-Sent Events (SSE) stream. Emits JSON objects:

```json
{ "percent": 45.3, "speed": "3.2MiB/s", "eta": "0:12" }
{ "done": true }
```

---

## 🗂 Project Structure

```
ytdl-backend/
├── server.js          ← Express backend
├── package.json
├── README.md
└── public/
    └── index.html     ← Frontend (served by Express)
```

---

## 🔧 Configuration

Edit the top of `server.js`:

```js
const PORT = process.env.PORT || 3001;   // change port here
```

Or use environment variables:
```bash
PORT=8080 node server.js
```

If yt-dlp or ffmpeg are not on your PATH, use:
```bash
YTDLP_PATH=/path/to/yt-dlp FFMPEG_PATH=/path/to/ffmpeg npm start
```

---

## 🚀 Deploy (optional)

To run on a server (e.g. a VPS or Raspberry Pi):

```bash
# Install pm2 for process management
npm install -g pm2
pm2 start server.js --name ytdl
pm2 save

# Then update the API constant in public/index.html:
# const API = 'https://your-domain.com';
```

---

## ⚠️ Legal Notice

Download only content you own or that is freely licensed. Downloading copyrighted YouTube content
without permission may violate YouTube's Terms of Service and applicable copyright law.
