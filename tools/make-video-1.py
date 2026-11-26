#!/usr/bin/env python3
"""Builds explainer video 1 (platform tour) with Arabic narration (voice: ar-EG-ShakirNeural).
Visuals are designed slides with sample data only: no real student or staff data. Run in Cloud Shell."""
import asyncio, os, subprocess
import edge_tts, imageio_ffmpeg
from mutagen.mp3 import MP3
from playwright.async_api import async_playwright

FF = imageio_ffmpeg.get_ffmpeg_exe()
VOICE = 'ar-EG-ShakirNeural'
OUT = os.path.expanduser('~/voices/video1')
os.makedirs(OUT, exist_ok=True)
LOGO = 'https://bakr4039-byte.github.io/followup/assets/sahafa-school-logo.jpeg'

CSS = """
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;font-family:'IBM Plex Sans Arabic',sans-serif;background:#EEF2F1;color:#11302B;display:grid;grid-template-rows:130px 1fr 200px;overflow:hidden}
header{background:#123e36;color:#fff;display:flex;align-items:center;gap:24px;padding:0 64px}
header img{width:90px;height:80px;object-fit:contain;background:#fff;border-radius:16px;padding:4px}
header b{display:block;font-size:36px}header span{font-size:22px;color:#b7cfc7}
header em{margin-inline-start:auto;font-style:normal;font-size:26px;color:#dfc788}
main{padding:46px 96px;display:grid;align-content:start;gap:34px}
h1{font-size:62px;color:#0E6B57}
footer{background:#0b2a24;color:#fff;font-size:40px;line-height:1.55;padding:26px 96px;display:flex;align-items:center}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:28px}
.card{background:#fff;border:2px solid #D5DFDC;border-radius:26px;padding:32px;box-shadow:0 8px 24px rgba(17,48,43,.08)}
.card span{display:block;font-size:27px;color:#5B726D}.card strong{display:block;font-size:64px;margin-top:6px}
.hero{background:linear-gradient(135deg,#0E6B57,#0b5747);color:#fff;border-radius:30px;padding:40px 50px;font-size:32px}
.hero b{display:block;font-size:54px;margin-top:6px}
.list{display:grid;gap:20px;max-width:1400px}
.item{background:#fff;border:2px solid #D5DFDC;border-radius:22px;padding:26px 32px;font-size:34px;display:flex;justify-content:space-between;align-items:center;gap:20px}
.item.warn{background:#FBEFD8}
.btns{display:flex;gap:12px}.btns i,.btns u{font-style:normal;text-decoration:none;border-radius:14px;padding:8px 22px;font-size:28px;font-weight:600}
.btns u{background:#e5f1ea;color:#143e32}.btns i{background:#25D366;color:#073b1c}
table{border-collapse:collapse;font-size:28px;background:#fff}
th,td{border:2px solid #D5DFDC;padding:16px 22px;text-align:center}th{background:#DCEFE9}td small{display:block;font-size:22px;color:#5B726D}
.ln{background:#e6eef6;color:#2f5573;font-weight:700}.br{background:#FBEFD8;color:#B7791F;font-weight:700}.pr{background:#DDF3E5;color:#1C8A4E;font-weight:700}
.row{display:flex;gap:70px;align-items:center}
.big-logo{width:360px;height:320px;object-fit:contain;background:#fff;border-radius:40px;padding:20px;box-shadow:0 12px 40px rgba(17,48,43,.15)}
.login{background:#fff;border-radius:30px;padding:44px;width:720px;border:2px solid #D5DFDC;font-size:30px;display:grid;gap:18px}
.login div{border:2px solid #D5DFDC;border-radius:16px;padding:18px;color:#8A9A96}
.login p{background:#0E6B57;color:#fff;border-radius:16px;padding:18px;text-align:center;font-weight:700}
.roles{display:grid;gap:20px}.roles span{background:#DCEFE9;border-radius:40px;padding:16px 34px;font-size:34px;font-weight:600}
.phone{width:400px;height:660px;border:16px solid #11302B;border-radius:60px;background:#fff;display:grid;place-items:center;align-content:center;gap:18px;text-align:center;font-size:30px}
.phone img{width:150px;height:150px;object-fit:contain;border-radius:34px;box-shadow:0 6px 20px rgba(0,0,0,.15)}
"""

def cards(items):
    return '<div class="cards">' + ''.join(f'<div class="card"><span>{a}</span><strong>{b}</strong></div>' for a, b in items) + '</div>'

SCENES = [
    dict(title='منصة ثانوية الصحافة الأهلية',
         visual=f'<div class="row"><img class="big-logo" src="{LOGO}"><div class="hero">منصة الإدارة والمتابعة<b>كل العمل المدرسي في مكان واحد</b></div></div>',
         say='أهلًا بكم في منصة ثانوية الصحافة الأهلية، مساحةٌ واحدة تجمع العمل المدرسي اليومي لكل منسوبي المدرسة.'),
    dict(title='دخول لكل منسوب بحسابه',
         visual='<div class="row"><div class="login">الدخول الموحد<div>اسم المستخدم</div><div>كلمة المرور</div><p>دخول</p></div><div class="roles"><span>مدير المدرسة</span><span>المعلم</span><span>الإداري والمشرف</span><span>مسؤول رصد المساءلات</span></div></div>',
         say='يدخل كل منسوب بحسابه، فتفتح له المنصة ما يخصّه: المدير، والمعلم، والإداري، ومسؤول الرصد.'),
    dict(title='الصفحة الرئيسية للمدير',
         visual='<div class="hero">الأحد، 12 جمادى الآخرة 1448 هـ<b>صباح الخير، مدير المدرسة</b></div>' + cards([('نوع الدوام', 'حضوري'), ('حصص اليوم', '116'), ('المرصودة', '98'), ('بانتظار الرصد', '18')]),
         say='تبدأ الصفحة الرئيسية بملخّص اليوم: نوع الدوام، والمؤشرات، وما ينتظر إجراءك الآن.'),
    dict(title='جرس الإشعارات',
         visual='<div class="list"><div class="item"><span>توقيع تكليف · لجنة الاختبارات</span><span class="btns"><u>فتح</u><i>واتساب</i></span></div><div class="item warn"><span>لم تُرصد بعد: 3 حصص انتهت</span><span class="btns"><u>فتح</u><i>واتساب</i></span></div><div class="item"><span>اطلاع وإقرار · تعميم الاختبارات</span><span class="btns"><u>فتح</u><i>واتساب</i></span></div></div>',
         say='جرس الإشعارات يجمع طلبات التوقيع، والتكليفات، والمساءلات، والحصص التي لم تُرصد، ومن كل إشعار تفتح الطلب أو ترسله عبر واتساب.'),
    dict(title='الجدول المدرسي: عن بُعد وحضوري',
         visual='<table><tr><th>اليوم</th><th class="ln">الطابور<small>6:45 – 7:00</small></th><th>الأولى<small>7:00 – 7:50</small></th><th>الثانية<small>7:50 – 8:40</small></th><th class="br">الفسحة<small>8:40 – 9:05</small></th><th>الثالثة<small>9:05 – 9:55</small></th><th class="pr">الصلاة<small>12:20 – 12:30</small></th></tr><tr><th>الأحد</th><td class="ln"></td><td>رياضيات</td><td>لغة عربية</td><td class="br"></td><td>كيمياء</td><td class="pr"></td></tr><tr><th>الاثنين</th><td class="ln"></td><td>أحياء</td><td>انجليزي</td><td class="br"></td><td>فيزياء</td><td class="pr"></td></tr></table>',
         say='للمدرسة جدولان: عن بُعد، وحضوري، بتوقيت كل صف، مع الطابور والفسح والصلاة، ويحدّد المدير نوع الدوام لكل يوم.'),
    dict(title='صفحة المعلم وتنبيه الحصة',
         visual='<div class="list"><div class="item warn"><span>حصتك القادمة: كيمياء · الثاني الثانوي · شعبة 1 · 9:05 – 9:55</span><span class="btns"><u>فتح</u></span></div></div>' + cards([('حصص اليوم', '4'), ('التقارير', 'مباشرة'), ('تكليفاتي', '1'), ('مناوباتي', 'الخميس')]),
         say='ويرى المعلم جدوله وتقاريره، ويصله تنبيه قبل حصته بعشر دقائق.'),
    dict(title='التوقيعات والتقارير الرسمية',
         visual=cards([('التكليفات', 'توقيع إلكتروني'), ('الإقرارات', 'اطلاع موثّق'), ('التقارير', 'قالب رسمي'), ('الطباعة', 'PDF')]),
         say='وتُوقَّع التكليفات والإقرارات إلكترونيًا، وتُطبَع التقارير بقالب رسمي موحّد.'),
    dict(title='ثبّت المنصة على جوالك',
         visual=f'<div class="row"><div class="phone"><img src="{LOGO}"><b>ثانوية الصحافة</b></div><div class="hero">أندرويد وآيفون<b>أيقونة على الشاشة الرئيسية</b></div></div>',
         say='ثبّت المنصة على جوالك من الشاشة الرئيسية، وتابع عملك المدرسي في أي وقت. منصة ثانوية الصحافة، كل العمل في مكان واحد.'),
]

def page(s, i, n):
    return ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
            '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">'
            f'<style>{CSS}</style></head><body><header><img src="{LOGO}"><div><b>ثانوية الصحافة الأهلية</b><span>منصة الإدارة والمتابعة</span></div><em>{i} / {n}</em></header>'
            f'<main><h1>{s["title"]}</h1>{s["visual"]}</main><footer>{s["say"]}</footer></body></html>')

async def main():
    segs = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        pg = await browser.new_page(viewport={'width': 1920, 'height': 1080})
        for i, s in enumerate(SCENES, 1):
            audio = f'{OUT}/a{i}.mp3'
            await edge_tts.Communicate(s['say'], VOICE, rate='-4%').save(audio)
            dur = MP3(audio).info.length + 0.8
            await pg.set_content(page(s, i, len(SCENES)), wait_until='networkidle')
            await pg.wait_for_timeout(400)
            img = f'{OUT}/s{i}.png'
            await pg.screenshot(path=img)
            seg = f'{OUT}/seg{i}.mp4'
            subprocess.run([FF, '-y', '-loop', '1', '-i', img, '-i', audio, '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '30',
                            '-vf', f'fade=in:0:9,fade=out:st={dur - 0.35:.2f}:d=0.35', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-af', 'apad',
                            '-t', f'{dur:.2f}', seg], check=True, capture_output=True)
            segs.append(seg)
            print('scene', i, round(dur, 1), 's', flush=True)
        await browser.close()
    lst = f'{OUT}/list.txt'
    with open(lst, 'w') as f:
        f.write(''.join(f"file '{x}'\n" for x in segs))
    final = os.path.expanduser('~/voices/video1.mp4')
    subprocess.run([FF, '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', final], check=True, capture_output=True)
    print('DONE', final, flush=True)

asyncio.run(main())
