#!/bin/bash
# Installs the video tools in Cloud Shell (never on the user's device), builds video 1 and adds it to the listening page.
set -e
echo 'installing tools...'
pip install -q --user edge-tts playwright imageio-ffmpeg mutagen >/dev/null 2>&1
python3 -m playwright install chromium >/dev/null 2>&1
sudo -n python3 -m playwright install-deps chromium >/dev/null 2>&1 || true
echo 'building video 1...'
curl -sL -H 'Accept: application/vnd.github.raw' 'https://api.github.com/repos/bakr4039-byte/followup/contents/tools/make-video-1.py?ref=video-tools' -o /tmp/make-video-1.py
python3 /tmp/make-video-1.py
cd ~/voices
grep -q video1.mp4 index.html || sed -i 's#<h2>#<h2>الفيديو الأول: جولة في المنصة</h2><video controls width=640 src=video1.mp4></video><h2>#' index.html
ls -la ~/voices/video1.mp4
