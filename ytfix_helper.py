#!/usr/bin/env python3
"""
pytubefix helper — used as a fallback when yt-dlp is bot-detected.
Usage:
  python3 ytfix_helper.py info  <url>
  python3 ytfix_helper.py stream <url> [itag]
"""
import sys
import json

def safe_int(val):
    try:
        return int(str(val).replace("p","").replace("kbps","").strip())
    except:
        return None

def stream_to_format(s):
    ext = "mp4"
    if s.mime_type:
        ext = s.mime_type.split("/")[1].split(";")[0]
    height = safe_int(s.resolution) if s.resolution else None
    abr_val = safe_int(s.abr) if hasattr(s, "abr") and s.abr else None
    return {
        "format_id": str(s.itag),
        "ext": ext,
        "resolution": s.resolution or None,
        "height": height,
        "fps": getattr(s, "fps", None),
        "vcodec": getattr(s, "video_codec", None),
        "acodec": getattr(s, "audio_codec", None),
        "filesize": getattr(s, "filesize_approx", None),
        "tbr": abr_val,
        "abr": abr_val,
        "vbr": None,
        "hasVideo": s.includes_video_track,
        "hasAudio": s.includes_audio_track,
        "note": f"{s.resolution or ''} {s.abr or ''}".strip(),
        "_url": s.url,
    }

def get_info(url):
    from pytubefix import YouTube
    yt = YouTube(url, use_oauth=False, allow_oauth_cache=False)

    formats = []
    for s in yt.streams:
        try:
            formats.append(stream_to_format(s))
        except Exception:
            pass

    formats.sort(key=lambda f: (f["height"] or 0), reverse=True)

    thumb = yt.thumbnail_url or None
    thumbnails = [{"url": thumb, "width": None, "height": None, "id": "default"}] if thumb else []

    pub = None
    try:
        if yt.publish_date:
            pub = yt.publish_date.strftime("%Y%m%d")
    except Exception:
        pass

    print(json.dumps({
        "id": yt.video_id,
        "title": yt.title,
        "channel": yt.author,
        "duration": yt.length,
        "duration_str": None,
        "thumbnail": thumb,
        "view_count": yt.views,
        "upload_date": pub,
        "is_short": "/shorts/" in url,
        "thumbnails": thumbnails,
        "formats": formats,
        "_source": "pytubefix",
    }))

def get_stream_url(url, itag=None):
    from pytubefix import YouTube
    yt = YouTube(url, use_oauth=False, allow_oauth_cache=False)

    if itag:
        stream = yt.streams.get_by_itag(int(itag))
    else:
        stream = yt.streams.filter(progressive=True).order_by("resolution").desc().first()
        if not stream:
            stream = yt.streams.order_by("resolution").desc().first()

    if not stream:
        print(json.dumps({"error": "No stream found"}))
        return

    ext = "mp4"
    if stream.mime_type:
        ext = stream.mime_type.split("/")[1].split(";")[0]

    print(json.dumps({
        "url": stream.url,
        "ext": ext,
        "title": yt.title,
        "mime_type": stream.mime_type,
        "hasVideo": stream.includes_video_track,
        "hasAudio": stream.includes_audio_track,
    }))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: ytfix_helper.py <info|stream> <url> [itag]"}))
        sys.exit(1)

    cmd = sys.argv[1]
    url = sys.argv[2]
    itag = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        if cmd == "info":
            get_info(url)
        elif cmd == "stream":
            get_stream_url(url, itag)
        else:
            print(json.dumps({"error": f"Unknown command: {cmd}"}))
            sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
