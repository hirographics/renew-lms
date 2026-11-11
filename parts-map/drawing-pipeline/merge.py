"""Merge traced maker outlines into the app.
usage: python3 merge.py [--dry] maker1,maker2,...(done makers)
Reads out_*.jsonl, jobs_*.json, types.json, rejects.json (hashes or maker|pn I rejected on review).
Writes var MK_TR_RAW / MK_TR / MK_TR_DONE into /mnt/user-data/outputs/renew-parts.html"""
import json, glob, sys, os
from collections import Counter, defaultdict
D = os.path.dirname(os.path.abspath(__file__))
dry = '--dry' in sys.argv
done = [a for a in sys.argv[1:] if not a.startswith('--')]
done = done[0].split(',') if done else []
T = json.load(open(D + '/types.json'))
ang = {}
for f in glob.glob(D + '/jobs_*.json'):
    for j in json.load(open(f)):
        if j.get('ang'): ang[j['maker'] + '|' + j['pn']] = j['ang']
rej = set(json.load(open(D + '/rejects.json'))) if os.path.exists(D + '/rejects.json') else set()
ANGLED_TYPES = {'mua', 'tibase', 'abutment', 'tempcyl', 'scanbody'}
NAMES = {r[1] + '|' + r[0]: r[5] for r in json.load(open(D + '/../oem/oem_rows.json'))}
# ---- identity checks added Nov 10 2026, after Richard found MIS screws drawn as analogs and drivers
import re
def enc(v): 
    n = max(0, min(1295, int(round(v * 500)))); d = '0123456789abcdefghijklmnopqrstuvwxyz'; return d[n // 36] + d[n % 36]
def dec(e):
    v = [int(e[i:i + 2], 36) / 500 for i in range(0, len(e), 2)]; return [(v[i], v[i + 1]) for i in range(0, len(v), 2)]
def xat(pts, y):
    for (y0, x0), (y1, x1) in zip(pts, pts[1:]):
        if y0 <= y <= y1: return x0 + (x1 - x0) * ((y - y0) / (y1 - y0) if y1 > y0 else 0)
    return pts[0][1] if y < pts[0][0] else pts[-1][1]
def trim_foot(raw):
    """A screw ends in its thread, which never gets wider at the tip. A wide band under the thread is the floor shadow or
    reflection from the product photo. Cut it off and rescale the outline. Returns (raw, cut height or 0)."""
    L = sorted(dec(raw[0])); R = sorted(dec(raw[1])); W = lambda y: xat(R, y) - xat(L, y)
    mid = sorted(W(0.12 + i * 0.01) for i in range(29)); shank = mid[len(mid) // 2]
    if shank <= 0: return raw, 0
    foot = max(W(i * 0.005) for i in range(1, 21))
    if foot < shank * 1.16: return raw, 0
    cut = None; seen = False
    for i in range(1, 49):
        y = i * 0.005; w = W(y)
        if w > shank * 1.12: seen = True
        elif seen and w <= shank * 1.07: cut = y; break
    if cut is None or cut > 0.22: return raw, 0
    if cut > 0.10 and foot < shank * 1.45: return raw, 0      # a tall band that is only a little wider can be a real thread
    s = 1 - cut
    def side(P):
        Q = [(0.0, xat(P, cut))] + [((y - cut) / s, x) for y, x in P if y > cut + 1e-6]; return Q
    L2 = side(L); R2 = side(R); mn = min(x for _, x in L2)
    L2 = [(y, (x - mn) / s) for y, x in L2]; R2 = [(y, (x - mn) / s) for y, x in R2]
    bands = [[round(max(0, (a - cut) / s), 3), round((b - cut) / s, 3), c] for a, b, c in raw[2] if b > cut]
    thr = raw[3]
    if thr: thr = [round(max(0, (thr[0] - cut) / s), 3), round(max(0, (thr[1] - cut) / s), 3)] + list(thr[2:])
    out = [''.join(enc(y) + enc(x) for y, x in L2), ''.join(enc(y) + enc(x) for y, x in R2), bands, thr, raw[4], round(max(x for _, x in R2), 3)]
    return out, round(cut, 3)

def why(r):
    rep = r.get('rep') or {}
    if r.get('code') != '200': return 'no photo (' + str(r.get('code')) + ')'
    if not r.get('raw'): return rep.get('reject', 'no outline')
    if r.get('hash') in rej or (r['maker'] + '|' + r['pn']) in rej: return 'rejected on review'
    if re.search(r'listed (with|on)\b', NAMES.get(r['maker'] + '|' + r['pn'], ''), re.I): return 'no picture of its own (listed with another part)'
    if r.get('hash') in MIXED: return 'one picture used for parts of different types'
    if rep.get('touch_edge'): return 'part cut off by photo edge'
    if rep.get('px_h_orig', rep.get('px_h', 0)) < 60: return 'photo too small'
    if not (0.1 < rep.get('ar', 0) < 2.5): return 'odd proportions'
    if rep.get('solidity', 1) < 0.85: return 'outline not solid'
    if rep.get('solidity', 0) > 0.999 and rep.get('ar', 0) > 0.9 and len(r['raw'][0]) <= 24: return 'picture traced as a plain block'
    k = r['maker'] + '|' + r['pn']; t = T.get(k, '')
    if not ang.get(k) and rep.get('asym_score', 0) > 0.5: return 'outline is lopsided'
    if t in ANGLED_TYPES:
        if ang.get(k) and rep.get('asym_score', 0) < 0.12: return 'photo shows a straight part, catalog says angled'
        if not ang.get(k) and t == 'mua' and rep.get('asym'): return 'photo shows an angled part, catalog says straight'
    return None

recs = {}
for f in sorted(glob.glob(D + '/out_*.jsonl')):
    for l in open(f):
        try: r = json.loads(l)
        except Exception: continue
        recs[r['maker'] + '|' + r['pn']] = r
byhash = defaultdict(set)
for k, r in recs.items():
    if r.get('raw') and r.get('hash') and not re.search(r'listed (with|on)\b', NAMES.get(k, ''), re.I): byhash[r['maker'] + r['hash']].add(T.get(k, '?'))
MIXED = set()
for k, r in recs.items():
    if r.get('hash') and len(byhash.get(r['maker'] + r['hash'], ())) > 1: MIXED.add(r['hash'])
raw_ix = {}; RAW = []; MAP = {}; stats = defaultdict(Counter); feet = Counter()
for k, r in sorted(recs.items()):
    w = why(r)
    stats[r['maker']][w or 'traced'] += 1
    if w: continue
    if T.get(k) == 'screw' and re.search(r'screw', NAMES.get(k, ''), re.I):   # not guide pins or transfer pins
        r['raw'], cut = trim_foot(r['raw'])
        if cut: feet[r['maker']] += 1
    key = json.dumps(r['raw'], separators=(',', ':'))
    if key not in raw_ix: raw_ix[key] = len(RAW); RAW.append(r['raw'])
    MAP[k] = raw_ix[key]
for m, c in sorted(stats.items()):
    tot = sum(c.values()); print(f"{m:12} {tot:4} traced {c['traced']:4} ({100*c['traced']//max(1,tot)}%)", dict((a, b) for a, b in c.items() if a != 'traced'))
print('unique outlines', len(RAW), 'parts', len(MAP)); print('screws with a shadow foot cut off', dict(feet))
data = 'var MK_TR_RAW=' + json.dumps(RAW, separators=(',', ':')) + ',MK_TR=' + json.dumps(MAP, separators=(',', ':')) + ',MK_TR_DONE=' + json.dumps({m: 1 for m in done}, separators=(',', ':')) + ';'
print('bytes', len(data))
if not dry:
    p = '/mnt/user-data/outputs/renew-parts.html'; s = open(p).read()
    a = s.index('var MK_TR_RAW='); b = s.index(';\nvar TR_GET_DESS=', a) + 1
    s = s[:a] + data + s[b:]; open(p, 'w').write(s); print('written')
