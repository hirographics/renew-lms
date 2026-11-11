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
open(P, 'w').write(s); print('written', len(s))
