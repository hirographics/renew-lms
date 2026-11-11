"""Corrections to maker rows that were checked by hand against the maker source. Used by oemmap.py and by fix_html()."""
import json, re
CC, TCC, BM = 'nobel-cc', 'nobel-tcc', 'nobel-bm'
SRC = 'Copies the Snappy abutment, not the implant. Nobel 2017-18 catalog, PDF pages: '
# Nobel 2017-18 catalog, "Snappy abutments" pages. Checked Nov 10 2026.
# p.80 conical connection: NP 35982/35854, RP 35983/35855, RP wide 35984/35856, WP 37842/37847
# p.100 external hex:      NP 35982/35854, RP 35983/35855, WP 37842/37847
# p.114 Tri-channel:       NP 35982/35854, RP 35983/35855, WP 35984/35856, 6.0 37842/37847
SNAPPY = {
 '35982': ([[CC, 'NP'], [TCC, 'NP'], [BM, 'NP']], '80 conical, 100 external hex, 114 Tri-channel.'),
 '35854': ([[CC, 'NP'], [TCC, 'NP'], [BM, 'NP']], '80 conical, 100 external hex, 114 Tri-channel.'),
 '35983': ([[CC, 'RP'], [TCC, 'RP'], [BM, 'RP']], '80 conical, 100 external hex, 114 Tri-channel.'),
 '35855': ([[CC, 'RP'], [TCC, 'RP'], [BM, 'RP']], '80 conical, 100 external hex, 114 Tri-channel.'),
 '35984': ([[CC, 'RP'], [TCC, 'WP']], '80 conical (RP wide), 114 Tri-channel (WP).'),
 '35856': ([[CC, 'RP'], [TCC, 'WP']], '80 conical (RP wide), 114 Tri-channel (WP).'),
 '37842': ([[CC, 'WP'], [TCC, '6.0'], [BM, 'WP']], '80 conical (WP), 100 external hex (WP), 114 Tri-channel (6.0).'),
 '37847': ([[CC, 'WP'], [TCC, '6.0'], [BM, 'WP']], '80 conical (WP), 100 external hex (WP), 114 Tri-channel (6.0).'),
}
def fix_rows(rows):
    n = 0
    for o in rows:
        # Neodent 116.288 is named "SCREW FOR GM TITANIUM BASE AS". The import filed it as a Ti-base. Found in the Nov 10 2026 drawing review.
        if o[1] == 'neodent' and o[0] == '116.288' and o[3] != 'screw': o[3] = 'screw'; o[4] = 'sc-x'; o[6] = None; n += 1
        if o[1] == 'nobel' and o[0] in SNAPPY and o[3] == 'analog':
            fits, pages = SNAPPY[o[0]]
            title = o[5] if o[5].startswith('Snappy') else 'Snappy ' + o[5][0].lower() + o[5][1:]
            new = (fits, title, (SRC + pages)[:180])
            if (o[2], o[5], o[15]) != new: o[2], o[5], o[15] = [list(f) for f in fits], title, new[2]; n += 1
    return n
def fix_html(path='/mnt/user-data/outputs/renew-parts.html'):
    s = open(path).read(); a = s.index('var OEM_ROWS=') + len('var OEM_ROWS='); b = s.index('];\n', a) + 1
    rows = json.loads(s[a:b]); n = fix_rows(rows)
    if n: open(path, 'w').write(s[:a] + json.dumps(rows, separators=(',', ':')) + s[b:])
    return n, len(rows)
if __name__ == '__main__': print('rows changed, total:', fix_html())
