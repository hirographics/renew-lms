"""For every part traced from a catalog PDF: was the picture taken from the part's own row, or from the row above?"""
import json, os, sys, collections
import pymupdf
import pdfpics as PP
rows = json.load(open(os.path.join(PP.O, 'oem_rows.json'))); url = {(r[1], r[0]): r[14] for r in rows}; typ = {(r[1], r[0]): r[3] for r in rows}
def row_pic(P, hit):
    cy = (hit.y0 + hit.y1) / 2; best = None; bd = 1e9
    for r in P:
        if r.x1 > hit.x0 + 6: continue                      # must sit left of the part number
        if hit.x0 - r.x1 > 260: continue
        d = 0 if r.y0 - 3 <= cy <= r.y1 + 3 else min(abs(cy - r.y0), abs(cy - r.y1))
        if d < bd: bd = d; best = r
    return best if best is not None and bd <= 14 else None
docs = {}; res = collections.defaultdict(collections.Counter); bad = collections.defaultdict(list)
for mk in sys.argv[1:]:
    f = 'out_pdf_%s.jsonl' % mk
    for l in open(f):
        r = json.loads(l)
        if r.get('code') != '200' or not r.get('src'): res[mk]['no picture'] += 1; continue
        u = url.get((mk, r['pn'])); 
        if not u: res[mk]['no url'] += 1; continue
        fn = PP.local(u); pg = r['src']['page']; doc = docs.get(fn) or docs.setdefault(fn, pymupdf.open(fn)); page = doc[pg - 1]
        hits = PP.find_pn(page, r['pn'], ocr=(mk == 'uris')); P = PP.pics(page)
        if not hits: res[mk]['pn not found'] += 1; continue
        hit = hits[0]; ch = pymupdf.Rect(r['src']['bbox']); rp = row_pic(P, hit)
        cy = (hit.y0 + hit.y1) / 2
        if rp is None: res[mk]['no row picture (picture is above or near)'] += 1
        elif abs(rp.x0 - ch.x0) < 3 and abs(rp.y0 - ch.y0) < 3: res[mk]['own row'] += 1
        else: res[mk]['WRONG ROW'] += 1; bad[mk].append(r['pn'])
for mk in res: print(mk, dict(res[mk]))
json.dump(bad, open('wrongrow.json', 'w'))
print({k: v[:12] for k, v in bad.items()})
