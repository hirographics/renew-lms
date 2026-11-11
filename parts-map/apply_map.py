"""Puts the Map view and the menu icons into the parts app. Safe to run again: it replaces its own blocks."""
import re, sys
P = '/mnt/user-data/outputs/renew-parts.html'; D = '/home/claude/parts-map/'
s = open(P).read()
def block(s, begin, end, new, anchor, before=True):
    if begin in s:
        a = s.index(begin); b = s.index(end, a) + len(end); return s[:a] + new + s[b:]
    assert s.count(anchor) == 1, anchor
    return s.replace(anchor, (new + '\n' + anchor) if before else (anchor + '\n' + new))
def once(s, a, b):
    if b in s: return s
    assert s.count(a) == 1, a
    return s.replace(a, b)
s = block(s, '/* MAP-CSS-BEGIN */', '/* MAP-CSS-END */', open(D + 'map.css').read().strip(), '</style>')
s = block(s, '/* ICONS-BEGIN', '/* ICONS-END */', open(D + 'icons.js').read().strip(), 'function tabsHTML(list,cur,act,label){')
s = block(s, '/* MAP-BEGIN', '/* MAP-END */', open(D + 'map.js').read().strip(), 'function render(){')
s = once(s, "var TECH_NAV=[['find','Find a part'],['patient','Patients'],['learn','Education']];", "var TECH_NAV=[['find','Find a part'],['patient','Patients'],['learn','Education'],['map','Map']];")
s = once(s, "var views={change:viewChange,patient:viewChange,find:viewFindHub,learn:viewLearn,stockhub:viewStockHub,reports:viewReportsHub,layout:viewLayout};", "var views={change:viewChange,patient:viewChange,find:viewFindHub,learn:viewLearn,map:viewMap,stockhub:viewStockHub,reports:viewReportsHub,layout:viewLayout};")
s = once(s, """' aria-current="page"':'')+'><span>'+n[1]+'</span>'+(b?""", """' aria-current="page"':'')+'><span class="nav-l">'+ico(NAV_ICON[n[0]],18)+'<span>'+n[1]+'</span></span>'+(b?""")
s = once(s, """aria-selected="'+(cur===t[0])+'">'+esc(t[1])+(b?""", """aria-selected="'+(cur===t[0])+'">'+ico(TAB_ICON[t[0]],16)+'<span>'+esc(t[1])+'</span>'+(b?""")
s = once(s, "  if(UI.view==='learn'&&UI.learnTab==='stack')stkMount();\n  if(UI.pin)focusPin();", "  if(UI.view==='learn'&&UI.learnTab==='stack')stkMount();\n  if(UI.view==='map')mapMount();\n  if(UI.pin)focusPin();")
s = once(s, "var fn=A[el.dataset.act]||LAY_ACT[el.dataset.act];if(fn)fn(el.dataset.v,el,e);", "var fn=A[el.dataset.act]||LAY_ACT[el.dataset.act]||MAP_ACT[el.dataset.act];if(fn)fn(el.dataset.v,el,e);")
s = once(s, "var LIVE_COLLS=['pulls','returns','retired','changes','requests','lines','tests'];", "var LIVE_COLLS=['pulls','returns','retired','changes','requests','lines','tests','flags'];")
s = once(s, "function liveBlank(st){st.pulls=[];", "function liveBlank(st){st.flags=[];st.pulls=[];")
s = once(s, "S.returns=S.returns||[];S.retired=S.retired||[];S.changes=S.changes||[];S.tests=S.tests||[];", "S.returns=S.returns||[];S.retired=S.retired||[];S.changes=S.changes||[];S.tests=S.tests||[];S.flags=S.flags||[];")

# ---- icons on status pills, part card actions and the side menu footer (Nov 10 2026)
s = once(s, """function pill(p){var s=status(p);return '<span class="pill p-'+s.k+'">'+s.t+'</span>'+(p.disc?' <span class="pill p-low">May be discontinued</span>':'')}""",
            """function pill(p){var s=status(p);return '<span class="pill p-'+s.k+'">'+ico(STAT_ICON[s.k],13)+s.t+'</span>'+(p.disc?' <span class="pill p-low">'+ico(UI_ICON.warn,13)+'May be discontinued</span>':'')}""")
s = once(s, """{requested:'<span class="pill p-rest">On order list</span>',ordered:'<span class="pill p-acc">Ordered</span>',received:'<span class="pill p-ok">Received, held for patient</span>'}""",
            """{requested:'<span class="pill p-rest">'+ico(STAT_ICON.list,13)+'On order list</span>',ordered:'<span class="pill p-acc">'+ico(STAT_ICON.clock,13)+'Ordered</span>',received:'<span class="pill p-ok">'+ico(STAT_ICON.ok,13)+'Received, held for patient</span>'}""")
for lab, key, n in (('Pull this part', 'pull', 1), ('Save link', 'link', 1), ('Add to order list', 'order', 1), ('Pull this set', 'set', 1), ('Place order', 'place', 1), ('Receive all', 'receive', 1), ('Hand out', 'hand', 1),
                    ('Retire', 'retire', 1), ('Can\\u2019t reuse', 'retire', 1), ('Back to tech view', 'back', 1), ('Change PIN', 'key', 1), ('Reset sample data', 'reset', 2)):
    a_ = '>' + lab + '</button>'; b_ = ">'+ico(ACT_ICON." + key + ",16)+'" + lab + '</button>'
    if b_ not in s:
        assert s.count(a_) == n, (lab, s.count(a_)); s = s.replace(a_, b_)
for a_, b_ in (("""data-act="save-counts" data-v="'+p.id+'">Save</button>""", """data-act="save-counts" data-v="'+p.id+'">'+ico(ACT_ICON.save,16)+'Save</button>"""),
               ("""data-act="recv" data-v="'+l.id+'">Receive</button>""", """data-act="recv" data-v="'+l.id+'">'+ico(ACT_ICON.receive,16)+'Receive</button>"""),
               ("""<button class="btn sm ghost x" data-act="close-drawer">Close</button>';\n  h+='<div style="margin-bottom:12px">'+locHTML(p)""", """<button class="btn sm ghost x" data-act="close-drawer">'+ico(ACT_ICON.close,16)+'Close</button>';\n  h+='<div style="margin-bottom:12px">'+locHTML(p)""")):
    s = once(s, a_, b_)

# ---- catalog checks moved from the Map to Reports (second Map design)
s = once(s, """return tabsHTML([['usage','Usage'],['checks','Checks']],t,'rep-tab','Report sections')+(t==='checks'?viewBench():viewReports());""",
            """return tabsHTML([['usage','Usage'],['checks','Checks'],['catalog','Catalog checks']],t,'rep-tab','Report sections')+(t==='catalog'?viewMapChecks():t==='checks'?viewBench():viewReports());""")
open(P, 'w').write(s); print('written', len(s))
