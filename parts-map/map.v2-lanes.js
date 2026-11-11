/* MAP-BEGIN ---- Map view, second design (Nov 10 2026, per Richard).
   Goal: a technician holds a part and wants to know what it fits and which parts belong with it.
   Position has meaning. The page reads left to right in the order the parts stack:
   implant, multi-unit abutment, the part on top, the screw. Lab-side parts (analog, transfer, scan body, healing cap) sit in a strip below.
   The first design was a dot graph. It showed that links exist but did not teach, so it was replaced. The catalog checks moved to Reports. */
var MAP_AUDIT=null,MAPX=null;
/* Lab copies of an abutment or an attachment. They sit on the abutment, so one copy can serve more than one implant connection. */
var MAP_ABUT=/abutment replica|abutment analog|lockit|locator|ball analog/i;
var MAP_L3=['tibase','tempcyl','abutment','attach','blank'],MAP_LAB=['analog','transfer','scanbody','healcap'];
function mapUI(){if(!UI.map||!UI.map.v2)UI.map={v2:1,focus:null,hist:[],q:'',more:{},flagFor:null,copy:null};return UI.map}
function mapPartKey(p){return [p.maker,p.pn||'',p.sys,p.plat,p.k||''].join('|')}
function mapToday(){var d=new Date();function z(n){return (n<10?'0':'')+n}return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())}
function mapPlatName(sys,pl){var sy=sysById(sys);return sy?sysLabel(sy)+(sy.plats.length>1||pl!=='Standard'?' '+pl:''):sys+' '+pl}
function mapFlags(){return (S.flags||[]).filter(function(f){return f.status!=='fixed'})}
function mapKey2(k){var i=k.indexOf('|');return [k.slice(0,i),k.slice(i+1)]}
function mapFits(p){return p.fits&&p.fits.length?p.fits:[[p.sys,p.plat]]}
function mapSort(a,b){return ((b.stocked?1:0)-(a.stocked?1:0))||((a.maker==='dess'?0:1)-(b.maker==='dess'?0:1))||String(a.pn).localeCompare(String(b.pn))}
function mapUniq(list){var s={},o=[];list.forEach(function(x){var k=x[0]+'|'+x[1],y=sysById(x[0]);if(!s[k]&&y&&y.plats.indexOf(x[1])>=0){s[k]=1;o.push(x)}});return o}
/* index: which implant platforms reach each multi-unit top, and how much of each system the lab stocks */
function mapIndex(){if(MAPX&&MAPX.n===S.parts.length)return MAPX;var X={n:S.parts.length,reach:{},stock:{},pstock:{}};
  S.parts.forEach(function(p){var f=mapFits(p);
    if(p.stocked)f.forEach(function(x){X.stock[x[0]]=(X.stock[x[0]]||0)+1;X.pstock[x[0]+'|'+x[1]]=(X.pstock[x[0]+'|'+x[1]]||0)+1});
    if(p.type==='mua'){var t=stkMuaSys(p);if(t&&sysById(t[0])){var tk=t[0]+'|'+t[1],r=X.reach[tk]||(X.reach[tk]={});f.forEach(function(x){var y=sysById(x[0]);if(y&&y.level==='implant')r[x[0]+'|'+x[1]]=(r[x[0]+'|'+x[1]]||0)+1})}}});
  MAPX=X;return X}
function mapSysRank(a,b){var X=mapIndex();return ((X.stock[b]||0)-(X.stock[a]||0))||sysLabel(sysById(a)).localeCompare(sysLabel(sysById(b)))}
/* the answer for one part or one platform: where it sits in the stack and what belongs with it */
function mapWorld(f){var X=mapIndex(),W={part:null,plat:null,impl:[],tops:[],base:null,note:'',kind:''};
  if(f.t==='part'){var P=partById(f.id);if(!P||!sysById(P.sys))return null;W.part=P;var fits=mapUniq(mapFits(P)),sy=sysById(P.sys);
    if(sy.level==='mua'){var tops=fits.filter(function(x){return sysById(x[0]).level==='mua'});
      if(isFam(P))SYSTEMS.forEach(function(s){if(famDess(s.id))s.plats.forEach(function(pl){tops.push([s.id,pl])})});
      W.tops=mapUniq(tops);W.kind='C';var im=[];W.tops.forEach(function(t){Object.keys(X.reach[t[0]+'|'+t[1]]||{}).forEach(function(k){im.push(mapKey2(k))})});W.impl=mapUniq(im);W.base=[P.sys,P.plat]}
    else if(P.type==='mua'){W.kind='B';W.impl=fits.filter(function(x){return sysById(x[0]).level==='implant'});var t=stkMuaSys(P);
      if(t&&sysById(t[0])){W.tops=[t];W.base=t}else W.note='The catalog does not say which top this abutment gives.'}
    else{W.kind='A';W.impl=fits;W.base=[P.sys,P.plat]}}
  else{var k=mapKey2(f.key),sy2=sysById(k[0]);if(!sy2||sy2.plats.indexOf(k[1])<0)return null;W.plat=k;W.base=k;
    if(sy2.level==='mua'){W.kind='T';W.tops=[k];W.impl=mapUniq(Object.keys(X.reach[f.key]||{}).map(mapKey2))}
    else{W.kind='I';W.impl=[k];var seen={};partsFor(k[0],k[1]).forEach(function(p){if(p.type!=='mua')return;var t2=stkMuaSys(p);if(t2&&sysById(t2[0])&&!seen[t2.join('|')]){seen[t2.join('|')]=1;W.tops.push(t2)}})}}
  W.near=W.base?partsFor(W.base[0],W.base[1]).filter(function(p){return !W.part||p.id!==W.part.id}):[];
  return W}
function mapAnswer(W){var P=W.part,n=W.impl.length,sysN={};W.impl.forEach(function(x){sysN[x[0]]=1});var ns=Object.keys(sysN).length;
  function names(l,m){return l.slice(0,m).map(function(x){return mapPlatName(x[0],x[1])}).join(', ')+(l.length>m?', and '+(l.length-m)+' more':'')}
  if(W.kind==='A')return (P.pn||'This part')+' fits '+n+' implant platform'+(n>1?'s':'')+': '+names(W.impl,5)+'. It goes direct to the implant.';
  if(W.kind==='B')return (P.pn||'This part')+' is a multi-unit abutment for '+names(W.impl,4)+'.'+(W.tops.length?' It gives the '+mapPlatName(W.tops[0][0],W.tops[0][1])+' top.':' '+W.note);
  if(W.kind==='C')return (P.pn||'This part')+' sits on a multi-unit abutment. It fits '+(W.tops.length>1?'the shared top of '+W.tops.length+' multi-unit systems':'the '+mapPlatName(W.tops[0][0],W.tops[0][1])+' top')+'. '+(n?n+' implant platform'+(n>1?'s':'')+' in '+ns+' system'+(ns>1?'s':'')+' reach that top with a multi-unit abutment.':'The catalog lists no implant that reaches it.');
  if(W.kind==='T')return 'This is a multi-unit top. '+(n?n+' implant platform'+(n>1?'s':'')+' in '+ns+' system'+(ns>1?'s':'')+' reach it with a multi-unit abutment. From here up, the parts are the same for all of them.':'The catalog lists no implant that reaches it.');
  return 'Parts for '+mapPlatName(W.plat[0],W.plat[1])+'. '+(W.tops.length?'With a multi-unit abutment it changes to the '+W.tops.map(function(t){return mapPlatName(t[0],t[1])}).slice(0,3).join(' or ')+' top.':'The catalog lists no multi-unit abutment for it.')}
/* ---- drawing the page */
function mapTile(p,held){var a='';try{a=p.sbHead==='io'?'':partArt(p)}catch(e){}
  return '<button class="mp-tile'+(held?' held':'')+'" data-act="map-part" data-v="'+esc(p.id)+'" title="'+esc(partName(p))+'"><span class="mp-art">'+(a||icon(p.type,26,'ic-in'))+'</span><span class="mp-tx"><b>'+esc(p.pn||'no number')+'</b><span>'+esc(vName(p))+'</span><i>'+esc(brandName(p.maker))+(p.stocked?' · <em>'+esc(p.bin||'stocked')+'</em>':'')+'</i></span></button>'}
function mapGroup(title,list,key,lim){var u=mapUI();if(!list.length)return '';list=list.slice().sort(mapSort);var all=u.more[key],show=all?list:list.slice(0,lim||4);
  return '<div class="mp-grp"><h4>'+esc(title)+' <span>'+list.length+'</span></h4><div class="mp-tiles">'+show.map(function(p){return mapTile(p)}).join('')+'</div>'+(list.length>show.length?'<button class="link" data-act="map-more" data-v="'+esc(key)+'">Show all '+list.length+'</button>':'')+'</div>'}
function mapPlatChips(list,cur,lim){var X=mapIndex(),by={},order=[];list.forEach(function(x){if(!by[x[0]]){by[x[0]]=[];order.push(x[0])}by[x[0]].push(x[1])});order.sort(mapSysRank);
  var u=mapUI(),all=u.more.impl||lim===0,show=all?order:order.slice(0,lim||7);
  return show.map(function(sid){var sy=sysById(sid),uses=sy.uses,st=X.stock[sid]||0;
    return '<div class="mp-sys"><div class="mp-sysn"><b>'+esc(sysLabel(sy))+'</b>'+(st?'<em>'+st+' in the drawers</em>':'')+'</div><div class="mp-chips">'+by[sid].map(function(pl){var same=uses&&uses[pl]?mapPlatName(uses[pl][0],uses[pl][1]):'';
      return '<button class="mp-chip'+(cur&&cur[0]===sid&&cur[1]===pl?' on':'')+'" data-act="map-plat" data-v="'+esc(sid+'|'+pl)+'"'+(same?' title="Same connection as '+esc(same)+'"':'')+'>'+esc(pl)+(same?'<small>= '+esc(same)+'</small>':'')+'</button>'}).join('')+'</div></div>'}).join('')+(order.length>show.length?'<button class="link" data-act="map-more" data-v="impl">Show all '+order.length+' systems</button>':'')}
function mapHeld(P){var a='';try{a=P.sbHead==='io'?'':partArt(P)}catch(e){}var fl=mapFlags().filter(function(f){return f.ref==='part:'+mapPartKey(P)});
  return '<div class="mp-held"><span class="eyebrow">The part in your hand</span><div class="mp-heldrow"><span class="mp-art big">'+(a||icon(P.type,40,'ic-in'))+'</span><div><h3>'+esc(P.pn||'')+'</h3><p>'+esc(partName(P))+'</p><p class="small muted">'+esc(brandName(P.maker))+'. '+(P.stocked?'In the drawers'+(P.bin?', '+esc(P.bin):'')+'.':'Not stocked.')+'</p></div></div>'+
    fl.map(function(f){return '<div class="map-flagged">'+ico(UI_ICON.flag,14)+'<span><b>Flagged by '+esc(f.by||'someone')+', '+esc(f.d)+'.</b> '+esc(f.note)+'</span></div>'}).join('')+
    '<div class="map-btns"><button class="btn sm" data-act="open" data-v="'+esc(P.id)+'">Open the part card</button><button class="link" data-act="map-flag">'+ico(UI_ICON.flag,14)+'This is wrong</button></div></div>'}
function mapLane(n,title,sub,body,on){return '<section class="mp-lane'+(on?' on':'')+'"><header><span class="mp-n">'+n+'</span><div><h3>'+title+'</h3><p>'+sub+'</p></div></header><div class="mp-body">'+(body||'<p class="mp-empty">Nothing is listed here.</p>')+'</div></section>'}
function mapWorldHTML(W){var u=mapUI(),P=W.part,h='',t=P?P.type:'',near=W.near;
  function of(types){return near.filter(function(p){return types.indexOf(p.type)>=0})}
  function groups(types,pre){return types.map(function(ty){return mapGroup(TYPE_LABEL[ty],near.filter(function(p){return p.type===ty}),pre+ty)}).join('')}
  var sib=P?near.filter(function(p){return p.type===P.type&&p.maker===P.maker}):[],other=P?near.filter(function(p){return p.type===P.type&&p.maker!==P.maker&&p.k===P.k}):[];
  function fam(){return mapGroup(TYPE_LABEL[t]+', more from '+brandName(P.maker),sib,'sib',6)+mapGroup('Same part from another maker',other,'oth',4)}
  h+='<div class="mp-top">'+(P?mapHeld(P):'')+'<p class="mp-answer">'+esc(mapAnswer(W))+'</p></div>';
  if(u.flagFor)h+='<div class="card mp-flag"><h3>Flag for review</h3><p class="small"><b>'+esc(u.flagFor.label)+'</b></p><p class="small muted">Say what is wrong and how you know. The flag goes on the review list in Reports. It does not change the catalog.</p><textarea id="map-note" rows="3" placeholder="Example: this screw does not seat in the 4.1 platform."></textarea><div class="map-btns"><button class="btn sm" data-act="map-flag-save">Save flag</button><button class="btn sm ghost" data-act="map-flag-cancel">Cancel</button></div></div>';
  /* lane 1: implant */
  var l1=W.impl.length?mapPlatChips(W.impl,W.plat):'';
  if(W.kind==='C'||W.kind==='T')l1=(W.impl.length?'<p class="mp-hint">These implants reach this top when they carry a multi-unit abutment.</p>':'')+l1;
  /* lane 2: multi-unit */
  var l2='';
  if(W.kind==='A')l2='<p class="mp-skip">Not used. This part goes direct to the implant.</p>';
  else if(W.kind==='B')l2=mapGroup('Other collars and angles from '+brandName(P.maker),partsFor(P.sys,P.plat).filter(function(p){return p.type==='mua'&&p.id!==P.id&&p.maker===P.maker}),'sib',6);
  else if(W.kind==='I'){var muas=partsFor(W.plat[0],W.plat[1]).filter(function(p){return p.type==='mua'});l2=mapGroup('Multi-unit abutments for this implant',muas,'mua',4)}
  if(W.tops.length&&W.kind!=='A'){var tl=W.tops.slice().sort(function(a,b){return mapSysRank(a[0],b[0])}),ta=u.more.tops?tl:tl.slice(0,5);
    l2+='<div class="mp-grp"><h4>'+(W.kind==='C'||W.kind==='T'?(tl.length>1?'The same top on '+tl.length+' systems':'The top'):'The top it gives')+'</h4><div class="mp-chips col">'+ta.map(function(x){return '<button class="mp-chip top'+(W.plat&&W.plat[0]===x[0]&&W.plat[1]===x[1]?' on':'')+'" data-act="map-plat" data-v="'+esc(x[0]+'|'+x[1])+'">'+esc(mapPlatName(x[0],x[1]))+'</button>'}).join('')+'</div>'+(tl.length>ta.length?'<button class="link" data-act="map-more" data-v="tops">Show all '+tl.length+'</button>':'')+'</div>'}
  if(W.kind==='B'&&W.note)l2+='<p class="mp-hint">'+esc(W.note)+'</p>';
  if(W.kind==='I'&&W.tops.length)l2+='<p class="mp-hint">Open a top to see the parts that go on the multi-unit abutment.</p>';
  /* lanes 3 and 4 */
  var onTop=MAP_L3.indexOf(t)>=0,isScrew=t==='screw',isLab=MAP_LAB.indexOf(t)>=0,l3='',l4='',lab='';
  var lead=W.kind==='B'?'<p class="mp-hint">These go on the '+esc(W.tops.length?mapPlatName(W.tops[0][0],W.tops[0][1]):'')+' top.</p>':(W.kind==='I'?'<p class="mp-hint">These go direct to the implant, with no multi-unit abutment.</p>':'');
  if(P&&onTop&&W.kind!=='B')l3=fam();
  l3=lead+l3+groups(MAP_L3.filter(function(x){return !(P&&onTop&&W.kind!=='B')||x!==t}),'t');
  if(P&&isScrew)l4=fam()+mapGroup('Other screws for this connection',near.filter(function(p){return p.type==='screw'&&!(p.maker===P.maker)&&p.k!==P.k}),'scr',4);
  else{var scr=near.filter(function(p){return p.type==='screw'}),ws=P&&P.withScrew?scr.filter(function(p){return String(p.pn||'').replace(/-P\d+$/,'').indexOf(P.withScrew)>=0}):[];
    if(ws.length){l4+=mapGroup('The screw it comes with',ws,'ws',4);scr=scr.filter(function(p){return ws.indexOf(p)<0})}
    l4+=mapGroup(ws.length?'Other screws for this connection':'Screws for this connection',scr,'scr',4)}
  if(P&&isLab)lab=fam();
  lab+=groups(MAP_LAB.filter(function(x){return !(P&&isLab)||x!==t}),'l');
  h+='<div class="mp-flow">'+mapLane(1,'Implant','The connection in the bone',l1,W.kind==='I')+mapLane(2,'Multi-unit abutment','Optional. It gives different implants the same top.',l2,W.kind==='B'||W.kind==='T')+mapLane(3,'On top','Ti-base, temporary cylinder, bar part or attachment',l3,P&&onTop)+mapLane(4,'Screw','Holds it down',l4,P&&isScrew)+'</div>';
  h+='<section class="mp-lab'+(P&&isLab?' on':'')+'"><header><h3>Lab side</h3><p>Copies and records of this connection: analog, impression transfer, scan body, healing cap.</p></header><div class="mp-labrow">'+(lab||'<p class="mp-empty">Nothing is listed here.</p>')+'</div></section>';
  return h}
function mapHomeHTML(){var u=mapUI(),X=mapIndex(),st=S.parts.filter(function(p){return p.stocked}),h='';
  h+='<div class="mp-home"><h2>What part are you holding?</h2><p class="muted">Pick it below, or type its part number above. The map shows what it fits and which parts belong with it.</p>';
  var ord=TYPE_ORDER.filter(function(t){return st.some(function(p){return p.type===t})});
  ord.forEach(function(t){var l=st.filter(function(p){return p.type===t}).sort(function(a,b){return String(a.bin||'~').localeCompare(String(b.bin||'~'),undefined,{numeric:true})||mapSort(a,b)});
    h+='<div class="mp-grp"><h4>'+esc(TYPE_LABEL[t])+' <span>'+l.length+' in the drawers</span></h4><div class="mp-tiles wide">'+l.map(function(p){return mapTile(p)}).join('')+'</div></div>'});
  var sys=SYSTEMS.map(function(s){return s.id}).sort(mapSysRank),all=u.more.home,show=all?sys:sys.slice(0,10);
  h+='<h2 style="margin-top:26px">Or start from an implant or a multi-unit top</h2><p class="muted">The systems the lab stocks most come first.</p><div class="mp-homesys">'+mapPlatChips(show.reduce(function(a,sid){sysById(sid).plats.forEach(function(pl){a.push([sid,pl])});return a},[]),null,0)+'</div>'+(all?'':'<button class="link" data-act="map-more" data-v="home">Show all '+sys.length+' systems</button>')+'</div>';
  return h}
function mapBodyHTML(){var u=mapUI();if(!u.focus)return mapHomeHTML();var W=mapWorld(u.focus);if(!W){u.focus=null;return mapHomeHTML()}
  return '<div class="mp-nav">'+(u.hist.length?'<button class="btn sm ghost" data-act="map-back">'+ico(ACT_ICON.back,16)+'Back</button>':'')+'<button class="btn sm ghost" data-act="map-home">Pick another part</button></div>'+mapWorldHTML(W)}
function viewMap(){var u=mapUI();
  return '<header class="vh"><h1>Map</h1><p class="lede">What a part fits, and which parts belong with it. The steps follow the order the parts stack: implant first, screw last.</p></header>'+
    '<div class="map-bar"><div class="map-search"><input id="map-q" type="search" placeholder="Type a part number or a system" value="'+esc(u.q)+'" autocomplete="off" aria-label="Find a part or a system"><div id="map-hits" class="map-hits" hidden></div></div></div><div id="map-root">'+mapBodyHTML()+'</div>'}
function mapRender(){var el=document.getElementById('map-root');if(el)el.innerHTML=mapBodyHTML()}
function mapMount(){var q=document.getElementById('map-q');if(q)q.addEventListener('input',function(){mapUI().q=q.value;mapHits()})}
function mapHits(){var box=document.getElementById('map-hits');if(!box)return;var q=mapUI().q.trim().toLowerCase(),h='';
  if(q.length>=2){var out=[];
    SYSTEMS.forEach(function(s){if(out.length<4&&(sysLabel(s).toLowerCase().indexOf(q)>=0||brandName(s.brand).toLowerCase().indexOf(q)>=0))out.push(['s:'+s.id,sysLabel(s),s.level==='mua'?'Multi-unit system':'Implant system'])});
    var seen={};S.parts.slice().sort(mapSort).some(function(p){if(String(p.pn||'').toLowerCase().indexOf(q)<0)return false;var k=p.pn+'|'+p.sys+'|'+p.plat;if(seen[k])return false;seen[k]=1;out.push(['x:'+p.id,p.pn+' '+partName(p),mapPlatName(p.sys,p.plat)+(p.stocked?' · in the drawers':'')]);return out.length>=10});
    h=out.length?out.map(function(o){return '<button data-act="map-go" data-v="'+esc(o[0])+'"><b>'+esc(o[1])+'</b><span>'+esc(o[2])+'</span></button>'}).join(''):'<div class="map-none">No match. Type a part number or a system name.</div>'}
  box.innerHTML=h;box.hidden=!h}
function mapFocus(f,keep){var u=mapUI();if(u.focus&&!keep)u.hist.push(u.focus);if(u.hist.length>30)u.hist.shift();u.focus=f;u.more={};u.flagFor=null;u.q='';var q=document.getElementById('map-q');if(q)q.value='';mapHits();mapRender();var r=document.getElementById('map-root');if(r&&r.getBoundingClientRect().top<0)r.scrollIntoView()}
/* ---- catalog checks (shown in Reports for admins) */
function mapAuditRun(){
  var by={};function put(lab,what){var seg=String(lab).split(' | ')[0],sp=seg.indexOf(' '),sid=sp<0?seg:seg.slice(0,sp),rest=sp<0?'':seg.slice(sp+1),sy=sysById(sid);if(!sy)return;
    var pl=null;sy.plats.forEach(function(x){if((rest===x||rest.indexOf(x+' ')===0)&&(!pl||x.length>pl.length))pl=x});if(pl==null)return;var k=sid+'|'+pl;(by[k]=by[k]||[]).push(what+': '+String(lab).split(' | ').slice(1).join(', '))}
  try{var a=window.renewStackAudit();a.gaps.concat(a.issues).forEach(function(g){put(g[1],'Build the stack, '+g[0])})}catch(e){}
  try{var f=window.renewFindAudit();(f.gaps||[]).concat(f.issues||[]).forEach(function(g){put(g[1],'Find a part, '+g[0])})}catch(e){}
  MAP_AUDIT=by}
function mapChecks(){var out={plats:[],links:[]},noTop={},share={};
  S.parts.forEach(function(p){var f=mapFits(p),i,j;
    if(p.type==='mua'){var t=stkMuaSys(p);if(!t||!sysById(t[0]))f.forEach(function(x){var sy=sysById(x[0]);if(sy&&sy.level==='implant')noTop[x[0]+'|'+x[1]]=(noTop[x[0]+'|'+x[1]]||0)+1})}
    if(p.type==='screw'||MAP_ABUT.test(p.v||''))return;
    for(i=0;i<f.length;i++)for(j=i+1;j<f.length;j++){if(f[i][0]===f[j][0]||!sysById(f[i][0])||!sysById(f[j][0]))continue;var a=f[i][0]+'|'+f[i][1],b=f[j][0]+'|'+f[j][1],k=a<b?a+'~'+b:b+'~'+a,o=share[k]||(share[k]={n:0,pns:[]});o.n++;if(o.pns.length<6)o.pns.push(p.pn)}});
  Object.keys(share).forEach(function(k){var ab=k.split('~'),A=mapKey2(ab[0]),B=mapKey2(ab[1]),sa=sysById(A[0]),sb=sysById(B[0]),o=share[k],why=[];
    if((sa.uses&&sa.uses[A[1]]&&sa.uses[A[1]][0]===B[0]&&sa.uses[A[1]][1]===B[1])||(sb.uses&&sb.uses[B[1]]&&sb.uses[B[1]][0]===A[0]&&sb.uses[B[1]][1]===A[1]))return;
    if(o.n<=2)why.push('Only '+o.n+' part'+(o.n>1?'s':'')+' that '+(o.n>1?'are':'is')+' not a screw link'+(o.n>1?'':'s')+' these two platforms.');
    if(sa.level==='implant'&&sb.level==='implant'){var da=platMM({sys:A[0],plat:A[1]}),db=platMM({sys:B[0],plat:B[1]});if(Math.abs(da-db)>0.45)why.push('The platform sizes differ: '+da+' mm and '+db+' mm.')}
    if(why.length)out.links.push({a:A,b:B,why:why.join(' '),pns:o.pns,ref:'link:'+k})});
  SYSTEMS.forEach(function(s){s.plats.forEach(function(pl){var key=s.id+'|'+pl,all=partsFor(s.id,pl),ty={},a=[];all.forEach(function(p){ty[p.type]=1});
    if(!all.length)a.push('No parts are listed for this platform.');else{var miss=[];if(!ty.screw)miss.push('screw');if(!ty.tibase)miss.push('Ti-base');if(s.level==='implant'&&!ty.mua)miss.push('multi-unit abutment');if(miss.length)a.push('No '+miss.join(', no ')+' is listed.')}
    if(noTop[key])a.push(noTop[key]+' multi-unit abutment'+(noTop[key]>1?'s have':' has')+' no top system in the catalog.');var g=(MAP_AUDIT&&MAP_AUDIT[key])||[];if(g.length)a.push(g.length+' gap'+(g.length>1?'s':'')+' from the stack and finder checks.');
    if(a.length)out.plats.push({key:key,name:mapPlatName(s.id,pl),text:a.join(' ')})})});
  return out}
function viewMapChecks(){if(!MAP_AUDIT)mapAuditRun();var c=mapChecks(),u=mapUI(),all=(S.flags||[]).slice().reverse(),open=mapFlags();
  var h='<header class="vh"><h1>Catalog checks</h1><p class="lede">Places where the catalog may be wrong or not complete, and the flags the team sent from the Map.</p></header>';
  h+='<div class="card"><h2 style="margin-top:0">Review list ('+open.length+' open)</h2>';
  if(!all.length)h+='<p class="muted">No flags yet. In the Map, pick a part and choose “This is wrong”.</p>';
  else{h+='<div class="map-btns"><button class="btn sm ghost" data-act="map-copy">'+ico(UI_ICON.copy,16)+'Copy the open flags</button></div>'+(u.copy?'<textarea id="map-copytxt" rows="5" readonly style="width:100%">'+esc(u.copy)+'</textarea>':'')+'<ul class="map-list">'+all.map(function(x){return '<li class="'+(x.status==='fixed'?'done':'')+'"><b>'+esc(x.label)+'</b><div class="small">'+esc(x.note)+'</div><div class="small muted">'+esc(x.by||'')+', '+esc(x.d)+(x.status==='fixed'?'. Fixed.':'')+'</div>'+(x.status!=='fixed'?'<div><button class="link" data-act="map-flag-done" data-v="'+esc(x.id)+'">Mark fixed</button></div>':'')+'</li>'}).join('')+'</ul>'}
  h+='</div><div class="card" style="margin-top:16px"><h2 style="margin-top:0">Links to check ('+c.links.length+')</h2>'+(c.links.length?'<ul class="map-list">'+c.links.map(function(l){return '<li class="warn"><b>'+esc(mapPlatName(l.a[0],l.a[1]))+' and '+esc(mapPlatName(l.b[0],l.b[1]))+'</b><div class="small">'+esc(l.why)+' Parts: '+esc(l.pns.join(', '))+'.</div></li>'}).join('')+'</ul>':'<p class="muted">None. Every part that links two systems has enough support in the catalog.</p>')+'</div>';
  h+='<div class="card" style="margin-top:16px"><h2 style="margin-top:0">Platforms with a gap ('+c.plats.length+')</h2><ul class="map-list">'+c.plats.map(function(p){return '<li><button class="link" data-act="map-checkgo" data-v="'+esc(p.key)+'">'+esc(p.name)+'</button> <span class="muted">'+esc(p.text)+'</span></li>'}).join('')+'</ul></div>';
  return h}
var MAP_ACT={
  'map-go':function(v){if(v.indexOf('x:')===0)mapFocus({t:'part',id:v.slice(2)});else{var sy=sysById(v.slice(2));if(sy)mapFocus({t:'plat',key:sy.id+'|'+sy.plats[0]})}},
  'map-part':function(v){mapFocus({t:'part',id:v})},
  'map-plat':function(v){mapFocus({t:'plat',key:v})},
  'map-back':function(){var u=mapUI(),f=u.hist.pop();if(f)mapFocus(f,true)},
  'map-home':function(){var u=mapUI();u.hist=[];u.focus=null;u.more={};u.flagFor=null;mapRender()},
  'map-more':function(v){mapUI().more[v]=true;mapRender()},
  'map-checkgo':function(v){var u=mapUI();u.hist=[];u.focus={t:'plat',key:v};u.more={};go('map')},
  'map-flag':function(){var u=mapUI(),P=u.focus&&u.focus.t==='part'&&partById(u.focus.id);if(!P)return;u.flagFor={kind:'part',ref:'part:'+mapPartKey(P),label:'Part: '+(P.pn||'')+' '+partName(P)+' ('+mapPlatName(P.sys,P.plat)+')'};mapRender();var t=document.getElementById('map-note');if(t)t.focus()},
  'map-flag-cancel':function(){mapUI().flagFor=null;mapRender()},
  'map-flag-save':function(){var u=mapUI(),t=document.getElementById('map-note'),note=t?t.value.trim():'';if(!note){toast('Type what is wrong first.');if(t)t.focus();return}
    S.flags=S.flags||[];S.flags.push({id:nextId('fl'),d:mapToday(),by:byWho(),kind:u.flagFor.kind,ref:u.flagFor.ref,label:u.flagFor.label,note:note,status:'open'});u.flagFor=null;save();toast('Flag saved to the review list.');mapRender()},
  'map-flag-done':function(v){(S.flags||[]).forEach(function(f){if(String(f.id)===String(v)){f.status='fixed';f.fixedBy=byWho();f.fixedD=mapToday()}});save();render()},
  'map-copy':function(){var u=mapUI(),txt=mapFlags().map(function(f,i){return (i+1)+'. '+f.label+'\n   '+f.note+'\n   ('+(f.by||'')+', '+f.d+', ref '+f.ref+')'}).join('\n')||'No open flags.';u.copy=txt;render();
    var done=function(){toast('Copied. Paste the list to Claude.')},sel=function(){var t=document.getElementById('map-copytxt');if(t){t.focus();t.select()}toast('Select the text and copy it.')};
    try{navigator.clipboard.writeText(txt).then(done,sel)}catch(e){sel()}}
};
/* MAP-END */
