"""Trace maker parts from the product pictures in their saved PDF catalogs.
usage: python3 pdfpics.py maker [maker...]
For each part row whose source is a catalog page: find the part number on that page, take the nearest
picture above it in the same column, render only that area, trace it, delete the render.
Writes out_pdf_<maker>.jsonl in the same format as worker.py."""
import sys, os, json, hashlib, re, tempfile, math
import pymupdf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tracer import trace
D = os.path.dirname(os.path.abspath(__file__)); O = os.path.join(D, '..', 'oem')
FILES = {
 '81206_ProdCatalog2017-18_GB.pdf': 'audit/raw/8deeebd463af.pdf',
 'All-on-4%20Product%20Overview%2023.1%20GB_88398%20A.pdf': 'nobel/raw/allon4_us_88398A.pdf',
 'MIS_Conical_Connection_Catalog_USA.pdf': 'audit/raw/4be29dec3a47.pdf',
 'MIS_Internal_Hexagon_Catalog_USA.pdf': 'audit/raw/8af057152644.pdf',
 'MIS_Conical_Connection_Catalog.pdf': 'audit/raw/350601499a84.pdf',
 'Hiossen-Catalog-2026_PC26HPCLTR2.0.pdf': 'asia/raw/hiossen/Hiossen-Catalog-2026_PC26HPCLTR2.0.pdf',
 '65ceb5993c73127c619d5887_web%20catalog.pdf': 'audit/raw/0eba931f91bc.pdf',
 'AnyRidgeEN_Rev.03.pdf': 'asia/raw/megagen/AnyRidgeEN_Rev.03.pdf',
 'Noris_Product_Cat_LBL006-Rev.-2026_EN_Full-Catalog.pdf': 'audit/raw/90743855036e.pdf',
 '41a22d_3f17a67709874e089fe6f7317369e4ab.pdf': 'audit/raw/6b823aacab74.pdf',
}
def local(url):
    b = url.split('#')[0].split('/')[-1]
    if b in FILES: return os.path.join(O, FILES[b])
    for dd in ('dsz/raw/zv_pdf', 'lab/raw/sin', 'asia/raw/hiossen', 'asia/raw/megagen'):
        f = os.path.join(O, dd, b)
        if os.path.exists(f): return f
    return None

def pics(page):
    out = []
    for i in page.get_image_info(xrefs=True):
        x0, y0, x1, y1 = i['bbox']
        if (x1 - x0) < 8 or (y1 - y0) < 20: continue
        if (x1 - x0) > page.rect.width * 0.8 and (y1 - y0) > page.rect.height * 0.5: continue  # page background
        if (x1 - x0) > page.rect.width * 0.5 and (y1 - y0) < 90: continue  # header or footer banner
        if y1 < 45 or y0 > page.rect.height - 45: continue  # page margin decoration
        out.append(pymupdf.Rect(i['bbox']))
    if VECTOR:
        try:
            for r in page.cluster_drawings():
                if r.height < 40 or r.width < 10 or r.width > page.rect.width * 0.5 or r.height > page.rect.height * 0.6: continue
                if r.y1 < 45 or r.y0 > page.rect.height - 45: continue
                if any(abs(r.x0 - q.x0) < 3 and abs(r.y0 - q.y0) < 3 for q in out): continue
                # skip table grids: many text words inside
                if len(page.get_text('words', clip=r)) > 3: continue
                out.append(r)
        except Exception: pass
    return out

def norm(t): return re.sub(r'[^A-Z0-9]', '', t.upper())
OCR = {}
def words(page, ocr=False):
    if not ocr: return [(pymupdf.Rect(w[:4]), w[4]) for w in page.get_text('words')]
    k = (page.parent.name, page.number)
    if k not in OCR:
        import subprocess
        z = 3; pix = page.get_pixmap(matrix=pymupdf.Matrix(z, z)); f = os.path.join(D, '_ocr.png'); pix.save(f)
        r = subprocess.run(['tesseract', f, '-', '--psm', '11', 'tsv'], capture_output=True, text=True); os.remove(f)
        W = []
        for l in r.stdout.splitlines()[1:]:
            c = l.split('\t')
            if len(c) == 12 and c[11].strip():
                x, y, w, h = map(int, c[6:10]); W.append((pymupdf.Rect(x / z, y / z, (x + w) / z, (y + h) / z), c[11]))
        OCR[k] = W
    return OCR[k]
def find_pn(page, pn, ocr=False):
    if not ocr:
        hits = page.search_for(pn)
        if hits: return hits
    target = norm(pn)
    if not target: return []
    W = words(page, ocr)
    for i in range(len(W)):
        acc = ''; r = None
        for j in range(i, min(i + 4, len(W))):
            acc += norm(W[j][1]); r = W[j][0] if r is None else r | W[j][0]
            if acc == target: return [r]
            if not target.startswith(acc): break
    return []

VECTOR = False
def row_pic(P, hit):
    """The picture that sits in the part's own table row: left of the part number and level with it.
    Added Nov 10 2026. MIS tables put the picture beside the row, so the old 'picture above' rule took the row above."""
    cy = (hit.y0 + hit.y1) / 2; best = None; bd = 1e9
    for r in P:
        if r.x1 > hit.x0 + 6 or hit.x0 - r.x1 > 260: continue
        d = 0 if r.y0 - 3 <= cy <= r.y1 + 3 else min(abs(cy - r.y0), abs(cy - r.y1))
        if d < bd: bd = d; best = r
    return best if best is not None and bd <= 14 else None
NEAR = {'zimvie', 'dentium', 'uris', 'megagen'}
def choose(page, P, hit, mode='above'):
    W = page.rect.width; half = lambda x: x < W / 2
    if mode == 'near':
        def score(r):
            if r.y0 > hit.y1: gy = (r.y0 - hit.y1) * 3
            elif r.y1 < hit.y0: gy = hit.y0 - r.y1
            else: gy = 0
            gx = max(0, r.x0 - hit.x1, hit.x0 - r.x1)
            return math.hypot(gx * 0.5, gy)
        best = min(P, key=score)
        return best if score(best) < 260 else None
    cx = (hit.x0 + hit.x1) / 2
    cand = [r for r in P if r.y1 <= hit.y0 + 4 and (half((r.x0 + r.x1) / 2) == half(cx) or (r.x1 - r.x0) > W * 0.45)]
    if not cand: return None
    near = max(r.y1 for r in cand)
    grp = [r for r in cand if r.y1 >= near - 40]
    return max(grp, key=lambda r: r.height)

def run(maker):
    rows = json.load(open(os.path.join(O, 'oem_rows.json')))
    jobs = {}
    ang = {}
    for x in rows:
        if x[1] != maker or not x[14] or '.pdf' not in x[14] or '#page=' not in x[14]: continue
        jobs.setdefault(x[0], x[14])
        try:
            if float(x[7] or 0) > 0: ang[x[0]] = 1
        except Exception: pass
    out = os.path.join(D, 'out_pdf_%s.jsonl' % maker)
    if os.path.exists(out): os.remove(out)
    docs = {}; cache = {}
    tmp = tempfile.mkdtemp(dir=D)
    for pn, url in jobs.items():
        rec = {'pn': pn, 'maker': maker}
        f = local(url); pg = int(url.split('#page=')[1])
        if not f:
            rec['code'] = 'nofile'
        else:
            doc = docs.get(f) or docs.setdefault(f, pymupdf.open(f))
            page = doc[pg - 1]
            hits = find_pn(page, pn, ocr=(maker == 'uris'))
            P = pics(page)
            r = (row_pic(P, hits[0]) or choose(page, P, hits[0], 'near' if maker in NEAR else 'above')) if hits and P else None
            if r is not None and hits and row_pic(P, hits[0]) is not None: rec['rowpic'] = 1
            if not hits: rec['code'] = 'pn not on page'
            elif not r: rec['code'] = 'no picture'
            else:
                key = (f, pg, tuple(round(v) for v in r), bool(ang.get(pn)), bool(rec.get('rowpic')))
                if key in cache:
                    rec.update(cache[key]); rec['pn'] = pn; rec['maker'] = maker; rec['dup'] = 1
                else:
                    zoom = max(2, min(8, 700 / max(1, r.height)))
                    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=(r + (1.2, 1.2, -1.2, -1.2)) if rec.get('rowpic') else (r + (-2, -2, 2, 2)), alpha=False)  # a row picture sits in a table cell: stay inside the cell lines
                    img = os.path.join(tmp, 'c.png'); pix.save(img)
                    rec['code'] = '200'; rec['hash'] = hashlib.sha1(open(img, 'rb').read()).hexdigest()[:16] + ('a' if ang.get(pn) else '')
                    rec['src'] = {'page': pg, 'bbox': [round(v, 1) for v in r]}
                    try:
                        raw, rep = trace(img, angled=bool(ang.get(pn))); rec['raw'] = raw; rec['rep'] = rep
                    except Exception as e:
                        rec['raw'] = None; rec['rep'] = {'reject': 'trace error: ' + str(e)[:60]}
                    os.remove(img)
                    cache[key] = {k: v for k, v in rec.items() if k not in ('pn', 'maker')}
        with open(out, 'a') as o: o.write(json.dumps(rec) + '\n')
    os.rmdir(tmp)
    from collections import Counter
    L = [json.loads(l) for l in open(out)]
    print(maker, len(L), Counter(x['code'] for x in L), 'pictures', len({x.get('hash') for x in L if x.get('hash')}))

for m in sys.argv[1:]:
    VECTOR = m in ('megagen',)
    run(m)
