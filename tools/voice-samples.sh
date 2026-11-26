#!/bin/bash
# Generates Arabic (Fusha) voice samples for the platform explainer videos. Run in Cloud Shell only.
mkdir -p ~/voices && cd ~/voices || exit 1
rm -f ./*.mp3
cat > t.txt <<'EOF'
أهلًا بكم في منصة ثانوية الصحافة الأهلية، مساحةٌ واحدة تجمع العمل المدرسي اليومي لكل منسوبي المدرسة.
EOF
for x in ar-AE-HamdanNeural ar-EG-SalmaNeural ar-EG-ShakirNeural ar-JO-SanaNeural ar-JO-TaimNeural ar-SY-LaithNeural ar-LB-RamiNeural ar-QA-MoazNeural; do
  ~/.local/bin/edge-tts --voice "$x" -f t.txt --write-media "$x.mp3" >/dev/null 2>&1 || echo "FAIL $x"
done
{
  echo '<meta charset=utf-8><body dir=rtl style="font-family:sans-serif;max-width:640px;margin:24px auto;line-height:1.8">'
  echo '<h2>عينات الصوت العربي</h2>'
  i=0
  for f in *.mp3; do i=$((i+1)); echo "<p><b>$i.</b> $f<br><audio controls preload=auto src=\"$f\"></audio></p>"; done
} > index.html
ls -la ./*.mp3
