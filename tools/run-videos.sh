#!/bin/bash
# Builds explainer videos in Cloud Shell (never on the user's device). Usage: bash run-videos.sh 8 9 10 11 12
set -e
echo 'installing tools...'
pip install -q --user edge-tts playwright imageio-ffmpeg mutagen >/dev/null 2>&1
python3 -m playwright install chromium >/dev/null 2>&1
sudo -n python3 -m playwright install-deps chromium >/dev/null 2>&1 || true
mkdir -p ~/voices
curl -sL -H 'Accept: application/vnd.github.raw' 'https://api.github.com/repos/bakr4039-byte/followup/contents/tools/make-videos.py?ref=video-tools' -o /tmp/make-videos.py
ARGS="${*:-8 9 10 11 12}"
echo "building videos: $ARGS"
python3 /tmp/make-videos.py $ARGS
ls -la ~/voices/*.mp4
echo 'ALL-VIDEOS-DONE'
