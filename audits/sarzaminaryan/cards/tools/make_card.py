#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ساخت کارت شاخص شهرستان — سبک مینیمال مورس.

  زمینه‌ی سفید با برجستگی نقطه و شیار
  + نشانه: کد مورس حرف اول نام شهرستان (خط = میله‌ی عمودی، نقطه = مربع)
  + رنگ اشباع‌شده‌ی استان
  + «نام شهرستان — نام استان» با فونت Vazirmatn خودِ سایت

چرا متن را مدل تصویر نمی‌نویسد: مدل‌های تصویر حروف فارسی را می‌شکنند یا
وارونه می‌چینند. اینجا متن با arabic_reshaper شکل داده و با همان فونتی که
سایت استفاده می‌کند رندر می‌شود — یعنی هر ۴۰۰ کارت پیکسل‌به‌پیکسل یکسان
و بدون نیاز به بازبینی چشمی.

پیش‌نیاز:  pip install arabic-reshaper python-bidi   +   ImageMagick

کاربرد:
    python3 make_card.py --city دورود --province لرستان --color '#e02020' \
                         --bg ../bg/bg1.webp --out ../out/dorud.webp
    python3 make_card.py --batch batch.json
"""

import argparse
import json
import os
import subprocess
import sys

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
except ImportError:
    sys.exit('نصب کنید:  pip install arabic-reshaper python-bidi')

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', 'fonts', 'Vazirmatn-Bold.ttf')

W, H = 1672, 941          # هم‌اندازه‌ی کارت‌های موجود سایت
INK = '#12161d'           # تقریباً مشکی — پررنگ‌ترین حالت
PT = 118                  # اندازه‌ی فونت (تأییدشده)
RIGHT_MARGIN = 165        # فاصله‌ی سخاوتمند از لبه‌ی راست
BASE_RATIO = 0.63         # خط پایه، نزدیک نقطه‌ی طلایی

# ---- اندازه‌ی نشانه (همین سه عدد را برای بزرگ/کوچک کردن عوض کنید) ----
SIZES = {
    'small':  dict(dash_w=20, dash_h=94,  dot=23, gap=23, pt=84),
    'medium': dict(dash_w=24, dash_h=112, dot=27, gap=27, pt=100),
    'large':  dict(dash_w=28, dash_h=132, dot=32, gap=32, pt=118),  # تأییدشده
}

# کد مورس فارسی
MORSE = {
    'ا': '.-', 'آ': '.-', 'ب': '-...', 'پ': '.--.', 'ت': '-', 'ث': '-.-.',
    'ج': '.---', 'چ': '---.', 'ح': '....', 'خ': '---', 'د': '-..', 'ذ': '...-',
    'ر': '.-.', 'ز': '--..', 'ژ': '--.', 'س': '...', 'ش': '----', 'ص': '-..-',
    'ض': '...-..', 'ط': '..-', 'ظ': '-.--', 'ع': '.-.-', 'غ': '--.-',
    'ف': '..-.', 'ق': '---..', 'ک': '-.-', 'گ': '--.-.', 'ل': '.-..',
    'م': '--', 'ن': '-.', 'و': '.--', 'ه': '..-..', 'ی': '..', 'ي': '..',
}

# ۳۱ رنگ اشباع‌شده — یکی برای هر استان، به ترتیب فهرست data/provinces.php
PALETTE = [
    '#e02020', '#0b63f6', '#00a14b', '#f25c05', '#7b2ff7', '#d6006e',
    '#009faa', '#c8102e', '#1b4dd8', '#0f9d58', '#ff8a00', '#5b21b6',
    '#ff3d7f', '#00838f', '#b8002e', '#2563eb', '#047857', '#ea580c',
    '#6d28d9', '#db2777', '#0e7490', '#991b1b', '#1d4ed8', '#15803d',
    '#c2410c', '#7e22ce', '#be185d', '#155e75', '#a21caf', '#0369a1',
    '#166534',
]


def shape(text):
    """شکل‌دهی و راست‌چین‌کردن متن فارسی برای رندر."""
    return get_display(arabic_reshaper.reshape(text))


def text_width(label, pt=PT):
    out = subprocess.run(
        ['convert', '-font', FONT, '-pointsize', str(pt),
         '-format', '%w', 'label:' + label, 'info:'],
        capture_output=True, text=True, check=False)
    return int(out.stdout.strip() or 0)


def morse_for(city):
    """مورس نخستین حرفِ فارسیِ نام."""
    for ch in city:
        if ch in MORSE:
            return MORSE[ch]
    return '.-'


def make_card(city, province, color, bg, out, size='large'):
    s = SIZES[size]
    pt = s['pt']
    label = shape(u'{} — {}'.format(city, province))
    code = morse_for(city)

    base = int(H * BASE_RATIO)
    right = W - RIGHT_MARGIN
    top = base - s['dash_h'] + int(s['dash_h'] * 0.12)
    cy = top + s['dash_h'] // 2

    draws, x = [], right
    for sym in code:                       # راست به چپ، مثل خود فارسی
        if sym == '-':
            draws.append('rectangle {},{} {},{}'.format(
                x - s['dash_w'], top, x, top + s['dash_h']))
            x -= s['dash_w'] + s['gap']
        else:
            draws.append('rectangle {},{} {},{}'.format(
                x - s['dot'], cy - s['dot'] // 2, x, cy + s['dot'] // 2))
            x -= s['dot'] + s['gap']

    tx = (x + s['gap']) - int(pt * 0.9) - text_width(label, pt)

    cmd = ['convert', bg, '-resize', '{}x{}^'.format(W, H),
           '-gravity', 'center', '-extent', '{}x{}'.format(W, H),
           '-fill', color, '-stroke', 'none']
    for d in draws:
        cmd += ['-draw', d]
    cmd += ['-font', FONT, '-pointsize', str(pt), '-fill', INK,
            '-gravity', 'NorthWest', '-annotate', '+{}+{}'.format(tx, base - pt),
            label, '-strip', '-quality', '82', out]
    subprocess.run(cmd, check=True)
    return code


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--city')
    p.add_argument('--province')
    p.add_argument('--color', default=PALETTE[0])
    p.add_argument('--bg', default=os.path.join(HERE, '..', 'bg', 'bg1.webp'))
    p.add_argument('--out')
    p.add_argument('--size', default='large', choices=list(SIZES))
    p.add_argument('--batch', help='فایل JSON: [{city,province,color,bg,out}]')
    a = p.parse_args()

    if a.batch:
        rows = json.load(open(a.batch, encoding='utf-8'))
        for r in rows:
            code = make_card(r['city'], r['province'], r.get('color', PALETTE[0]),
                             r.get('bg', a.bg), r['out'], r.get('size', a.size))
            print(u'  ✓ {:14s} {:16s} مورس {}'.format(r['city'], r['province'], code))
        print(u'\n{} کارت ساخته شد.'.format(len(rows)))
        return

    if not (a.city and a.province and a.out):
        p.error('یا --batch بدهید یا --city و --province و --out')
    code = make_card(a.city, a.province, a.color, a.bg, a.out, a.size)
    print(u'✓ {} — {}   مورس «{}» = {}'.format(a.city, a.province, a.city[0], code))


if __name__ == '__main__':
    main()
