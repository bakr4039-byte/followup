#!/usr/bin/env python3
"""Builds explainer videos 2-7 for the platform with Arabic narration (voice: ar-EG-ShakirNeural).
Same look as video 1. Designed slides with sample data only: no real student or staff data.
Usage (Cloud Shell): python3 make-videos.py 2 3 4 5 6 7"""
import asyncio, html, os, re, subprocess, sys
import edge_tts, imageio_ffmpeg
from mutagen.mp3 import MP3
from playwright.async_api import async_playwright

FF = imageio_ffmpeg.get_ffmpeg_exe()
VOICE = 'ar-EG-ShakirNeural'
ROOT = os.path.expanduser('~/voices')
LOGO = 'https://bakr4039-byte.github.io/followup/assets/sahafa-school-logo.jpeg'

CSS = """
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;font-family:'IBM Plex Sans Arabic',sans-serif;background:#EEF2F1;color:#11302B;display:grid;grid-template-rows:130px 1fr 200px;overflow:hidden}
header{background:#123e36;color:#fff;display:flex;align-items:center;gap:24px;padding:0 64px}
header img{width:90px;height:80px;object-fit:contain;background:#fff;border-radius:16px;padding:4px}
header b{display:block;font-size:36px}header span{font-size:22px;color:#b7cfc7}
header em{margin-inline-start:auto;font-style:normal;font-size:26px;color:#dfc788}
main{padding:46px 96px;display:grid;align-content:start;gap:34px}
h1{font-size:60px;color:#0E6B57}
footer{background:#0b2a24;color:#fff;font-size:38px;line-height:1.55;padding:24px 96px;display:flex;align-items:center}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:28px}
.card{background:#fff;border:2px solid #D5DFDC;border-radius:26px;padding:30px;box-shadow:0 8px 24px rgba(17,48,43,.08)}
.card span{display:block;font-size:27px;color:#5B726D}.card strong{display:block;font-size:56px;margin-top:6px}
.hero{background:linear-gradient(135deg,#0E6B57,#0b5747);color:#fff;border-radius:30px;padding:38px 50px;font-size:32px}
.hero b{display:block;font-size:52px;margin-top:6px}
.list{display:grid;gap:20px;max-width:1500px}
.item{background:#fff;border:2px solid #D5DFDC;border-radius:22px;padding:24px 32px;font-size:34px;display:flex;justify-content:space-between;align-items:center;gap:20px}
.item.warn{background:#FBEFD8}.item.ok{background:#DDF3E5}
.num{display:inline-grid;place-items:center;width:58px;height:58px;border-radius:50%;background:#0E6B57;color:#fff;font-weight:700;margin-inline-end:20px;flex:none}
.step{justify-content:flex-start}
.btns{display:flex;gap:12px}.btns i,.btns u,.btns s{font-style:normal;text-decoration:none;border-radius:14px;padding:8px 22px;font-size:28px;font-weight:600}
.btns u{background:#e5f1ea;color:#143e32}.btns i{background:#25D366;color:#073b1c}.btns s{background:#0E6B57;color:#fff}
.tabs{display:flex;gap:16px}.tabs span{border:2px solid #D5DFDC;background:#fff;border-radius:16px;padding:14px 30px;font-size:32px;font-weight:600}.tabs span.on{background:#0E6B57;color:#fff;border-color:#0E6B57}
table{border-collapse:collapse;font-size:30px;background:#fff}
th,td{border:2px solid #D5DFDC;padding:16px 24px;text-align:center}th{background:#DCEFE9}td small{display:block;font-size:22px;color:#5B726D}
.tag{display:inline-block;border-radius:30px;padding:4px 20px;font-size:26px;font-weight:700}.tag.ok{background:#DDF3E5;color:#1C8A4E}.tag.bad{background:#FBE1DF;color:#C2413A}.tag.warn{background:#FBEFD8;color:#B7791F}
.row{display:flex;gap:60px;align-items:center}
.phone{width:380px;height:640px;border:16px solid #11302B;border-radius:60px;background:#fff;display:grid;place-items:center;align-content:center;gap:18px;text-align:center;font-size:30px;flex:none}
.phone img{width:150px;height:150px;object-fit:contain;border-radius:34px;box-shadow:0 6px 20px rgba(0,0,0,.15)}
.login{background:#fff;border-radius:30px;padding:44px;width:720px;border:2px solid #D5DFDC;font-size:30px;display:grid;gap:18px}
.login div{border:2px solid #D5DFDC;border-radius:16px;padding:18px;color:#8A9A96}
.login p{background:#0E6B57;color:#fff;border-radius:16px;padding:18px;text-align:center;font-weight:700}
.pad{background:#fff;border:4px dashed #0E6B57;border-radius:28px;height:300px;display:grid;place-items:center;max-width:1300px}
.paper{background:#fff;border:2px solid #D5DFDC;border-radius:18px;padding:30px 40px;max-width:1500px;font-size:28px;display:grid;gap:18px}
.paper .ph{display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #0E6B57;padding-bottom:14px}
.paper .ph img{width:80px;height:70px;object-fit:contain}
.paper .sg{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;text-align:center;padding-top:40px}.paper .sg div{border-top:2px dashed #8A9A96;padding-top:10px}
"""

def cards(items):
    return '<div class="cards">' + ''.join(f'<div class="card"><span>{a}</span><strong>{b}</strong></div>' for a, b in items) + '</div>'

def steps(items):
    return '<div class="list">' + ''.join(f'<div class="item step"><span class="num">{i}</span><span>{t}</span></div>' for i, t in enumerate(items, 1)) + '</div>'

def items(rows):
    out = '<div class="list">'
    for text, kind, btns in rows:
        b = ''.join({'open': '<u>فتح</u>', 'wa': '<i>واتساب</i>', 'sign': '<s>توقيع</s>', 'ok': '<s>اعتماد</s>'}[x] for x in btns)
        out += f'<div class="item {kind}"><span>{text}</span><span class="btns">{b}</span></div>'
    return out + '</div>'

def tabs(names, on):
    return '<div class="tabs">' + ''.join(f'<span class="{"on" if i == on else ""}">{n}</span>' for i, n in enumerate(names)) + '</div>'

PHONE = f'<div class="phone"><img src="{LOGO}"><b>ثانوية الصحافة</b></div>'
SIGN = '<div class="pad"><svg width="700" height="200" viewBox="0 0 700 200"><path d="M40 140 C 120 40, 170 40, 200 120 S 290 180, 330 90 S 430 30, 470 120 S 580 160, 660 70" fill="none" stroke="#11302B" stroke-width="7" stroke-linecap="round"/></svg></div>'
PAPER = (f'<div class="paper"><div class="ph"><span><b>ثانوية الصحافة الأهلية</b><br>المملكة العربية السعودية · وزارة التعليم</span><img src="{LOGO}"><b style="color:#0E6B57;font-size:34px">التقرير الأسبوعي</b></div>'
         '<table><tr><th>الصف</th><th>الحصص</th><th>المرصودة</th><th>النسبة</th></tr><tr><td>الأول الثانوي</td><td>38</td><td>36</td><td>95%</td></tr><tr><td>الثاني الثانوي</td><td>39</td><td>35</td><td>90%</td></tr></table>'
         '<div class="sg"><div>معدّ التقرير</div><div>وكيل المدرسة</div><div>مدير المدرسة</div></div></div>')

VIDEOS = {
  2: ('تثبيت المنصة على الجوال والدخول', [
    dict(title='تثبيت المنصة على جوالك', visual=f'<div class="row">{PHONE}<div class="hero">أندرويد وآيفون<b>تطبيق بدون متجر</b></div></div>',
         say='في هذا الفيديو نتعلم تثبيت منصة ثانوية الصحافة على الجوال، ثم الدخول إليها.'),
    dict(title='على أندرويد', visual=steps(['افتح رابط المنصة في متصفح كروم', 'اضغط زر «تثبيت» في الشريط أسفل الصفحة', 'تظهر أيقونة «ثانوية الصحافة» على الشاشة الرئيسية']),
         say='على أندرويد: افتح رابط المنصة في متصفح كروم، ثم اضغط زر تثبيت في الشريط أسفل الصفحة، فتظهر أيقونة ثانوية الصحافة على الشاشة الرئيسية.'),
    dict(title='على آيفون', visual=steps(['افتح رابط المنصة في متصفح سفاري', 'اضغط زر المشاركة', 'اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة»']),
         say='على آيفون: افتح الرابط في متصفح سفاري، واضغط زر المشاركة، ثم اختر إضافة إلى الشاشة الرئيسية.'),
    dict(title='الدخول إلى المنصة', visual='<div class="login">الدخول الموحد<div>اسم المستخدم: رقم الجوال</div><div>كلمة المرور</div><p>دخول</p></div>',
         say='افتح التطبيق، وادخل باسم المستخدم وكلمة المرور الخاصين بك، فتفتح لك المنصة صفحتك حسب عملك.'),
    dict(title='تفعيل تنبيهات الجهاز', visual=items([('الإشعارات · 2 تحتاج إجراء', 'warn', []), ('تفعيل تنبيهات الجهاز', '', ['ok'])]),
         say='ومن جرس الإشعارات اضغط تفعيل تنبيهات الجهاز، لتصلك تنبيهات الحصص والطلبات الجديدة.'),
  ]),
  3: ('دليل مدير المدرسة', [
    dict(title='الصفحة الرئيسية للمدير', visual='<div class="hero">الأحد، 12 جمادى الآخرة 1448 هـ<b>صباح الخير، مدير المدرسة</b></div>' + cards([('نوع الدوام', 'حضوري'), ('حصص اليوم', '116'), ('المرصودة', '98'), ('بانتظار الرصد', '18')]),
         say='تبدأ صفحة المدير بملخص اليوم، وقائمة مطلوب الآن، واختصارات لكل أقسام المنصة.'),
    dict(title='نوع الدوام والإجازات', visual=tabs(['عن بعد', 'حضوري', 'إجازة'], 1) + items([('إجازة اليوم', '', ['ok']), ('إجازة الأسبوع', '', ['ok'])]),
         say='يحدد المدير نوع الدوام لكل يوم: عن بعد أو حضوري أو إجازة، وأيام الإجازة لا تحتسب في التقارير.'),
    dict(title='الجدول المدرسي', visual=tabs(['جدول عن بعد', 'جدول حضوري', 'ربط المعلمين'], 1) + '<table><tr><th>اليوم</th><th>الأولى<small>7:00 – 7:50</small></th><th>الثانية<small>7:50 – 8:40</small></th><th>الثالثة<small>9:05 – 9:55</small></th></tr><tr><th>الأحد</th><td>رياضيات</td><td>لغة عربية</td><td>كيمياء</td></tr></table>',
         say='وفي الجدول المدرسي يعرض المدير جدول كل فصل أو كل معلم، عن بعد أو حضوريا، ويطبعه بقالب رسمي.'),
    dict(title='ربط المعلمين بحساباتهم', visual='<table><tr><th>الاسم في الجدول</th><th>الحالة</th></tr><tr><td>معلم الرياضيات</td><td><span class="tag ok">مرتبط</span></td></tr><tr><td>معلم الكيمياء</td><td><span class="tag warn">اسم مشابه</span></td></tr><tr><td>معلم الأحياء</td><td><span class="tag bad">لا يوجد حساب</span></td></tr></table>',
         say='ويكشف تبويب ربط المعلمين كل اسم في الجدول لا يطابق حسابا، حتى يرى كل معلم حصصه وتصله تنبيهاتها.'),
    dict(title='المتابعة والتقارير', visual=cards([('التقرير الأسبوعي', 'نسب الرصد'), ('حضور الطلاب', 'يومي'), ('المساءلات', 'متابعة'), ('المؤشرات', 'شاملة')]),
         say='ومن قسم المتابعة والتقارير يتابع المدير الرصد، وحضور الطلاب، والمساءلات، ومؤشرات المدرسة.'),
  ]),
  4: ('دليل المعلم', [
    dict(title='صفحة المعلم', visual=cards([('حصص اليوم', '4'), ('تكليفاتي', '1'), ('مساءلاتي', '0'), ('مناوباتي', 'الخميس')]),
         say='يجد المعلم في صفحته جدوله، وتكليفاته، ومساءلاته، ومناوباته، في مكان واحد.'),
    dict(title='جدولي', visual='<table><tr><th>الحصة</th><th>المادة</th><th>الفصل</th><th>الوقت</th></tr><tr><td>الأولى</td><td>كيمياء</td><td>الأول الثانوي · شعبة 2</td><td>7:00 – 7:50</td></tr><tr><td>الثالثة</td><td>كيمياء</td><td>الثاني الثانوي · شعبة 1</td><td>9:05 – 9:55</td></tr></table>',
         say='يعرض جدولي حصص اليوم حسب نوع الدوام، بوقت كل حصة وفصلها.'),
    dict(title='تنبيه قبل الحصة', visual=items([('حصتك القادمة: كيمياء · الثاني الثانوي · شعبة 1 · 9:05 – 9:55', 'warn', ['open'])]),
         say='وقبل الحصة بعشر دقائق يصل المعلم تنبيه بحصته القادمة في الجرس، وعلى جواله إذا فعل التنبيهات.'),
    dict(title='حصص الانتظار', visual=items([('حصة انتظار مسندة إليك: رياضيات · الأول الثانوي · الثلاثاء 9:55 – 10:45', 'ok', ['open'])]),
         say='وإذا أسندت إليه حصة انتظار، تظهر له في الجرس باليوم والوقت والفصل.'),
    dict(title='حضور الطلاب', visual='<table><tr><th>الطالب</th><th>الحالة</th></tr><tr><td>طالب 1</td><td><span class="tag ok">حاضر</span></td></tr><tr><td>طالب 2</td><td><span class="tag bad">غائب</span></td></tr><tr><td>طالب 3</td><td><span class="tag ok">حاضر</span></td></tr></table>',
         say='ويسجل المعلم حضور طلاب حصته، فتصل البيانات مباشرة إلى تقارير الحضور.'),
  ]),
  5: ('التكليفات والتوقيعات', [
    dict(title='طلب جديد في الجرس', visual=items([('توقيع تكليف · لجنة الاختبارات', 'warn', ['open', 'wa']), ('اطلاع وإقرار · تعميم الاختبارات', '', ['open', 'wa'])]),
         say='عندما يصلك تكليف أو طلب إقرار، يظهر في جرس الإشعارات، وتفتحه بضغطة واحدة.'),
    dict(title='قراءة التكليف', visual=steps(['افتح ملف التكليف واقرأه كاملا', 'راجع البيانات واسمك وصفتك', 'انتقل إلى التوقيع']),
         say='اقرأ ملف التكليف كاملا، وراجع البيانات، ثم انتقل إلى التوقيع.'),
    dict(title='التوقيع الإلكتروني', visual=SIGN + items([('اعتماد التوقيع', '', ['sign'])]),
         say='ارسم توقيعك بإصبعك أو بالفأرة، أو ارفع صورة توقيعك، ثم اعتمده.'),
    dict(title='الإقرار بالاطلاع', visual=items([('أقر بأنني اطلعت على التعميم', 'ok', ['ok'])]),
         say='وفي طلبات الاطلاع يكفي أن تقر بالاطلاع، فيسجل اسمك وتاريخ الإقرار ووقته.'),
    dict(title='النسخة النهائية', visual=cards([('الحالة', 'مكتمل'), ('التوقيعات', '3 من 3'), ('النسخة', 'PDF'), ('الأرشيف', 'محفوظ')]),
         say='وبعد اكتمال التوقيعات، تحفظ نسخة نهائية بصيغة بي دي إف في الأرشيف.'),
  ]),
  6: ('المساءلات', [
    dict(title='رصد المساءلة', visual=steps(['يرصد مسؤول الرصد الملاحظة', 'يحدد المعلم والتاريخ والسبب', 'ترسل المساءلة إلى المعلم']),
         say='يرصد مسؤول الرصد المساءلة، ويحدد المعلم والتاريخ والسبب، ثم ترسل إلى المعلم.'),
    dict(title='إشعار المعلم', visual=items([('رد على مساءلة · بانتظار ردك', 'warn', ['open'])]),
         say='يصل المعلم إشعار بالمساءلة في الجرس، فيفتحها ويطلع عليها.'),
    dict(title='رد المعلم وتوقيعه', visual=SIGN + items([('إرسال الرد للإدارة', '', ['sign'])]),
         say='يكتب المعلم رده، ويوقعه، ويرسله إلى الإدارة.'),
    dict(title='قرار المدير', visual=items([('قرار على رد المساءلة', 'warn', ['open', 'ok'])]),
         say='ثم يطلع المدير على الرد، ويتخذ القرار المناسب.'),
    dict(title='الإغلاق والأرشفة', visual=cards([('الحالة', 'مغلقة'), ('النموذج', 'PDF'), ('السجل', 'مؤرشف'), ('المعلم', 'مطلع')]),
         say='وتغلق المساءلة وتحفظ نسختها النهائية في الأرشيف، ويطلع عليها المعلم في سجله.'),
  ]),
  7: ('التقارير والطباعة', [
    dict(title='التقرير الأسبوعي', visual=cards([('حصص الأسبوع', '116'), ('المرصودة', '104'), ('نسبة الرصد', '90%'), ('لم ترصد', '12')]),
         say='يعرض التقرير الأسبوعي نسب الرصد لكل صف ولكل معلم خلال الأسبوع.'),
    dict(title='تقارير حضور الطلاب', visual='<table><tr><th>الصف</th><th>حاضر</th><th>غائب</th><th>نسبة الحضور</th></tr><tr><td>الأول الثانوي</td><td>420</td><td>18</td><td>96%</td></tr><tr><td>الثاني الثانوي</td><td>395</td><td>25</td><td>94%</td></tr></table>',
         say='وتلخص تقارير حضور الطلاب الحضور والغياب حسب الصف والشعبة والمعلم والفترة.'),
    dict(title='قالب رسمي موحد', visual=PAPER,
         say='وتطبع كل التقارير بقالب رسمي موحد: شعار المدرسة، وعنوان التقرير وفترته، وصف التوقيعات، وتاريخ الإصدار.'),
    dict(title='الحفظ والمشاركة', visual=items([('طباعة أو حفظ PDF', '', ['ok']), ('مشاركة عبر واتساب', '', ['wa'])]),
         say='ويمكن حفظ التقرير بصيغة بي دي إف، أو مشاركته عبر واتساب مباشرة.'),
  ]),
}

def page(s, i, n):
    return ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
            '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">'
            f'<style>{CSS}</style></head><body><header><img src="{LOGO}"><div><b>ثانوية الصحافة الأهلية</b><span>منصة الإدارة والمتابعة</span></div><em>{i} / {n}</em></header>'
            f'<main><h1>{s["title"]}</h1>{s["visual"]}</main><footer>{s["say"]}</footer></body></html>')

async def voice(text, path):
    clean = re.sub('[ً-ْ]', '', text)
    for attempt in range(5):
        try:
            await edge_tts.Communicate(clean, VOICE).save(path)
            return
        except Exception as err:
            print('retry voice', attempt + 1, err, flush=True)
            await asyncio.sleep(3)
    raise SystemExit('voice failed: ' + path)

async def build(pg, num, title, scenes):
    out = f'{ROOT}/video{num}'
    os.makedirs(out, exist_ok=True)
    segs = []
    for i, s in enumerate(scenes, 1):
        audio, img, seg = f'{out}/a{i}.mp3', f'{out}/s{i}.png', f'{out}/seg{i}.mp4'
        await voice(s['say'], audio)
        dur = MP3(audio).info.length + 0.8
        await pg.set_content(page(s, i, len(scenes)), wait_until='networkidle')
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=img)
        subprocess.run([FF, '-y', '-loop', '1', '-i', img, '-i', audio, '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '30',
                        '-vf', f'fade=in:0:9,fade=out:st={dur - 0.35:.2f}:d=0.35', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-af', 'apad',
                        '-t', f'{dur:.2f}', seg], check=True, capture_output=True)
        segs.append(seg)
        print(f'video {num} scene {i} {dur:.1f}s', flush=True)
    with open(f'{out}/list.txt', 'w') as f:
        f.write(''.join(f"file '{x}'\n" for x in segs))
    subprocess.run([FF, '-y', '-f', 'concat', '-safe', '0', '-i', f'{out}/list.txt', '-c', 'copy', '-movflags', '+faststart', f'{ROOT}/video{num}.mp4'], check=True, capture_output=True)
    print(f'DONE video{num}.mp4', flush=True)

def index():
    titles = {1: 'جولة في المنصة'}
    titles.update({k: v[0] for k, v in VIDEOS.items()})
    rows = ''.join(f'<section><h3>الفيديو {k}: {html.escape(t)}</h3><video controls preload="metadata" width="720" src="video{k}.mp4"></video></section>'
                   for k, t in sorted(titles.items()) if os.path.exists(f'{ROOT}/video{k}.mp4'))
    voices = ''.join(f'<p>{html.escape(f)}<br><audio controls src="{f}"></audio></p>' for f in sorted(os.listdir(ROOT)) if f.endswith('.mp3'))
    with open(f'{ROOT}/index.html', 'w', encoding='utf-8') as f:
        f.write('<!doctype html><meta charset="utf-8"><title>فيديوهات منصة ثانوية الصحافة</title><body dir="rtl" style="font-family:sans-serif;max-width:780px;margin:24px auto;line-height:1.8">'
                f'<h2>فيديوهات شرح منصة ثانوية الصحافة</h2>{rows}<details><summary>عينات الأصوات</summary>{voices}</details>')

async def main():
    nums = [int(x) for x in sys.argv[1:]] or sorted(VIDEOS)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        pg = await browser.new_page(viewport={'width': 1920, 'height': 1080})
        for n in nums:
            title, scenes = VIDEOS[n]
            await build(pg, n, title, scenes)
            index()
        await browser.close()
    index()

asyncio.run(main())
