import re

html = open('page.html', encoding='utf-8', errors='replace').read()
text = re.sub(r'<script.*?</script>', ' ', html, flags=re.S)
text = re.sub(r'<style.*?</style>', ' ', text, flags=re.S)
text = re.sub(r'<[^>]+>', ' ', text)
text = re.sub(r'\s+', ' ', text)
open('page.txt', 'w').write(text)

keywords = ['automat', 'robot', 'scrape', 'crawl', 'unauthorized access', 'unauthoris', 'monitoring software', 'data mining']
lower = text.lower()
for kw in keywords:
    idx = 0
    found = False
    while True:
        i = lower.find(kw, idx)
        if i == -1:
            break
        found = True
        print(f'--- match for {kw!r} at {i} ---')
        print(text[max(0, i - 200):i + 200])
        print()
        idx = i + len(kw)
    if not found:
        print(f'no match for {kw!r}')
