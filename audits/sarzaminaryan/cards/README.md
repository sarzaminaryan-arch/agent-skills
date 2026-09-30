# ابزار ساخت کارت شاخص شهرستان

شرح کامل طراحی و روش: [`../07-CARDS.md`](../07-CARDS.md)

```bash
pip install arabic-reshaper python-bidi        # یک‌بار
cd tools

python3 make_card.py --city دورود --province لرستان \
                     --color '#e02020' --out ../out/dorud.webp

python3 make_card.py --batch alborz.json       # کل یک استان
```

| پوشه | چیست |
|---|---|
| `tools/make_card.py` | سازنده |
| `fonts/` | Vazirmatn-Bold، برگرفته از قالب مادر سایت (SIL OFL) |
| `bg/` | زمینه‌های سفید با برجستگی |
| `out/` | نمونه‌های تأییدشده |

**چرا متن را مدل تصویر نمی‌نویسد:** مدل‌های تصویر حروف فارسی را می‌شکنند.
اینجا متن با `arabic_reshaper` شکل داده و با فونت خودِ سایت رندر می‌شود —
یعنی هر کارت بدون خطا و بدون نیاز به بازبینی چشمی ساخته می‌شود.
