#!/bin/bash
# Uploads the platform explainer videos from Cloud Shell to the user's own Google Drive.
# The user approves Drive access once in their browser (scope drive.file: only files this script creates).
set -e
cd ~/voices
SCOPES='https://www.googleapis.com/auth/drive.file,https://www.googleapis.com/auth/cloud-platform'
PROJECT=alsahafa-followup
# Reuse the user credentials saved by an earlier approval in this Cloud Shell session.
ADC=$(ls -t /tmp/tmp.*/application_default_credentials.json ~/.config/gcloud/application_default_credentials.json 2>/dev/null | head -1 || true)
[ -n "$ADC" ] && export GOOGLE_APPLICATION_CREDENTIALS="$ADC"
gcloud services enable drive.googleapis.com --project "$PROJECT" >/dev/null 2>&1 || true
H="x-goog-user-project: $PROJECT"
token() { gcloud auth application-default print-access-token 2>/dev/null; }
T=$(token || true)
if [ -z "$T" ] || ! curl -sf -H "Authorization: Bearer $T" -H "$H" 'https://www.googleapis.com/drive/v3/about?fields=user' >/dev/null; then
  echo 'DRIVE-AUTH: open the link below, approve, then paste the code here.'
  gcloud auth application-default login --scopes="$SCOPES" --no-launch-browser
  ADC=$(ls -t /tmp/tmp.*/application_default_credentials.json ~/.config/gcloud/application_default_credentials.json 2>/dev/null | head -1 || true)
  [ -n "$ADC" ] && export GOOGLE_APPLICATION_CREDENTIALS="$ADC"
  T=$(token)
fi
R=$(curl -s -H "Authorization: Bearer $T" -H "$H" 'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)')
echo "DRIVE-CHECK $R" | head -c 600; echo
# Reuse the folder from an earlier upload when it exists.
EXIST=$(curl -s -G -H "Authorization: Bearer $T" -H "$H" --data-urlencode "q=name='فيديوهات منصة ثانوية الصحافة - الأقسام الجديدة' and mimeType='application/vnd.google-apps.folder' and trashed=false" 'https://www.googleapis.com/drive/v3/files?fields=files(id)' | python3 -c 'import sys,json;f=json.load(sys.stdin).get("files",[]);print(f[0]["id"] if f else "")')
[ -n "$EXIST" ] && FOLDER=$EXIST || FOLDER=$(curl -s -H "Authorization: Bearer $T" -H "$H" -H 'Content-Type: application/json; charset=UTF-8' \
  -d '{"name":"فيديوهات منصة ثانوية الصحافة - الأقسام الجديدة","mimeType":"application/vnd.google-apps.folder"}' \
  'https://www.googleapis.com/drive/v3/files?fields=id' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
LIST=${VIDEOS:-'8 9 10 11 12'}
for i in $LIST; do
case $i in
1) n='01 جولة في المنصة';; 2) n='02 تثبيت المنصة والدخول';; 3) n='03 دليل مدير المدرسة';; 4) n='04 دليل المعلم';;
5) n='05 التكليفات والتوقيعات';; 6) n='06 المساءلات';; 7) n='07 التقارير والطباعة';;
8) n='08 الإعلانات وشاشة العرض وأولياء الأمور';; 9) n='09 الإذاعة المدرسية';; 10) n='10 النماذج الرسمية';;
11) n='11 سجل العمليات والنسخ الاحتياطي';; 12) n='12 الملخص الأسبوعي ومتابعة الفصول';; 13) n='13 القائمة الجديدة وأماكن الأزرار';;
esac
  f=video$i.mp4
  [ -f "$f" ] || { echo "MISSING $f"; continue; }
  meta=$(python3 -c 'import json,sys;print(json.dumps({"name":sys.argv[1]+".mp4","parents":[sys.argv[2]]}))' "$n" "$FOLDER")
  curl -s -X POST -H "Authorization: Bearer $T" -H "$H" \
    -F "metadata=$meta;type=application/json;charset=UTF-8" -F "file=@$f;type=video/mp4" \
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name' >/dev/null && echo "UPLOADED $f"
done
echo "DRIVE-FOLDER https://drive.google.com/drive/folders/$FOLDER"
