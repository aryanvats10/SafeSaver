# 🚀 Safe-Saver Deployment Guide

## Quick Start: Deploy on Render in 5 Minutes

### Step 1: Initialize Git & Push to GitHub

```bash
# 1. Navigate to your project folder
cd safe-saver

# 2. Initialize git (if not already done)
git init

# 3. Add all files
git add .

# 4. First commit
git commit -m "Initial commit - deployment ready"

# 5. Create a new repo on GitHub (https://github.com/new)
# Copy the HTTPS URL from GitHub

# 6. Add remote and push
git remote add origin https://github.com/YOUR-USERNAME/safe-saver.git
git branch -M main
git push -u origin main
```

---

### Step 2: Deploy on Render.com

#### 2.1 Create a Render Account
- Go to https://render.com
- Click **"Sign Up"**
- Use your GitHub account (recommended)

#### 2.2 Deploy Your App
1. Click **"New +"** → **"Web Service"**
2. Choose **"Deploy from GitHub"**
3. Search for `safe-saver` repository
4. Click **"Connect"**
5. Fill in the settings:

| Setting | Value |
|---------|-------|
| **Name** | `safe-saver` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Plan** | `Free` |

6. Click **"Create Web Service"**

#### 2.3 Install System Dependencies

⚠️ **IMPORTANT:** Free servers need yt-dlp and ffmpeg installed!

1. After deployment starts, go to your service dashboard
2. Click **"Shell"** (bottom left)
3. Run these commands:

```bash
apt update
apt install ffmpeg python3-pip -y
pip3 install yt-dlp
```

4. Wait for it to finish. You should see:
```
✅ Processing triggers for mime-support
```

#### 2.4 Set Environment Variables (Optional)

1. Go to your service dashboard
2. Click **"Environment"** 
3. Click **"Add Environment Variable"**
4. Add these (optional):

| Key | Value |
|-----|-------|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |

> The PORT will be automatically assigned by Render, but you can set it to `3000`

5. Click **"Save Changes"**

---

### Step 3: Test Your Deployment

Once the server says **"Live"** (green status):

1. Click the URL at the top (e.g., `https://safe-saver.onrender.com`)
2. Test the health endpoint: `https://safe-saver.onrender.com/health`
3. You should see:
```json
{
  "status": "ok",
  "timestamp": "2026-05-14T10:30:45.123Z",
  "uptime": 234.567,
  "memory": "45MB"
}
```

---

## 📝 Environment Variables Explained

### Available Variables

| Variable | Purpose | Default | Required? |
|----------|---------|---------|-----------|
| `PORT` | Server port | 3001 | ❌ No |
| `YTDLP_PATH` | Path to yt-dlp | `yt-dlp` | ❌ No (only if custom install) |
| `FFMPEG_PATH` | Path to ffmpeg | `ffmpeg` | ❌ No (only if custom install) |
| `NODE_ENV` | Environment | `development` | ❌ No |

### How to Set on Render

1. Go to your service dashboard
2. Click **"Environment"** tab
3. Add variables as needed
4. Changes auto-redeploy the service

---

## 🔧 Important Files Created

| File | Purpose |
|------|---------|
| `.gitignore` | Prevents `node_modules` and `.env` from uploading |
| `render.yaml` | Configuration for Render deployment |
| `.env.example` | Template for environment variables |
| `server.js` | Updated with graceful shutdown & cleanup |

---

## ✅ Checklist Before Deployment

- [ ] Installed ffmpeg and yt-dlp locally and tested
- [ ] All files committed to git
- [ ] Pushed to GitHub
- [ ] Created Render account
- [ ] Deployed service on Render
- [ ] Installed ffmpeg and yt-dlp on Render server
- [ ] Tested `/health` endpoint
- [ ] Can access your app at `https://safe-saver.onrender.com`

---

## 🆘 Troubleshooting

### "❌ yt-dlp not found"
**Solution:** Run in Render Shell:
```bash
pip3 install yt-dlp
```

### "❌ ffmpeg not found"
**Solution:** Run in Render Shell:
```bash
apt install ffmpeg -y
```

### Server keeps restarting
**Reason:** Missing dependencies or memory issue
**Solution:** 
1. Check logs: Click **"Logs"** tab
2. Run: `apt install ffmpeg python3-pip -y && pip3 install yt-dlp`

### Downloads not working
**Reason:** Dependencies not installed on server
**Solution:** Complete Step 2.3 above

### Free tier sleeping
**Info:** Free servers go idle after 15 minutes. Request will wake it (takes ~30 seconds). This is normal!

---

## 📊 What You Get (Free Plan)

- ✅ **Always running** server (restarts on idle)
- ✅ **500MB disk space** (for temp files)
- ✅ **Custom domain** (safe-saver.onrender.com)
- ✅ **Automatic HTTPS** (SSL certificate)
- ✅ **Logs & monitoring**
- ✅ **Automatic redeploys** on git push

---

## 🚀 Next: Push Code to Test Auto-Deploy

After everything works:

```bash
# Make a change
echo "# Deployed!" >> README.md

# Commit and push
git add .
git commit -m "Test auto-deploy"
git push origin main
```

Render will automatically redeploy within 30 seconds!

---

## 📞 Quick Links

- **Render Dashboard:** https://dashboard.render.com
- **Your App:** https://safe-saver.onrender.com
- **yt-dlp GitHub:** https://github.com/yt-dlp/yt-dlp
- **Render Docs:** https://render.com/docs

---

**That's it! Your app is now deployed for free!** 🎉
