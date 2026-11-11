/* MAP-BEGIN ---- Map view, third design (Nov 10 2026, per Richard).
   Goal: show a technician which parts are compatible and which parts form a family.
   The page opens on a real stack for the implant the lab stocks most. It never opens on "pick a part".
   Stack view: one stack drawn apart, screw on top and implant at the bottom. Each level shows its part families as drawings. A change at one level updates the levels above it.
   Tree view: the same parts as branches from the implant.
   The screw choices come from the stack engine (stkCands), so the lab screw rules are the same as in Build the stack.
   Earlier designs are kept as map.v1-graph.js (dot graph) and map.v2-lanes.js (four columns). The catalog checks are in Reports. */
var MAP_AUDIT=null,MAPX=null;
/* Lab copies of an abutment or an attachment. They sit on the abutment, so one copy can serve more than one implant connection. */
var MAP_ABUT=/abutment replica|abutment analog|lockit|locator|ball analog/i;
var M3_L3=['tibase','tempcyl','abutment','blank','attach','healcap','scanbody','transfer'],M3_NOSCREW={healcap:1,scanbody:1,attach:1,transfer:1};
var M3_LV={1:'Implant',2:'Multi-unit abutment',3:'On top',4:'Screw'};
function mapPartKey(p){return [p.maker,p.pn||'',p.sys,p.plat,p.k||''].join('|')}
function mapToday(){var d=new Date();function z(n){return (n<10?'0':'')+n}return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())}
function mapPlatName(sys,pl){var sy=sysById(sys);return sy?sysLabel(sy)+(sy.plats.length>1||pl!=='Standard'?' '+pl:''):sys+' '+pl}
function mapFlags(){return (S.flags||[]).filter(function(f){return f.status!=='fixed'})}
function mapKey2(k){var i=k.indexOf('|');return [k.slice(0,i),k.slice(i+1)]}
function mapFits(p){return p.fits&&p.fits.length?p.fits:[[p.sys,p.plat]]}
function mapSort(a,b){return ((b.stocked?1:0)-(a.stocked?1:0))||((a.maker==='dess'?0:1)-(b.maker==='dess'?0:1))||String(a.pn).localeCompare(String(b.pn))}
function mapUniq(list){var s={},o=[];list.forEach(function(x){var k=x[0]+'|'+x[1],y=sysById(x[0]);if(!s[k]&&y&&y.plats.indexOf(x[1])>=0){s[k]=1;o.push(x)}});return o}
/* index: which implant platforms reach each multi-unit top, and how much of each system the lab stocks */
function mapIndex(){if(MAPX&&MAPX.n===S.parts.length)return MAPX;var X={n:S.parts.length,reach:{},stock:{},pstock:{},pcount:{}};
  S.parts.forEach(function(p){var f=mapFits(p);
    f.forEach(function(x){var k=x[0]+'|'+x[1];X.pcount[k]=(X.pcount[k]||0)+1;if(p.stocked){X.stock[x[0]]=(X.stock[x[0]]||0)+1;X.pstock[k]=(X.pstock[k]||0)+1}});
    if(p.type==='mua'){var t=stkMuaSys(p);if(t&&sysById(t[0])){var tk=t[0]+'|'+t[1],r=X.reach[tk]||(X.reach[tk]={});f.forEach(function(x){var y=sysById(x[0]);if(y&&y.level==='implant')r[x[0]+'|'+x[1]]=(r[x[0]+'|'+x[1]]||0)+1})}}});
  MAPX=X;return X}
function mapSysRank(a,b){var X=mapIndex();return ((X.stock[b]||0)-(X.stock[a]||0))||sysLabel(sysById(a)).localeCompare(sysLabel(sysById(b)))}
function m3PlatRank(a,b){var X=mapIndex(),ka=a[0]+'|'+a[1],kb=b[0]+'|'+b[1];return ((X.pstock[kb]||0)-(X.pstock[ka]||0))||((X.stock[b[0]]||0)-(X.stock[a[0]]||0))||((X.pcount[kb]||0)-(X.pcount[ka]||0))}
function m3BestPlat(sy){return sy.plats.map(function(pl){return [sy.id,pl]}).sort(m3PlatRank)[0]}
function m3Home(){var all=[];SYSTEMS.forEach(function(s){if(s.level==='implant')s.plats.forEach(function(pl){all.push([s.id,pl])})});return all.sort(m3PlatRank)[0]||[SYSTEMS[0].id,SYSTEMS[0].plats[0]]}
function mapUI(){if(!UI.map||!UI.map.v3)UI.map={v3:1,view:'stack',sys:null,plat:null,mua:null,top:null,screw:null,an:null,fam:{},more:{},open:{},hi:null,q:'',flagFor:null,copy:null};
  var u=UI.map,sy=u.sys&&sysById(u.sys);if(!sy||sy.plats.indexOf(u.plat)<0){var d=m3Home();u.sys=d[0];u.plat=d[1];u.mua=u.top=u.screw=u.an=null}return u}
/* ---- the model: one stack for one implant platform (or for one multi-unit top when no implant is chosen) */
function m3MuaSort(a,b){var da=muaDims(a),db=muaDims(b);return stkRank(a)-stkRank(b)||da[0]-db[0]||da[1]-db[1]||String(a.pn).localeCompare(String(b.pn))}
function m3TopOf(m){var t=stkMuaSys(m);return t&&sysById(t[0])?t:null}
/* a pack of a part that is also listed as a single part. The map shows the single part. */
var M3_PNS=null;
function m3Pack(p){var m=String(p.pn||'').match(/^(.*?)-P\d+$/);if(!m)return false;if(!M3_PNS||M3_PNS.n!==S.parts.length){M3_PNS={n:S.parts.length,has:{}};S.parts.forEach(function(q){M3_PNS.has[q.pn]=1})}return !!M3_PNS.has[m[1]]}
function m3OnTop(base){return partsFor(base[0],base[1]).filter(function(p){return M3_L3.indexOf(p.type)>=0&&!m3Pack(p)}).sort(mapSort)}
function m3TopName(t){return RP_TOP[t[0]]?mapPlatName(t[0],t[1])+' (4.8 mm)':mapPlatName(t[0],t[1])}
/* run the stack engine for this model without changing the state of Build the stack */
function m3Stk(M,topId,fn){var s=stkState(),keys=['sys','plat','mode','dess','mua','top','screw'],sv={},had={},r;keys.forEach(function(k){had[k]=k in s;sv[k]=s[k]});
  s.sys=M.eng[0];s.plat=M.eng[1];s.mode='final';s.dess=false;s.mua=M.engMua;s.top=topId;s.screw=null;
  try{r=fn()}catch(e){r=[]}keys.forEach(function(k){if(had[k])s[k]=sv[k];else delete s[k]});return r}
function m3Screws(M,T,frame){var out={list:[],rec:null,proto:null,why:'',note:''};
  if(T&&M3_NOSCREW[T.type]){out.why='own';return out}
  if(!M.base)return out;
  if(M.eng){var c=m3Stk(M,T?T.id:(frame?'direct':null),function(){return stkCands('screw')})||[];
    c.forEach(function(x){if(x.p){out.list.push(x.p);if(x.rec)out.rec=x.p}});
    if(frame&&M.top){var rule=SYS_SCREW[M.top[0]],pk=(rule&&rule.any)||DEFAULT_SCREW.proto,pp=fitScrew(pk,M.top[0],M.top[1]);if(pp&&out.list.indexOf(pp)>=0)out.proto=pp;if(rule)out.note=rule.why}}
  else if(M.top)out.list=S.parts.filter(function(p){return p.type==='screw'&&fitsAt(p,M.top[0],M.top[1])&&!/-P\d+$/.test(p.pn||'')}).sort(mapSort);
  return out}
function m3Model(){var u=mapUI(),sy=sysById(u.sys),M={u:u,sy:sy,topOnly:sy.level==='mua',muas:[],mua:null,top:null,eng:null,engMua:null,frame:false,topPart:null,onTop:[],ans:[],an:null,copies:[],base:null};
  if(M.topOnly){M.top=[u.sys,u.plat];
    S.parts.some(function(p){if(p.type!=='mua')return false;var t=stkMuaSys(p);if(!t||t[0]!==u.sys||t[1]!==u.plat)return false;
      var f=mapFits(p).filter(function(x){var y=sysById(x[0]);return y&&y.level==='implant'&&y.plats.indexOf(x[1])>=0})[0];if(!f)return false;M.eng=f;M.engMua=p.id;return true})}
  else{M.muas=S.parts.filter(function(p){return p.type==='mua'&&fitsAt(p,u.sys,u.plat)}).sort(m3MuaSort);
    var m=u.mua&&u.mua!=='skip'?partById(u.mua):null;if(m&&M.muas.indexOf(m)<0)m=null;
    if(!m&&u.mua!=='skip')m=M.muas[0]||null;u.mua=m?m.id:'skip';
    M.mua=m;M.top=m?m3TopOf(m):null;M.eng=[u.sys,u.plat];M.engMua=m?m.id:'skip';
    M.ans=partsFor(u.sys,u.plat).filter(function(p){return p.type==='analog'&&!MAP_ABUT.test(p.v||'')&&!m3Pack(p)}).sort(mapSort);M.an=(u.an&&M.ans.filter(function(p){return p.id===u.an})[0])||M.ans[0]||null}
  M.base=M.top||(M.mua?null:[u.sys,u.plat]);
  if(M.base)M.onTop=m3OnTop(M.base);
  if(M.top){M.copies=partsFor(M.top[0],M.top[1]).filter(function(p){return p.type==='analog'&&!m3Pack(p)}).sort(mapSort);if(M.topOnly)M.an=(u.an&&M.copies.filter(function(p){return p.id===u.an})[0])||M.copies[0]||null}
  var t=u.top&&u.top!=='direct'?partById(u.top):null;if(t&&M.onTop.indexOf(t)<0)t=null;
  if(!t){if(M.top){M.frame=true;u.top='direct'}else{t=M.onTop.filter(function(p){return p.type==='tibase'})[0]||M.onTop[0]||null;u.top=t?t.id:null}}
  M.topPart=t;M.scr=m3Screws(M,t,M.frame);
  var sc=u.screw&&partById(u.screw);if(sc&&M.scr.list.indexOf(sc)<0)sc=null;if(!sc)sc=M.scr.rec||M.scr.list[0]||null;u.screw=sc?sc.id:null;M.screw=sc;
  return M}
/* part families at one level */
function m3Fams(M,lv){var out=[],by={};
  function put(key,label,p,x){var f=by[key];if(!f){f=by[key]={key:key,label:label,list:[],n:out.length};if(x)for(var k in x)f[k]=x[k];out.push(f)}f.list.push(p)}
  if(lv===1&&!M.topOnly)M.ans.forEach(function(p){put('analog','Analog',p)});
  if(lv===2){var tn={},ti=0;M.muas.forEach(function(p){var t=m3TopOf(p),tk=t?t.join('|'):'?';if(!(tk in tn))tn[tk]=ti++});
    M.muas.forEach(function(p){var t=m3TopOf(p),tk=t?t.join('|'):'?',a=muaDims(p)[0]||0;put(tk+'~'+a,a?a+'° angled':'Straight',p,{grp:ti>1?(t?'Gives the '+m3TopName(t)+' top':'Top not in the catalog'):'',ang:a,ti:tn[tk]})});
    out.sort(function(a,b){return a.ti-b.ti||a.ang-b.ang});
    if(!M.topOnly)M.copies.forEach(function(p){put('lab:analog','Model analog of this top',p,{lab:1})})}
  if(lv===3){M.onTop.forEach(function(p){put(p.type,TYPE_LABEL[p.type]||p.type,p)});out.sort(function(a,b){return M3_L3.indexOf(a.key)-M3_L3.indexOf(b.key)})}
  if(lv===4)M.scr.list.forEach(function(p){put('screw','Screw',p)});
  return out}
function m3OtherFits(M,P){var X=mapIndex(),sy=sysById(P.sys),f=mapUniq(mapFits(P));
  if(sy&&sy.level==='mua'&&P.type!=='mua')return null; /* a part on a multi-unit top: the plate under it names the implants */
  return f.filter(function(x){var y=sysById(x[0]);return y.level==='implant'&&!(x[0]===M.u.sys&&x[1]===M.u.plat)}).sort(m3PlatRank)}
/* ---- drawing */
function m3Art(p,cls){var a='';if(p){try{a=p.sbHead==='io'?'':partArt(p)}catch(e){}}return '<span class="mp-art'+(cls?' '+cls:'')+'">'+(a||icon(p?p.type:'analog',cls==='xl'?64:24,'ic-in'))+'</span>'}
function m3Spec(p){if(p.type==='mua'){var d=muaDims(p);return (d[0]?d[0]+'°':'Straight')+(d[1]?', '+d[1]+' mm':'')}return vName(p)}
function m3Flagged(p){var r='part:'+mapPartKey(p);return mapFlags().filter(function(f){return f.ref===r})}
function m3Tile(p,o){o=o||{};var u=mapUI(),fl=m3Flagged(p).length;
  return '<button class="m3-t'+(o.on?' on':'')+(u.hi===p.id?' hi':'')+'" data-act="'+(o.act||'map-pick')+'" data-v="'+esc(o.act?p.id:o.lv+':'+p.id)+'" title="'+esc(partName(p))+(o.on?'. In the stack now.':'')+'"'+(o.on?' aria-pressed="true"':'')+'>'+
    (o.rec?'<em class="m3-rec">'+esc(o.rec)+'</em>':'')+(fl?'<span class="m3-flagdot" title="Flagged for review">'+ico(UI_ICON.flag,13)+'</span>':'')+m3Art(p)+'<b>'+esc(p.pn||'no number')+'</b><span>'+esc(m3Spec(p))+'</span><i>'+esc(brandName(p.maker))+(p.stocked?' <em>'+esc(p.bin||'stocked')+'</em>':'')+'</i></button>'}
function m3FamChip(f,lv,open,sel){var st=f.list.filter(function(p){return p.stocked}).length;
  return '<button class="m3-f'+(open?' on':'')+(sel?' sel':'')+(f.lab?' lab':'')+'" data-act="map-fam" data-v="'+lv+':'+esc(f.key)+'" aria-expanded="'+(open?'true':'false')+'">'+m3Art(f.list[0],'sm')+'<span><b>'+esc(f.label)+'</b><i>'+f.list.length+(st?' · <em>'+st+' in the drawers</em>':'')+'</i></span></button>'}
function m3Rail(f,lv,M,cur){var u=M.u,key='r'+lv+f.key,lim=18,idx=cur?f.list.indexOf(cur):-1,all=u.more[key]||idx>=lim,show=all?f.list:f.list.slice(0,lim);
  return '<div class="xs-rail" data-rail="'+esc(key)+'">'+show.map(function(p){var rec='';if(lv===4){if(p===M.scr.rec&&p===M.scr.proto)rec='Lab default';else if(p===M.scr.rec)rec=M.frame?'Lab default, final':(M.topPart&&M.topPart.withScrew?'Comes with it':'Lab default');else if(p===M.scr.proto)rec='Lab default, prototype'}
    return m3Tile(p,f.lab?{act:'open'}:{lv:lv,on:p===cur,rec:rec})}).join('')+(f.list.length>show.length?'<button class="m3-moret" data-act="map-more" data-v="'+esc(key)+'">+'+(f.list.length-show.length)+' more</button>':'')+'</div>'}
function m3Info(M,lv,P,o){o=o||{};var u=M.u,h='<span class="xs-lv"><b>'+lv+'</b>'+esc(o.lvName||M3_LV[lv])+'</span>';
  if(P&&u.hi===P.id)h+='<span class="xs-yours">The part you looked up</span>';
  if(!P)return h+'<h3>'+esc(o.title||'')+'</h3>'+(o.text?'<p class="muted">'+esc(o.text)+'</p>':'');
  h+='<h3>'+esc(o.title||P.pn||'no number')+'</h3><p>'+esc(o.text||partName(P))+'</p><p class="muted">'+(o.title?esc(P.pn||'')+', ':'')+esc(brandName(P.maker))+'. '+(P.stocked?'In the drawers'+(P.bin?', '+esc(P.bin):'')+'.':'Not stocked.')+'</p>';
  m3Flagged(P).forEach(function(f){h+='<div class="map-flagged">'+ico(UI_ICON.flag,14)+'<span><b>Flagged by '+esc(f.by||'someone')+', '+esc(f.d)+'.</b> '+esc(f.note)+'</span></div>'});
  var of=o.noFits?null:m3OtherFits(M,P);
  if(of&&of.length){var k='fit'+lv,openF=u.more[k];
    h+='<div class="xs-acts"><button class="link" data-act="map-toggle" data-v="'+k+'" aria-expanded="'+(openF?'true':'false')+'">'+ico(UI_ICON.fit,14)+'Also fits '+of.length+' other implant platform'+(of.length>1?'s':'')+'</button></div>';
    if(openF)h+='<div class="xs-fits">'+of.slice(0,24).map(function(x){return '<button class="m3-p sm" data-act="map-fitgo" data-v="'+esc(P.id+'~'+x[0]+'|'+x[1])+'">'+esc(mapPlatName(x[0],x[1]))+'</button>'}).join('')+(of.length>24?'<span class="muted small">and '+(of.length-24)+' more</span>':'')+'</div>'}
  h+='<div class="xs-acts"><button class="link" data-act="open" data-v="'+esc(P.id)+'">Open the part card</button><button class="link" data-act="map-flag" data-v="'+esc(P.id)+'">'+ico(UI_ICON.flag,14)+'This is wrong</button></div>';
  return h}
function m3Row(info,mid,alt){return '<section class="xs-row"><div class="xs-info">'+info+'</div><div class="xs-mid">'+mid+'</div><div class="xs-alt">'+alt+'</div></section>'}
function m3Mid(P){return P?'<button class="xs-part" data-act="open" data-v="'+esc(P.id)+'" title="Open the part card: '+esc(P.pn||'')+'">'+m3Art(P,'xl')+'</button>':''}
function m3AltHTML(M,lv,fams,cur,extra){var u=M.u,openKey=u.fam[lv],h='',cap=null;
  if(openKey===undefined&&cur){fams.forEach(function(f){if(!f.lab&&f.list.indexOf(cur)>=0)openKey=f.key})}
  if(openKey===undefined&&lv===4&&fams.length)openKey=fams[0].key;
  var openF=fams.filter(function(f){return f.key===openKey})[0]||null;
  if(!(lv===4&&fams.length<2)){h+='<div class="xs-fams">';
    fams.forEach(function(f){if(f.lab)return;if(f.grp&&f.grp!==cap){cap=f.grp;h+='<span class="xs-cap">'+esc(f.grp)+'</span>'}h+=m3FamChip(f,lv,f===openF,cur&&f.list.indexOf(cur)>=0)});
    h+=(extra||'');
    fams.forEach(function(f){if(!f.lab)return;h+='<span class="xs-sep" aria-hidden="true"></span>'+m3FamChip(f,lv,f===openF,false)});
    h+='</div>'}
  if(openF)h+=m3Rail(openF,lv,M,cur);
  return h}
function m3ReachHTML(M){var X=mapIndex(),tk=M.top[0]+'|'+M.top[1],keys=Object.keys(X.reach[tk]||{}).map(mapKey2),by={},order=[];
  keys.forEach(function(x){if(!by[x[0]]){by[x[0]]=[];order.push(x[0])}by[x[0]].push(x)});order.sort(mapSysRank);
  var u=M.u,all=u.more.reach,show=all?order:order.slice(0,7),h='';
  show.forEach(function(sid){var best=by[sid].slice().sort(m3PlatRank)[0],cur=sid===u.sys;if(cur)best=[u.sys,u.plat];
    h+='<button class="m3-p sm'+(cur?' on':'')+'" data-act="map-reach" data-v="'+esc(best[0]+'|'+best[1])+'" title="'+by[sid].length+' platform'+(by[sid].length>1?'s':'')+' of this system reach the top">'+esc(sysLabel(sysById(sid)))+'</button>'});
  if(order.length>show.length)h+='<button class="link" data-act="map-more" data-v="reach">and '+(order.length-show.length)+' more</button>';
  return {n:keys.length,ns:order.length,html:h}}
function m3PlateHTML(M){var u=M.u,sy=M.sy;
  if(M.top){var r=m3ReachHTML(M),txt=r.n?r.n+' implant platform'+(r.n>1?'s':'')+' in '+r.ns+' system'+(r.ns>1?'s':'')+' reach this top with a multi-unit abutment. From here up, the parts are the same for all of them.':'The catalog lists no implant that reaches this top.';
    if(famDess(M.top[0]))txt+=' The DESS parts for the 4.8 mm multi-unit top also fit it.';
    return '<div class="xs-plate"><h4>'+ico(UI_ICON.fit,16)+esc(m3TopName(M.top))+' top</h4><p>'+esc(txt)+'</p>'+(r.html?'<div class="xs-reach">'+r.html+'</div>':'')+'</div>'}
  if(M.mua)return '<div class="xs-plate none"><h4>Top not in the catalog</h4><p>The catalog does not say which top this abutment gives. The map cannot show the parts that go on it.</p></div>';
  var same=sy.uses&&sy.uses[u.plat]?mapPlatName(sy.uses[u.plat][0],sy.uses[u.plat][1]):'';
  return '<div class="xs-plate none"><h4>No multi-unit abutment</h4><p>The part above seats in the implant connection. It must match this implant.'+(same?' This connection is the same as '+esc(same)+'.':'')+'</p></div>'}
function m3StackHTML(M){var u=M.u,sy=M.sy,X=mapIndex(),h='',f4=m3Fams(M,4),f3=m3Fams(M,3),f2=m3Fams(M,2),f1=m3Fams(M,1);
  /* 4 screw */
  var i4,m4,a4;
  if(M.screw){i4=m3Info(M,4,M.screw);m4=m3Mid(M.screw);a4=m3AltHTML(M,4,f4,M.screw)+(M.scr.note?'<p class="xs-note">'+esc(M.scr.note)+'</p>':'')}
  else{var why=M.scr.why==='own'?'The map does not pick a screw for a '+String(TYPE_LABEL[M.topPart.type]||'part').toLowerCase()+'. Open its part card to see what comes with it.':(M.base?'No screw is listed for this choice. This is a gap in the catalog.':'Choose a multi-unit abutment with a known top first.');
    i4=m3Info(M,4,null,{title:M.scr.why==='own'?'No screw picked':'No screw listed',text:why});m4='<span class="xs-ghost">No screw</span>';a4=''}
  h+=m3Row(i4,m4,a4);
  /* 3 on top */
  var frameChip=M.top?'<button class="m3-f noart'+(M.frame?' sel':'')+'" data-act="map-pick" data-v="3:direct"'+(M.frame?' aria-pressed="true"':'')+'><span><b>Direct to multi-unit</b><i>No ti-base. The frame sits on the multi-unit.</i></span></button>':'';
  if(M.topPart)h+=m3Row(m3Info(M,3,M.topPart),m3Mid(M.topPart),m3AltHTML(M,3,f3,M.topPart,frameChip));
  else if(M.frame)h+=m3Row(m3Info(M,3,null,{title:'Direct to multi-unit',text:'No ti-base. The printed or milled frame sits on the multi-unit abutment.'}),'<span class="xs-ghost">The frame</span>',m3AltHTML(M,3,f3,null,frameChip));
  else h+=m3Row(m3Info(M,3,null,{title:'Nothing listed',text:M.base?'The catalog lists no part that sits here.':'The top of this abutment is not in the catalog.'}),'<span class="xs-ghost">No part</span>','');
  h+=m3PlateHTML(M);
  if(M.topOnly){var r=m3ReachHTML(M);
    h+=m3Row(M.an?m3Info(M,1,M.an,{lvName:'Implant and multi-unit abutment',title:m3TopName(M.top)+' top',text:'No implant is chosen. The drawing is the analog of this top.',noFits:1}):m3Info(M,1,null,{lvName:'Implant and multi-unit abutment',title:m3TopName(M.top)+' top',text:'No implant is chosen.'}),M.an?m3Mid(M.an):'<span class="xs-ghost">Any implant with this top</span>',
      '<p class="xs-note">'+(r.n?'Pick an implant system in the purple band to see its multi-unit abutments.':'The catalog lists no implant that reaches this top.')+'</p>'+(M.copies.length?m3Rail({key:'copies',list:M.copies},1,M,M.an):''));
    return '<div class="xs">'+h+'</div>'}
  /* 2 multi-unit */
  var noneChip='<button class="m3-f noart'+(M.mua?'':' sel')+'" data-act="map-pick" data-v="2:skip"'+(M.mua?'':' aria-pressed="true"')+'><span><b>No multi-unit</b><i>The next part goes on the implant.</i></span></button>';
  if(M.mua)h+=m3Row(m3Info(M,2,M.mua,{text:'Multi-unit abutment: '+m3Spec(M.mua)}),m3Mid(M.mua),m3AltHTML(M,2,f2,M.mua,noneChip));
  else h+=m3Row(m3Info(M,2,null,{title:'No multi-unit abutment',text:M.muas.length?'Choose an abutment to see the top it gives.':'The catalog lists no multi-unit abutment for this platform.'}),'<span class="xs-ghost">None</span>',M.muas.length?m3AltHTML(M,2,f2,null,noneChip):'');
  /* 1 implant */
  var plats='<div class="xs-plats"><span>Platform</span>'+sy.plats.map(function(pl){var n=X.pstock[sy.id+'|'+pl]||0;return '<button class="m3-p'+(pl===u.plat?' on':'')+'" data-act="map-plat" data-v="'+esc(sy.id+'|'+pl)+'"'+(pl===u.plat?' aria-pressed="true"':'')+'>'+esc(pl)+(n?'<small>'+n+' stocked</small>':'')+'</button>'}).join('')+'</div>';
  var i1=M.an?m3Info(M,1,M.an,{title:mapPlatName(u.sys,u.plat),text:'The implant. The drawing is its analog.',noFits:1}):m3Info(M,1,null,{title:mapPlatName(u.sys,u.plat),text:'The implant. No analog is listed, so there is no drawing.'});
  h+=m3Row(i1,M.an?m3Mid(M.an):'<span class="xs-ghost">Implant</span>',plats+m3AltHTML(M,1,f1,M.an));
  return '<div class="xs">'+h+'</div>'}
/* ---- tree */
function m3Cluster(list,key,caps){var u=mapUI(),hi=u.hi?list.indexOf(partById(u.hi)):-1,all=u.more[key]||hi>=10,show=all?list:list.slice(0,10),h='',cap=null;
  show.forEach(function(p){if(caps){var c=caps(p);if(c!==cap){cap=c;h+='<span class="xs-cap">'+esc(c)+'</span>'}}h+=m3Tile(p,{act:'open'})});
  return '<div class="tr-cl">'+h+(list.length>show.length?'<button class="m3-moret" data-act="map-more" data-v="'+esc(key)+'">+'+(list.length-show.length)+' more</button>':'')+'</div>'}
function m3Node(key,label,list,o){o=o||{};var u=mapUI(),open=!!u.open[key],st=list.filter(function(p){return p.stocked}).length;
  return '<div class="tr-n fam'+(open?' open':'')+(o.lab?' lab':'')+(o.cls?' '+o.cls:'')+'"><button class="tr-h" data-act="map-node" data-v="'+esc(key)+'" aria-expanded="'+(open?'true':'false')+'">'+m3Art(list[0],'sm')+'<span class="tr-tx"><b>'+esc(label)+'</b><i>'+(o.sub?esc(o.sub)+' ':'')+list.length+(st?' · <em>'+st+' in the drawers</em>':'')+'</i></span><span class="tr-chev" aria-hidden="true"></span></button>'+(open?m3Cluster(list,'c'+key,o.caps):'')+'</div>'}
function m3TreeFams(base,pre,isTop){var all=partsFor(base[0],base[1]),h='';
  M3_L3.forEach(function(t){var l=all.filter(function(p){return p.type===t&&!m3Pack(p)}).sort(mapSort);if(l.length)h+='<li>'+m3Node(pre+t,TYPE_LABEL[t]||t,l)+'</li>'});
  if(isTop)h+='<li><div class="tr-n leaf"><b>Direct to multi-unit</b><i>No ti-base. The frame sits on the multi-unit.</i></div></li>';
  if(isTop){var mu=all.filter(function(p){return p.type==='mua'}).sort(mapSort);if(mu.length)h+='<li>'+m3Node(pre+'mua','Multi-unit abutment part',mu,{sub:'No implant is listed for it.'})+'</li>'}
  var sc=isTop?directScrews(base[0],base[1]).concat(S.parts.filter(function(p){return p.type==='screw'&&fitsAt(p,base[0],base[1])&&/-P\d+$/.test(p.pn||'')&&!m3Pack(p)})):all.filter(function(p){return p.type==='screw'&&!m3Pack(p)}).sort(mapSort);if(sc.length)h+='<li>'+m3Node(pre+'screw','Screw',sc)+'</li>';
  var an=all.filter(function(p){return p.type==='analog'&&!m3Pack(p)&&(isTop||!MAP_ABUT.test(p.v||''))}).sort(mapSort);if(an.length)h+='<li>'+m3Node(pre+'analog',isTop?'Analog of this top':'Analog of the implant',an,{lab:1,sub:'For the model.'})+'</li>';
  var rp=isTop?[]:all.filter(function(p){return p.type==='analog'&&!m3Pack(p)&&MAP_ABUT.test(p.v||'')}).sort(mapSort);if(rp.length)h+='<li>'+m3Node(pre+'replica','Abutment replica',rp,{lab:1,sub:'For the model.'})+'</li>';
  return h}
function m3TopNode(M,t){var X=mapIndex(),keys=Object.keys(X.reach[t[0]+'|'+t[1]]||{}),ns={};keys.forEach(function(k){ns[mapKey2(k)[0]]=1});var n=Object.keys(ns).length;
  return '<div class="tr-n top"><b>'+esc(m3TopName(t))+' top</b><i>'+(keys.length?keys.length+' implant platform'+(keys.length>1?'s':'')+' in '+n+' system'+(n>1?'s':'')+' reach this top. The parts on it are the same for all of them.':'The catalog lists no implant that reaches this top.')+'</i></div>'}
function m3TreeHTML(M){var u=M.u,sy=M.sy,X=mapIndex(),h='';
  if(M.topOnly)return '<div class="tr-wrap"><ul class="tr"><li>'+m3TopNode(M,M.top)+'<ul>'+m3TreeFams(M.top,'t:'+M.top.join('|')+':',true)+'</ul></li></ul></div>';
  var root='<div class="tr-n root">'+m3Art(M.an,'')+'<div><span class="xs-lv">Implant</span><h3>'+esc(mapPlatName(u.sys,u.plat))+'</h3>'+(sy.plats.length>1?'<div class="xs-plats" style="margin-top:6px">'+sy.plats.map(function(pl){return '<button class="m3-p sm'+(pl===u.plat?' on':'')+'" data-act="map-plat" data-v="'+esc(sy.id+'|'+pl)+'">'+esc(pl)+'</button>'}).join('')+'</div>':'')+'</div></div>';
  var same=sy.uses&&sy.uses[u.plat]?mapPlatName(sy.uses[u.plat][0],sy.uses[u.plat][1]):'';
  var d=m3TreeFams([u.sys,u.plat],'d:',false);
  var groups={},order=[];M.muas.forEach(function(p){var t=m3TopOf(p),tk=t?t.join('|'):'?';if(!groups[tk]){groups[tk]={t:t,list:[]};order.push(tk)}groups[tk].list.push(p)});
  order.forEach(function(tk){var g=groups[tk];g.list.sort(function(a,b){return (muaDims(a)[0]||0)-(muaDims(b)[0]||0)||m3MuaSort(a,b)});
    h+='<li>'+m3Node('m:'+tk,'Multi-unit abutment',g.list,{cls:'br',caps:function(p){var a=muaDims(p)[0]||0;return a?a+'° angled':'Straight'}})+
      (g.t?'<ul><li>'+m3TopNode(M,g.t)+'<ul>'+m3TreeFams(g.t,'t:'+tk+':',true)+'</ul></li></ul>':'<ul><li><div class="tr-n leaf"><b>Top not in the catalog</b><i>The catalog does not say which top these abutments give.</i></div></li></ul>')+'</li>'});
  if(!M.muas.length)h+='<li><div class="tr-n leaf"><b>No multi-unit abutment listed</b><i>The catalog lists none for this platform.</i></div></li>';
  h+='<li><div class="tr-n br"><b>Straight on the implant</b><i>No multi-unit abutment. These parts must match this implant.'+(same?' Same connection as '+esc(same)+'.':'')+'</i></div>'+(d?'<ul>'+d+'</ul>':'')+'</li>';
  return '<div class="tr-wrap"><ul class="tr"><li>'+root+'<ul>'+h+'</ul></li></ul></div>'}
/* ---- page */
function m3PickHTML(M){var u=M.u,ids=SYSTEMS.filter(function(s){return s.level==='implant'}).map(function(s){return s.id}).sort(mapSysRank),top=ids.slice(0,6),h='<div class="m3-pick"><span>Implant</span>';
  if(top.indexOf(u.sys)<0&&!M.topOnly)top.push(u.sys);
  top.forEach(function(id){h+='<button class="m3-sys'+(id===u.sys?' on':'')+'" data-act="map-sys" data-v="'+esc(id)+'"'+(id===u.sys?' aria-pressed="true"':'')+'>'+esc(sysLabel(sysById(id)))+'</button>'});
  var tops=SYSTEMS.filter(function(s){return s.level==='mua'}).map(function(s){return s.id}).sort(mapSysRank);
  h+='<select id="m3-sel" aria-label="More systems"><option value="">'+(M.topOnly?esc(sysLabel(M.sy)):'More systems')+'</option><optgroup label="Implant systems">'+ids.map(function(id){return '<option value="'+esc(id)+'">'+esc(sysLabel(sysById(id)))+'</option>'}).join('')+'</optgroup><optgroup label="Multi-unit tops">'+tops.map(function(id){return '<option value="'+esc(id)+'">'+esc(sysLabel(sysById(id)))+'</option>'}).join('')+'</optgroup></select></div>';
  return h}
function mapBodyHTML(){var M=m3Model(),u=M.u,h='<div class="m3-bar"><div class="m3-seg" role="group" aria-label="View"><button data-act="map-view" data-v="stack" aria-pressed="'+(u.view==='stack')+'">Stack</button><button data-act="map-view" data-v="tree" aria-pressed="'+(u.view==='tree')+'">Tree</button></div><div class="map-search"><input id="map-q" type="search" placeholder="Type a part number to find it in the map" value="'+esc(u.q)+'" autocomplete="off" aria-label="Find a part or a system"><div id="map-hits" class="map-hits" hidden></div></div>'+m3PickHTML(M)+'</div>';
  if(u.flagFor)h+='<div class="card mp-flag"><h3>Flag for review</h3><p class="small"><b>'+esc(u.flagFor.label)+'</b></p><p class="small muted">Say what is wrong and how you know. The flag goes on the review list in Reports. It does not change the catalog.</p><textarea id="map-note" rows="3" placeholder="Example: this screw does not seat in the 4.1 platform."></textarea><div class="map-btns"><button class="btn sm" data-act="map-flag-save">Save flag</button><button class="btn sm ghost" data-act="map-flag-cancel">Cancel</button></div></div>';
  return h+(u.view==='tree'?m3TreeHTML(M):m3StackHTML(M))}
function viewMap(){var u=mapUI();
  return '<header class="vh m3-vh"><h1>Map</h1><p class="lede">How the parts stack on one implant, and which parts form a family. Change a level to see what changes above it.</p></header><div id="map-root">'+mapBodyHTML()+'</div>'}
function mapRender(){var el=document.getElementById('map-root');if(!el)return;var sc={};el.querySelectorAll('[data-rail]').forEach(function(r){sc[r.getAttribute('data-rail')]=r.scrollLeft});
  el.innerHTML=mapBodyHTML();el.querySelectorAll('[data-rail]').forEach(function(r){var k=r.getAttribute('data-rail');if(sc[k])r.scrollLeft=sc[k];else{var on=r.querySelector('.m3-t.on,.m3-t.hi');if(on&&on.offsetLeft+on.offsetWidth>r.clientWidth)r.scrollLeft=on.offsetLeft-r.clientWidth/2}})}
function mapMount(){var root=document.getElementById('map-root');if(root)root.addEventListener('input',function(e){if(e.target&&e.target.id==='map-q'){mapUI().q=e.target.value;mapHits()}});
  if(root)root.addEventListener('change',function(e){if(e.target&&e.target.id==='m3-sel'&&e.target.value)MAP_ACT['map-sys'](e.target.value)})}
function mapHits(){var box=document.getElementById('map-hits');if(!box)return;var q=mapUI().q.trim().toLowerCase(),h='';
  if(q.length>=2){var out=[];
    SYSTEMS.forEach(function(s){if(out.length<4&&(sysLabel(s).toLowerCase().indexOf(q)>=0||brandName(s.brand).toLowerCase().indexOf(q)>=0))out.push(['s:'+s.id,sysLabel(s),s.level==='mua'?'Multi-unit top':'Implant system'])});
    var seen={};S.parts.slice().sort(mapSort).some(function(p){if(String(p.pn||'').toLowerCase().indexOf(q)<0)return false;var k=p.pn+'|'+p.sys+'|'+p.plat;if(seen[k])return false;seen[k]=1;out.push(['x:'+p.id,p.pn+' '+partName(p),mapPlatName(p.sys,p.plat)+(p.stocked?' · in the drawers':'')]);return out.length>=10});
    h=out.length?out.map(function(o){return '<button data-act="map-go" data-v="'+esc(o[0])+'"><b>'+esc(o[1])+'</b><span>'+esc(o[2])+'</span></button>'}).join(''):'<div class="map-none">No match. Type a part number or a system name.</div>'}
  box.innerHTML=h;box.hidden=!h}
function m3Clear(){var u=mapUI();u.q='';var q=document.getElementById('map-q');if(q)q.value='';mapHits()}
function m3SetSys(id){var sy=sysById(id);if(!sy)return;var u=mapUI(),b=m3BestPlat(sy);u.sys=b[0];u.plat=b[1];u.mua=u.top=u.screw=u.an=u.hi=null;u.fam={};u.more={};u.flagFor=null}
/* put one part into the stack: choose the implant, the abutment and the top that show it */
var M3_NOTE='';
function m3Jump(P,pref){var u=mapUI(),X=mapIndex(),sy=sysById(P.sys);M3_NOTE='';if(!sy)return false;
  var pk=m3Pack(P)&&String(P.pn||'').match(/^(.*?)-P\d+$/);if(pk){var B=S.parts.filter(function(q){return q.pn===pk[1]&&q.sys===P.sys&&q.plat===P.plat})[0]||S.parts.filter(function(q){return q.pn===pk[1]})[0];
    if(B){var r=m3Jump(B,pref);M3_NOTE=P.pn+' is a pack of '+B.pn+'. The map shows the single part.';return r}}
  var fits=mapUniq(mapFits(P)),imp=fits.filter(function(x){return sysById(x[0]).level==='implant'}),tops=fits.filter(function(x){return sysById(x[0]).level==='mua'});
  function best(list){var a=pref&&list.filter(function(x){return x[0]===pref[0]&&x[1]===pref[1]})[0];if(a)return a;a=list.filter(function(x){return x[0]===u.sys&&x[1]===u.plat})[0];return a||list.slice().sort(m3PlatRank)[0]}
  function screwTop(){var M=m3Model(),cand=M.onTop.filter(function(p){return !M3_NOSCREW[p.type]}).slice(0,60),hit=null,soft=null;
    if(M.top&&STK_SUPER[P.k])return 'direct';
    cand.some(function(t){var s=m3Screws(M,t,false);if(s.rec===P){hit=t.id;return true}if(!soft&&s.list.indexOf(P)>=0)soft=t.id;return false});
    if(hit||soft)return hit||soft;if(M.top&&m3Screws(M,null,true).list.indexOf(P)>=0)return 'direct';return null}
  u.hi=P.id;u.fam={};u.more={};u.flagFor=null;u.screw=null;
  if(P.type==='mua'){var pl=best(imp);if(!pl){u.sys=P.sys;u.plat=P.plat;u.mua=u.top=u.an=null;u.open['t:'+P.sys+'|'+P.plat+':mua']=true;return m3Seen(P)}u.sys=pl[0];u.plat=pl[1];u.mua=P.id;u.top=null;u.an=null;u.open['m:'+((m3TopOf(P)||['?']).join('|'))]=true;return m3Seen(P)}
  if(imp.length){var pl2=best(imp);u.sys=pl2[0];u.plat=pl2[1];u.mua='skip';u.top=null;u.an=null;u.open['d:'+P.type]=true;
    if(P.type==='analog'){if(MAP_ABUT.test(P.v||'')){u.open['d:replica']=true;u.view='tree'}else{u.an=P.id;u.fam[1]='analog'}}else if(P.type==='screw'){u.top=screwTop();u.screw=P.id;u.open['d:screw']=true}else u.top=P.id;return m3Seen(P)}
  if(isFam(P))SYSTEMS.forEach(function(s){if(famDess(s.id))s.plats.forEach(function(x){tops.push([s.id,x])})});
  tops=mapUniq(tops);if(!tops.length)return false;
  function tkOf(m){var t=m3TopOf(m);return t?t.join('|'):''}var tset={};tops.forEach(function(t){tset[t.join('|')]=1});
  var cur=sysById(u.sys),found=null;
  function tryPlat(x){var ms=S.parts.filter(function(p){return p.type==='mua'&&fitsAt(p,x[0],x[1])&&tset[tkOf(p)]}).sort(m3MuaSort);if(!ms.length)return false;var keep=ms.filter(function(p){return p.id===u.mua})[0];found=[x,keep||ms[0]];return true}
  if(pref)tryPlat(pref);
  if(!found&&cur&&cur.level==='implant')tryPlat([u.sys,u.plat]);
  if(!found){var reach=[];tops.forEach(function(t){Object.keys(X.reach[t.join('|')]||{}).forEach(function(k){reach.push(mapKey2(k))})});mapUniq(reach).sort(m3PlatRank).some(tryPlat)}
  if(found){u.sys=found[0][0];u.plat=found[0][1];u.mua=found[1].id;u.an=null}else{u.sys=tops[0][0];u.plat=tops[0][1];u.mua=null;u.an=null}
  var tk=found?tkOf(found[1]):tops[0].join('|');u.open['t:'+tk+':'+P.type]=true;
  if(P.type==='analog'){if(found)u.fam[2]='lab:analog';else u.an=P.id;u.top=null}else if(P.type==='screw'){u.top=null;u.top=screwTop();u.screw=P.id;u.open['t:'+tk+':screw']=true}else u.top=P.id;
  return m3Seen(P)}
/* after a jump: if the stack cannot show the part, go to the tree, which shows every part of the platform */
function m3Seen(P){var u=mapUI(),M=m3Model();if(P===M.an||P===M.mua||P===M.topPart||P===M.screw||(u.fam[2]==='lab:analog'&&M.copies.indexOf(P)>=0))return true;
  if(P.type==='screw'){var same=M.scr.list.filter(function(q){return q.pn===P.pn})[0];if(same){u.screw=same.id;u.hi=same.id;return true}}
  u.view='tree';return m3TreeHTML(M).indexOf('data-v="'+esc(P.id)+'"')>=0}
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
  if(!all.length)h+='<p class="muted">No flags yet. In the Map, choose “This is wrong” under a part.</p>';
  else{h+='<div class="map-btns"><button class="btn sm ghost" data-act="map-copy">'+ico(UI_ICON.copy,16)+'Copy the open flags</button></div>'+(u.copy?'<textarea id="map-copytxt" rows="5" readonly style="width:100%">'+esc(u.copy)+'</textarea>':'')+'<ul class="map-list">'+all.map(function(x){return '<li class="'+(x.status==='fixed'?'done':'')+'"><b>'+esc(x.label)+'</b><div class="small">'+esc(x.note)+'</div><div class="small muted">'+esc(x.by||'')+', '+esc(x.d)+(x.status==='fixed'?'. Fixed.':'')+'</div>'+(x.status!=='fixed'?'<div><button class="link" data-act="map-flag-done" data-v="'+esc(x.id)+'">Mark fixed</button></div>':'')+'</li>'}).join('')+'</ul>'}
  h+='</div><div class="card" style="margin-top:16px"><h2 style="margin-top:0">Links to check ('+c.links.length+')</h2>'+(c.links.length?'<ul class="map-list">'+c.links.map(function(l){return '<li class="warn"><b>'+esc(mapPlatName(l.a[0],l.a[1]))+' and '+esc(mapPlatName(l.b[0],l.b[1]))+'</b><div class="small">'+esc(l.why)+' Parts: '+esc(l.pns.join(', '))+'.</div></li>'}).join('')+'</ul>':'<p class="muted">None. Every part that links two systems has enough support in the catalog.</p>')+'</div>';
  h+='<div class="card" style="margin-top:16px"><h2 style="margin-top:0">Platforms with a gap ('+c.plats.length+')</h2><ul class="map-list">'+c.plats.map(function(p){return '<li><button class="link" data-act="map-checkgo" data-v="'+esc(p.key)+'">'+esc(p.name)+'</button> <span class="muted">'+esc(p.text)+'</span></li>'}).join('')+'</ul></div>';
  return h}
var MAP_ACT={
  'map-go':function(v){if(v.indexOf('x:')===0){var P=partById(v.slice(2));if(P){if(!m3Jump(P))toast('The map has no place for this part. Open its part card.');else if(M3_NOTE)toast(M3_NOTE)}}else m3SetSys(v.slice(2));m3Clear();mapRender();var hi=document.querySelector('#map-root .hi');if(hi&&hi.scrollIntoView)hi.scrollIntoView({block:'nearest'})},
  'map-sys':function(v){m3SetSys(v);mapRender()},
  'map-plat':function(v){var k=mapKey2(v),u=mapUI(),sy=sysById(k[0]);if(!sy||sy.plats.indexOf(k[1])<0)return;u.sys=k[0];u.plat=k[1];u.an=null;u.more={};mapRender()},
  'map-reach':function(v){var k=mapKey2(v),u=mapUI(),M=m3Model(),tk=M.top?M.top.join('|'):'';u.sys=k[0];u.plat=k[1];u.an=null;u.more={};
    var m=S.parts.filter(function(p){return p.type==='mua'&&fitsAt(p,k[0],k[1])&&(m3TopOf(p)||[]).join('|')===tk}).sort(m3MuaSort)[0];u.mua=m?m.id:null;mapRender()},
  'map-pick':function(v){var i=v.indexOf(':'),lv=+v.slice(0,i),id=v.slice(i+1),u=mapUI();
    if(lv===1)u.an=id;else if(lv===2){u.mua=id;delete u.fam[2]}else if(lv===3){u.top=id;u.screw=null;if(id==='direct')delete u.fam[3]}else if(lv===4)u.screw=id;mapRender()},
  'map-fam':function(v){var i=v.indexOf(':'),lv=+v.slice(0,i),key=v.slice(i+1),u=mapUI(),M=m3Model(),cur={1:M.an,2:M.mua,3:M.topPart,4:M.screw}[lv],shown=u.fam[lv];
    if(shown===undefined&&cur)m3Fams(M,lv).forEach(function(f){if(!f.lab&&f.list.indexOf(cur)>=0)shown=f.key});
    u.fam[lv]=shown===key?null:key;mapRender()},
  'map-view':function(v){mapUI().view=v==='tree'?'tree':'stack';mapRender()},
  'map-node':function(v){var u=mapUI();u.open[v]=!u.open[v];mapRender()},
  'map-toggle':function(v){var u=mapUI();u.more[v]=!u.more[v];mapRender()},
  'map-more':function(v){mapUI().more[v]=true;mapRender()},
  'map-fitgo':function(v){var i=v.indexOf('~'),P=partById(v.slice(0,i));if(P){m3Jump(P,mapKey2(v.slice(i+1)));mapRender()}},
  'map-checkgo':function(v){var u=mapUI(),k=mapKey2(v);u.sys=k[0];u.plat=k[1];u.mua=u.top=u.screw=u.an=u.hi=null;u.fam={};u.more={};go('map')},
  'map-flag':function(v){var u=mapUI(),P=partById(v);if(!P)return;var M=m3Model(),ctx=M.topOnly?m3TopName(M.top)+' top':mapPlatName(u.sys,u.plat)+(M.mua&&M.mua!==P?', multi-unit '+(M.mua.pn||''):'')+(M.topPart&&M.topPart!==P?', on top '+(M.topPart.pn||''):'');
    u.flagFor={kind:'part',ref:'part:'+mapPartKey(P),label:'Part: '+(P.pn||'')+' '+partName(P)+'. Seen in the stack for '+ctx+'.'};mapRender();var t=document.getElementById('map-note');if(t){t.focus();if(t.scrollIntoView)t.scrollIntoView({block:'center'})}},
  'map-flag-cancel':function(){mapUI().flagFor=null;mapRender()},
  'map-flag-save':function(){var u=mapUI(),t=document.getElementById('map-note'),note=t?t.value.trim():'';if(!note){toast('Type what is wrong first.');if(t)t.focus();return}
    S.flags=S.flags||[];S.flags.push({id:nextId('fl'),d:mapToday(),by:byWho(),kind:u.flagFor.kind,ref:u.flagFor.ref,label:u.flagFor.label,note:note,status:'open'});u.flagFor=null;save();toast('Flag saved to the review list.');mapRender()},
  'map-flag-done':function(v){(S.flags||[]).forEach(function(f){if(String(f.id)===String(v)){f.status='fixed';f.fixedBy=byWho();f.fixedD=mapToday()}});save();render()},
  'map-copy':function(){var u=mapUI(),txt=mapFlags().map(function(f,i){return (i+1)+'. '+f.label+'\n   '+f.note+'\n   ('+(f.by||'')+', '+f.d+', ref '+f.ref+')'}).join('\n')||'No open flags.';u.copy=txt;render();
    var done=function(){toast('Copied. Paste the list to Claude.')},sel=function(){var t=document.getElementById('map-copytxt');if(t){t.focus();t.select()}toast('Select the text and copy it.')};
    try{navigator.clipboard.writeText(txt).then(done,sel)}catch(e){sel()}}
};
/* MAP-END */
