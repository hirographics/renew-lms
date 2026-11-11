/* MAP-BEGIN ---- Map view (Nov 10 2026, per Richard): the catalog drawn as linked dots, like the graph view in Obsidian.
   Makers, systems and platforms are always on the map. A platform opens into part-type groups, a group opens into parts.
   Links: solid gray = belongs to. Purple = multi-unit path (implant platform to the multi-unit top it gives).
   Dashed = two platforms list the same part. Orange = a shared-part link that deserves a check.
   Anyone can flag a link, platform or part as wrong. A flag is a note for review. It never changes the catalog. */
var MAPG=null,MAP_AUDIT=null,MAP_CAP=40,MAP_RAF=0;
function mapUI(){if(!UI.map)UI.map={sel:null,open:{},openG:{},q:'',prob:false,stock:false,panel:null,flagFor:null,pin:null,copy:null};return UI.map}
function mapPartKey(p){return [p.maker,p.pn||'',p.sys,p.plat,p.k||''].join('|')}
function mapToday(){var d=new Date();function z(n){return (n<10?'0':'')+n}return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())}
function mapPlatName(sys,pl){var sy=sysById(sys);return sy?sysLabel(sy)+(sy.plats.length>1||pl!=='Standard'?' '+pl:''):sys+' '+pl}
function mapFlags(){return (S.flags||[]).filter(function(f){return f.status!=='fixed'})}
function mapAuditRun(){
  var by={};function put(lab,what){var seg=String(lab).split(' | ')[0],sp=seg.indexOf(' '),sid=sp<0?seg:seg.slice(0,sp),rest=sp<0?'':seg.slice(sp+1),sy=sysById(sid);if(!sy)return;
    var pl=null;sy.plats.forEach(function(x){if((rest===x||rest.indexOf(x+' ')===0)&&(!pl||x.length>pl.length))pl=x});if(pl==null)return;var k=sid+'|'+pl;(by[k]=by[k]||[]).push(what+': '+String(lab).split(' | ').slice(1).join(', '))}
  try{var a=window.renewStackAudit();a.gaps.concat(a.issues).forEach(function(g){put(g[1],'Build the stack, '+g[0])})}catch(e){}
  try{var f=window.renewFindAudit();(f.gaps||[]).concat(f.issues||[]).forEach(function(g){put(g[1],'Find a part, '+g[0])})}catch(e){}
  MAP_AUDIT=by}
function mapBuild(){
  var u=mapUI(),pos={},G={nodes:[],links:[],by:{},view:MAPG?MAPG.view:null,cv:MAPG?MAPG.cv:null,alpha:0,refs:[],drag:null,hover:null};
  if(MAPG)MAPG.nodes.forEach(function(n){pos[n.id]=[n.x,n.y]});
  function add(n,px,py){if(pos[n.id]){n.x=pos[n.id][0];n.y=pos[n.id][1]}else{n.x=px;n.y=py;n.fresh=1}n.vx=0;n.vy=0;G.nodes.push(n);G.by[n.id]=n;return n}
  function link(a,b,kind,x){var l={a:G.by[a],b:G.by[b],kind:kind},k;if(!l.a||!l.b)return null;for(k in (x||{}))l[k]=x[k];G.links.push(l);return l}
  var flagged={};mapFlags().forEach(function(f){flagged[f.ref]=1});
  var brands=BRANDS.filter(function(b){return SYSTEMS.some(function(s){return s.brand===b.id})}),nb=brands.length;
  brands.forEach(function(b,i){var a=i/nb*Math.PI*2-Math.PI/2,bx=Math.cos(a)*640,by=Math.sin(a)*640;
    add({id:'b:'+b.id,t:'brand',label:brandName(b.id),code:b.code},bx,by);
    var sys=SYSTEMS.filter(function(s){return s.brand===b.id});
    sys.forEach(function(s,j){var a2=a+(j-(sys.length-1)/2)*0.5,sx=bx+Math.cos(a2)*150,syy=by+Math.sin(a2)*150;
      add({id:'s:'+s.id,t:'sys',sys:s.id,lvl:s.level,label:s.name.replace(/ \(.*\)$/,'')},sx,syy);link('b:'+b.id,'s:'+s.id,'h');
      s.plats.forEach(function(pl,k){var a3=a2+(k-(s.plats.length-1)/2)*0.42,key=s.id+'|'+pl,all=partsFor(s.id,pl),ty={},miss=[];
        all.forEach(function(p){ty[p.type]=(ty[p.type]||0)+1});
        if(all.length){if(!ty.screw)miss.push('screw');if(!ty.tibase)miss.push('Ti-base');if(s.level==='implant'&&!ty.mua)miss.push('multi-unit abutment')}
        var shown=u.stock?all.filter(function(p){return p.stocked}):all;
        add({id:'p:'+key,t:'plat',sys:s.id,pl:pl,key:key,lvl:s.level,label:pl,n:shown.length,total:all.length,miss:miss,noTop:0,gaps:(MAP_AUDIT&&MAP_AUDIT[key])||[],flag:flagged['plat:'+key]},sx+Math.cos(a3)*85,syy+Math.sin(a3)*85);
        link('s:'+s.id,'p:'+key,'h')})})});
  /* links between platforms, read from the parts */
  var share={},mua={};
  S.parts.forEach(function(p){var f=p.fits&&p.fits.length?p.fits:[[p.sys,p.plat]],i,j;
    if(p.type==='mua'){var t=stkMuaSys(p);f.forEach(function(x){var sy=sysById(x[0]);if(!sy||sy.level!=='implant')return;var n=G.by['p:'+x[0]+'|'+x[1]];if(!n)return;
      if(!t||!G.by['p:'+t[0]+'|'+t[1]]){n.noTop++;return}var k=n.id+'>p:'+t[0]+'|'+t[1];mua[k]=(mua[k]||0)+1})}
    for(i=0;i<f.length;i++)for(j=i+1;j<f.length;j++){if(f[i][0]===f[j][0])continue;var a='p:'+f[i][0]+'|'+f[i][1],b='p:'+f[j][0]+'|'+f[j][1];if(!G.by[a]||!G.by[b])continue;
      var k2=a<b?a+'~'+b:b+'~'+a,o=share[k2]||(share[k2]={n:0,pns:[],hard:0,ty:{}});o.n++;if(p.type!=='screw'){o.hard++;o.pns.unshift(p.pn)}else o.pns.push(p.pn);if(o.pns.length>8)o.pns.length=8;o.ty[p.type]=(o.ty[p.type]||0)+1}});
  Object.keys(mua).forEach(function(k){var ab=k.split('>');link(ab[0],ab[1],'mua',{n:mua[k]})});
  Object.keys(share).forEach(function(k){var ab=k.split('~'),o=share[k],A=G.by[ab[0]],B=G.by[ab[1]],why=[],sa=sysById(A.sys),sb=sysById(B.sys);
    var borrow=!!((sa.uses&&sa.uses[A.pl]&&sa.uses[A.pl][0]===B.sys&&sa.uses[A.pl][1]===B.pl)||(sb.uses&&sb.uses[B.pl]&&sb.uses[B.pl][0]===A.sys&&sb.uses[B.pl][1]===A.pl));
    if(!borrow&&o.hard){
      if(o.hard<=2)why.push('Only '+o.hard+' part'+(o.hard>1?'s':'')+' that '+(o.hard>1?'are':'is')+' not a screw link'+(o.hard>1?'':'s')+' these two platforms.');
      if(sa.level==='implant'&&sb.level==='implant'){var da=platMM({sys:A.sys,plat:A.pl}),db=platMM({sys:B.sys,plat:B.pl});if(Math.abs(da-db)>0.45)why.push('The platform sizes differ: '+da+' mm and '+db+' mm.')}}
    link(ab[0],ab[1],'share',{n:o.n,pns:o.pns,hard:o.hard,ty:o.ty,borrow:borrow,why:why,warn:why.length>0,ref:'link:'+k,flag:flagged['link:'+k]})});
  var famHub=G.by['p:nobel-mua|Regular'];
  if(famHub){var famN=S.parts.filter(isFam).length;SYSTEMS.forEach(function(s){if(!famDess(s.id))return;s.plats.forEach(function(pl){var id='p:'+s.id+'|'+pl;if(!G.by[id]||share[(id<famHub.id?id+'~'+famHub.id:famHub.id+'~'+id)])return;
    link(id,famHub.id,'share',{n:famN,pns:[],hard:famN,ty:{},fam:true,borrow:true,why:[],warn:false,ref:'link:'+(id<famHub.id?id+'~'+famHub.id:famHub.id+'~'+id),flag:flagged['link:'+(id<famHub.id?id+'~'+famHub.id:famHub.id+'~'+id)]})})})}
  /* opened platforms and groups */
  Object.keys(u.open).forEach(function(key){if(!u.open[key])return;var P=G.by['p:'+key];if(!P)return;var all=partsFor(P.sys,P.pl);if(u.stock)all=all.filter(function(p){return p.stocked});
    var types=TYPE_ORDER.filter(function(t){return all.some(function(p){return p.type===t})}),par=G.by['s:'+P.sys],base=Math.atan2(P.y-par.y,P.x-par.x);
    types.forEach(function(t,i){var gid='g:'+key+'|'+t,list=all.filter(function(p){return p.type===t}),a=base+(i-(types.length-1)/2)*0.55;
      list.sort(function(x,y){return ((y.stocked?1:0)-(x.stocked?1:0))||((x.maker==='dess'?0:1)-(y.maker==='dess'?0:1))||String(x.pn).localeCompare(String(y.pn))});
      var g=add({id:gid,t:'grp',key:key,type:t,label:TYPE_LABEL[t]+' '+list.length,parts:list,more:0},P.x+Math.cos(a)*70,P.y+Math.sin(a)*70);link(P.id,gid,'h');
      if(u.openG[gid]){var show=list.slice(0,MAP_CAP);if(u.pin){var pp=list.filter(function(p){return p.id===u.pin})[0];if(pp&&show.indexOf(pp)<0)show.push(pp)}g.more=list.length-show.length;
        show.forEach(function(p,j){var a2=a+(j-(show.length-1)/2)*(2.4/Math.max(show.length,6)),r=46+(j%3)*16;add({id:'x:'+p.id,t:'part',p:p,label:p.pn,flag:flagged['part:'+mapPartKey(p)]},g.x+Math.cos(a2)*r,g.y+Math.sin(a2)*r);link(gid,'x:'+p.id,'h')})}})});
  G.nodes.forEach(function(n){n.prob=n.t==='plat'&&(n.miss.length||n.noTop||n.gaps.length||!n.total)});
  G.probN=G.nodes.filter(function(n){return n.prob}).length+G.links.filter(function(l){return l.warn}).length;
  var first=!MAPG;MAPG=G;
  if(first){G.alpha=1;for(var i=0;i<420;i++)mapTick()}else if(G.nodes.some(function(n){return n.fresh})){G.alpha=0.5}
  return G}
var MAP_Q={brand:95,sys:60,plat:34,grp:24,part:10},MAP_LEN={'brand-sys':125,'sys-plat':66,'plat-grp':58,'grp-part':40};
function mapTick(){var G=MAPG,N=G.nodes,n=N.length,i,j,a,b,dx,dy,d2,d,f,al=G.alpha;if(al<0.004){G.alpha=0;return false}
  for(i=0;i<n;i++){a=N[i];for(j=i+1;j<n;j++){b=N[j];dx=b.x-a.x;dy=b.y-a.y;d2=dx*dx+dy*dy;if(d2>490000)continue;if(d2<1){dx=(i%2?1:-1)*0.5;dy=(j%2?1:-1)*0.5;d2=0.5}
    f=MAP_Q[a.t]*MAP_Q[b.t]*1.5/d2*al;d=Math.sqrt(d2);dx=dx/d*f;dy=dy/d*f;a.vx-=dx;a.vy-=dy;b.vx+=dx;b.vy+=dy}}
  G.links.forEach(function(l){var A=l.a,B=l.b,rest,k;if(l.kind==='h'){rest=MAP_LEN[A.t+'-'+B.t]||60;k=0.09}else if(l.kind==='mua'){rest=260;k=0.0011}else{rest=300;k=l.fam?0.0003:0.0009}
    var ex=B.x-A.x,ey=B.y-A.y,dd=Math.sqrt(ex*ex+ey*ey)||1,ff=(dd-rest)*k*al;ex=ex/dd*ff;ey=ey/dd*ff;A.vx+=ex;A.vy+=ey;B.vx-=ex;B.vy-=ey});
  for(i=0;i<n;i++){a=N[i];a.vx-=a.x*0.0022*al;a.vy-=a.y*0.0022*al;if(G.drag&&G.drag.node===a){a.vx=a.vy=0;continue}a.vx*=0.8;a.vy*=0.8;a.x+=Math.max(-30,Math.min(30,a.vx));a.y+=Math.max(-30,Math.min(30,a.vy))}
  G.alpha=al*0.985;return true}
function mapR(n){return n.t==='brand'?15:n.t==='sys'?9:n.t==='plat'?Math.max(4.5,Math.min(11,4+Math.sqrt(n.n)/2.2)):n.t==='grp'?5.5:3.4}
function mapFitView(only){var G=MAPG,cv=G.cv;if(!cv)return;var W=cv.clientWidth,H=cv.clientHeight,x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  (only||G.nodes).forEach(function(n){x0=Math.min(x0,n.x);x1=Math.max(x1,n.x);y0=Math.min(y0,n.y);y1=Math.max(y1,n.y)});
  var k=Math.min(W/(x1-x0+140),H/(y1-y0+120));G.view={x:(x0+x1)/2,y:(y0+y1)/2,k:Math.max(0.12,Math.min(only?1.6:2.2,k))}}
function mapNear(id){var G=MAPG,set={},n=G.by[id];if(!n)return set;set[id]=1;
  G.links.forEach(function(l){if(l.a.id===id)set[l.b.id]=1;if(l.b.id===id)set[l.a.id]=1});
  if(n.t==='brand'||n.t==='sys'){G.links.forEach(function(l){if(l.kind==='h'&&set[l.a.id]&&(l.a.t==='sys'||l.a.t==='brand'))set[l.b.id]=1})}
  if(n.t==='part'||n.t==='grp'){var key=n.t==='grp'?n.key:n.p&&null,g=n;if(n.t==='part'){G.links.forEach(function(l){if(l.kind==='h'&&l.b===n)g=l.a})}
    key=g.key;set[g.id]=1;set['p:'+key]=1;var P=G.by['p:'+key];if(P){set['s:'+P.sys]=1;G.nodes.forEach(function(x){if(x.t==='grp'&&x.key===key)set[x.id]=1})}}
  return set}
function mapDraw(){var G=MAPG,cv=G&&G.cv;if(!cv||!cv.isConnected)return;var u=mapUI(),dpr=Math.min(window.devicePixelRatio||1,2),W=cv.clientWidth,H=cv.clientHeight;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  if(!G.view)mapFitView();var c=cv.getContext('2d'),v=G.view,cs=getComputedStyle(document.documentElement);
  function col(n){return cs.getPropertyValue(n).trim()}
  var C={ink:col('--ink'),muted:col('--muted'),line:col('--line'),acc:col('--accent'),accS:col('--accent-soft'),rest:col('--rest'),restS:col('--rest-soft'),out:col('--out'),low:col('--low'),ok:col('--ok'),surf:col('--surface'),s2:col('--surface2'),label:col('--label')};
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  function X(x){return (x-v.x)*v.k+W/2}function Y(y){return (y-v.y)*v.k+H/2}
  var near=u.sel?mapNear(u.sel):null;
  function dim(n){if(near)return !near[n.id];if(u.prob)return !(n.prob||n.flag);return false}
  function ldim(l){if(near)return !(l.a.id===u.sel||l.b.id===u.sel||(l.kind==='h'&&near[l.a.id]&&near[l.b.id]));if(u.prob)return !(l.warn||l.flag);return false}
  c.lineCap='round';
  G.links.forEach(function(l){var d=ldim(l),sel=u.sel&&(l.a.id===u.sel||l.b.id===u.sel);
    if(l.kind==='share'&&!l.warn&&!l.flag&&!sel&&v.k<0.3)return;
    c.beginPath();c.moveTo(X(l.a.x),Y(l.a.y));c.lineTo(X(l.b.x),Y(l.b.y));c.setLineDash([]);
    if(l.kind==='h'){c.strokeStyle=C.line;c.lineWidth=1.2;c.globalAlpha=d?0.25:1}
    else if(l.kind==='mua'){c.strokeStyle=C.rest;c.lineWidth=1+Math.min(2,Math.log(l.n+1)/2);c.globalAlpha=d?0.06:(sel?0.95:0.42)}
    else{c.setLineDash(l.warn?[2,4]:[5,5]);c.strokeStyle=l.warn?C.low:(l.flag?C.out:C.muted);c.lineWidth=l.warn||l.flag?2:1;c.globalAlpha=d?0.04:(l.warn||l.flag?0.95:(sel?0.85:0.22))}
    c.stroke()});
  c.setLineDash([]);c.globalAlpha=1;
  var labels=[];
  G.nodes.forEach(function(n){var x=X(n.x),y=Y(n.y);if(x<-60||y<-60||x>W+60||y>H+60)return;var r=mapR(n)*Math.max(0.55,Math.min(1.5,Math.sqrt(v.k))),d=dim(n),sel=u.sel===n.id,hov=G.hover===n;
    c.globalAlpha=d?0.16:1;c.beginPath();c.arc(x,y,r,0,6.2832);
    if(n.t==='brand'){c.fillStyle=C.ink;c.fill()}
    else if(n.t==='sys'){c.fillStyle=n.lvl==='mua'?C.rest:C.acc;c.fill()}
    else if(n.t==='plat'){if(!n.total){c.fillStyle=C.surf;c.fill();c.setLineDash([2,2]);c.strokeStyle=C.muted;c.lineWidth=1.5;c.stroke();c.setLineDash([])}else{c.fillStyle=n.lvl==='mua'?C.restS:C.accS;c.fill();c.strokeStyle=n.lvl==='mua'?C.rest:C.acc;c.lineWidth=1.6;c.stroke()}
      if(n.prob){c.beginPath();c.arc(x,y,r+3.2,0,6.2832);c.strokeStyle=C.out;c.lineWidth=2.2;c.stroke()}}
    else if(n.t==='grp'){c.fillStyle=C.s2;c.fill();c.strokeStyle=C.muted;c.lineWidth=1.4;c.stroke()}
    else{c.fillStyle=n.p.stocked?C.ok:C.muted;c.fill()}
    if(n.flag){c.beginPath();c.arc(x+r*0.9,y-r*0.9,3.6,0,6.2832);c.fillStyle=C.label;c.fill();c.strokeStyle=C.ink;c.lineWidth=1;c.stroke()}
    if(sel||hov){c.beginPath();c.arc(x,y,r+5.5,0,6.2832);c.strokeStyle=C.ink;c.lineWidth=sel?2:1;c.stroke()}
    if(n.t==='brand'&&v.k>0.3){c.fillStyle=C.surf;c.font='700 '+Math.round(Math.max(7,r*0.62))+'px '+col('--cond');c.textAlign='center';c.textBaseline='middle';c.fillText(n.code,x,y+0.5)}
    var show=n.t==='brand'||sel||hov||(near&&near[n.id]&&n.t!=='part')||(n.t==='sys'&&v.k>0.34)||(n.t==='plat'&&v.k>0.8)||(n.t==='grp'&&v.k>0.5)||(n.t==='part'&&v.k>1.3);
    if(show&&!(d&&!sel))labels.push([n,x,y,r,(sel?0:hov?1:n.t==='brand'?2:(near&&near[n.id])?3:n.t==='sys'?4:n.t==='grp'?5:n.t==='plat'?6:7)])});
  c.globalAlpha=1;c.textAlign='center';c.textBaseline='top';c.lineJoin='round';
  var placed=[],ff=col('--font');labels.sort(function(a,b){return a[4]-b[4]});
  labels.forEach(function(a){var n=a[0],fs=n.t==='brand'?13:n.t==='sys'?12:11;c.font=(n.t==='brand'?'700 ':n.t==='sys'?'600 ':'500 ')+fs+'px '+ff;
    var w=c.measureText(n.label).width,bx=a[1]-w/2-3,by=a[2]+a[3]+2,bw=w+6,bh=fs+5,i,q;
    if(a[4]>1)for(i=0;i<placed.length;i++){q=placed[i];if(bx<q[0]+q[2]&&bx+bw>q[0]&&by<q[1]+q[3]&&by+bh>q[1])return}
    placed.push([bx,by,bw,bh]);
    c.lineWidth=3.5;c.strokeStyle=C.surf;c.strokeText(n.label,a[1],by+1);c.fillStyle=n.t==='plat'||n.t==='part'||n.t==='grp'?C.muted:C.ink;c.fillText(n.label,a[1],by+1)})}
function mapLoop(){if(MAP_RAF)return;function step(){MAP_RAF=0;var G=MAPG;if(!G||!G.cv||!G.cv.isConnected)return;var on=mapTick();if(on)mapTick();mapDraw();if(on||G.drag)MAP_RAF=requestAnimationFrame(step)}MAP_RAF=requestAnimationFrame(step)}
function mapHit(mx,my){var G=MAPG,v=G.view,cv=G.cv,W=cv.clientWidth,H=cv.clientHeight,best=null,bd=1e9;
  G.nodes.forEach(function(n){var x=(n.x-v.x)*v.k+W/2,y=(n.y-v.y)*v.k+H/2,r=mapR(n)*Math.max(0.55,Math.min(1.5,Math.sqrt(v.k)))+7,d=Math.hypot(mx-x,my-y);if(d<r&&d<bd){bd=d;best=n}});return best}
function mapToggle(n){var u=mapUI();if(n.t==='plat'){u.open[n.key]=!u.open[n.key];if(!u.open[n.key])Object.keys(u.openG).forEach(function(g){if(g.indexOf('g:'+n.key+'|')===0)delete u.openG[g]})}
  else if(n.t==='grp'){u.openG[n.id]=!u.openG[n.id]}else return;
  if(u.sel&&!/^[bsp]:/.test(u.sel)&&n.t==='plat'&&!u.open[n.key])u.sel=n.id;
  mapBuild();MAPG.cv=document.getElementById('map-cv');mapPanel();mapLoop()}
function mapSelect(id){var u=mapUI();u.sel=id;u.panel=null;u.flagFor=null;mapPanel();mapDraw()}
function mapMount(){var cv=document.getElementById('map-cv');if(!cv)return;var u=mapUI();if(!MAPG)mapBuild();var G=MAPG;G.cv=cv;
  var ptr={},moved=0,down=null;
  function pos(e){var r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]}
  cv.addEventListener('pointerdown',function(e){cv.setPointerCapture(e.pointerId);var p=pos(e);ptr[e.pointerId]=p;moved=0;var n=Object.keys(ptr).length===1?mapHit(p[0],p[1]):null;down={node:n};if(n){MAPG.drag={node:n}}});
  cv.addEventListener('pointermove',function(e){var G=MAPG,p=pos(e),o=ptr[e.pointerId];
    if(!o){var h=mapHit(p[0],p[1]);if(h!==G.hover){G.hover=h;cv.style.cursor=h?'pointer':'grab';mapDraw()}return}
    var dx=p[0]-o[0],dy=p[1]-o[1],ids=Object.keys(ptr);moved+=Math.abs(dx)+Math.abs(dy);
    if(ids.length>=2){var q=ptr[ids[0]==e.pointerId?ids[1]:ids[0]],d0=Math.hypot(o[0]-q[0],o[1]-q[1]),d1=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d0>0)G.view.k=Math.max(0.1,Math.min(5,G.view.k*d1/d0));G.drag=null}
    else if(G.drag&&G.drag.node){if(moved>4){G.drag.node.x+=dx/G.view.k;G.drag.node.y+=dy/G.view.k;if(G.alpha<0.12)G.alpha=0.12;mapLoop()}}
    else{G.view.x-=dx/G.view.k;G.view.y-=dy/G.view.k}
    ptr[e.pointerId]=p;mapDraw()});
  function up(e){if(!ptr[e.pointerId])return;delete ptr[e.pointerId];var G=MAPG,n=down&&down.node;G.drag=null;
    if(e.type==='pointerup'&&moved<6){if(n){if(mapUI().sel===n.id&&(n.t==='plat'||n.t==='grp'))mapToggle(n);else mapSelect(n.id)}else if(mapUI().sel)mapSelect(null)}down=null}
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',function(e){e.preventDefault();var G=MAPG,v=G.view,p=pos(e),W=cv.clientWidth,H=cv.clientHeight,wx=(p[0]-W/2)/v.k+v.x,wy=(p[1]-H/2)/v.k+v.y;v.k=Math.max(0.1,Math.min(5,v.k*Math.exp(-e.deltaY*0.0014)));v.x=wx-(p[0]-W/2)/v.k;v.y=wy-(p[1]-H/2)/v.k;mapDraw()},{passive:false});
  cv.addEventListener('dblclick',function(e){var p=pos(e),n=mapHit(p[0],p[1]);if(n&&(n.t==='plat'||n.t==='grp')&&mapUI().sel!==n.id)mapToggle(n)});
  var q=document.getElementById('map-q');if(q)q.addEventListener('input',function(){mapUI().q=q.value;mapHits()});
  if(window.ResizeObserver){new ResizeObserver(function(){if(MAPG&&MAPG.cv===cv)mapDraw()}).observe(cv)}
  mapPanel();mapDraw();if(G.alpha>0)mapLoop();
  if(!MAP_AUDIT)setTimeout(function(){if(MAP_AUDIT)return;mapAuditRun();if(document.getElementById('map-cv')){mapBuild();MAPG.cv=document.getElementById('map-cv');mapBar();mapPanel();mapDraw()}},400)}
function mapBar(){var b=document.getElementById('map-prob');if(b)b.innerHTML=ico(UI_ICON.warn,16)+'Problems only <span class="badge">'+MAPG.probN+'</span>'}
function mapHits(){var box=document.getElementById('map-hits');if(!box)return;var q=mapUI().q.trim().toLowerCase(),h='';
  if(q.length>=2){var out=[];
    SYSTEMS.forEach(function(s){if(out.length<4&&(sysLabel(s).toLowerCase().indexOf(q)>=0||brandName(s.brand).toLowerCase().indexOf(q)>=0))out.push(['s:'+s.id,sysLabel(s),'System'])});
    var seen={};S.parts.some(function(p){if(String(p.pn||'').toLowerCase().indexOf(q)<0)return false;var k=p.pn+'|'+p.sys+'|'+p.plat;if(seen[k])return false;seen[k]=1;out.push(['x:'+p.id,p.pn+' '+partName(p),mapPlatName(p.sys,p.plat)]);return out.length>=10});
    h=out.length?out.map(function(o){return '<button data-act="map-go" data-v="'+esc(o[0])+'"><b>'+esc(o[1])+'</b><span>'+esc(o[2])+'</span></button>'}).join(''):'<div class="map-none">No match. Type a part number or a system name.</div>'}
  box.innerHTML=h;box.hidden=!h}
function mapGo(id){var u=mapUI(),G=MAPG;
  if(id.indexOf('x:')===0){var p=partById(id.slice(2));if(!p)return;var key=p.sys+'|'+p.plat;u.open[key]=true;u.openG['g:'+key+'|'+p.type]=true;u.pin=p.id;u.stock=false;mapBuild();G=MAPG;G.cv=document.getElementById('map-cv');for(var i=0;i<60;i++)mapTick()}
  var n=G.by[id];if(!n)return;u.sel=id;u.panel=null;u.q='';var q=document.getElementById('map-q');if(q)q.value='';mapHits();
  var near=mapNear(id),list=G.nodes.filter(function(x){return near[x.id]});if(n.t==='part')G.links.forEach(function(l){if(l.kind==='h'&&near[l.a.id]&&l.a.t==='grp'&&l.b.t==='part')list.push(l.b)});mapFitView(list.length>1?list:[n]);mapPanel();mapDraw();mapLoop()}
function mapRef(o){MAPG.refs.push(o);return MAPG.refs.length-1}
function mapFlagBtn(kind,ref,label){return '<button class="link" data-act="map-flag" data-v="'+mapRef({kind:kind,ref:kind+':'+ref,label:label})+'">'+ico(UI_ICON.flag,14)+'This is wrong</button>'}
function mapFlagList(ref){var fl=mapFlags().filter(function(f){return f.ref===ref});return fl.map(function(f){return '<div class="map-flagged">'+ico(UI_ICON.flag,14)+'<span><b>Flagged by '+esc(f.by||'someone')+', '+esc(f.d)+'.</b> '+esc(f.note)+'</span></div>'}).join('')}
function mapLinkRow(l,me){var o=l.a===me?l.b:l.a,nm=mapPlatName(o.sys,o.pl),h='<li class="'+(l.warn?'warn':'')+'"><button class="link" data-act="map-go" data-v="'+esc(o.id)+'">'+esc(nm)+'</button>';
  if(l.kind==='mua')h+=' <span class="muted">'+(l.a===me?'Multi-unit path to this top':'Multi-unit path from this implant')+', '+l.n+' abutment'+(l.n>1?'s':'')+'.</span>';
  else{h+=' <span class="muted">'+(l.fam?'Shares the 4.8 mm multi-unit top. The '+l.n+' DESS parts for that top fit here.':(l.borrow?'Borrowed fit. ':'')+l.n+' shared part'+(l.n>1?'s':'')+(l.pns.length?': '+esc(l.pns.slice(0,4).join(', '))+(l.n>4?', and more':''):'')+'.')+'</span>';
    if(l.warn)h+='<div class="map-why">'+ico(UI_ICON.warn,14)+esc(l.why.join(' '))+' Check the maker source.</div>';
    h+=mapFlagList(l.ref)+'<div>'+mapFlagBtn('link',l.ref.slice(5),'Link: '+mapPlatName(l.a.sys,l.a.pl)+' and '+mapPlatName(l.b.sys,l.b.pl))+'</div>'}
  return h+'</li>'}
function mapPanelHTML(){var u=mapUI(),G=MAPG,n=u.sel&&G.by[u.sel],h='';G.refs=[];
  if(u.flagFor){var f=u.flagFor;return '<h2>Flag for review</h2><p class="small"><b>'+esc(f.label)+'</b></p><p class="small muted">Say what is wrong and how you know. The flag goes on the review list. It does not change the catalog.</p><textarea id="map-note" rows="4" placeholder="Example: DESS lists this screw for the 4.1 platform only."></textarea><div class="map-btns"><button class="btn sm" data-act="map-flag-save">Save flag</button><button class="btn sm ghost" data-act="map-flag-cancel">Cancel</button></div>'}
  if(u.panel==='flags'){var all=(S.flags||[]).slice().reverse(),open=all.filter(function(x){return x.status!=='fixed'});h='<h2>Review list</h2>';
    if(!all.length)return h+'<p class="small muted">No flags yet. Click a dot, then choose “This is wrong” to add one.</p>';
    h+='<p class="small muted">'+open.length+' open. A flag stays here until an admin marks it fixed.</p><div class="map-btns"><button class="btn sm ghost" data-act="map-copy">'+ico(UI_ICON.copy,16)+'Copy the open flags</button></div>';
    if(u.copy)h+='<textarea id="map-copytxt" rows="6" readonly>'+esc(u.copy)+'</textarea>';
    h+='<ul class="map-list">'+all.map(function(x){return '<li class="'+(x.status==='fixed'?'done':'')+'"><b>'+esc(x.label)+'</b><div class="small">'+esc(x.note)+'</div><div class="small muted">'+esc(x.by||'')+', '+esc(x.d)+(x.status==='fixed'?'. Fixed.':'')+'</div>'+(ADMIN&&x.status!=='fixed'?'<div><button class="link" data-act="map-flag-done" data-v="'+esc(x.id)+'">Mark fixed</button></div>':'')+'</li>'}).join('')+'</ul>';return h}
  if(!n){h='<h2>How to read the map</h2><ul class="map-key"><li><i class="k-brand"></i>Maker</li><li><i class="k-sys"></i>Implant-level system</li><li><i class="k-mua"></i>Multi-unit system</li><li><i class="k-plat"></i>Platform. A bigger dot has more parts.</li><li><i class="k-prob"></i>Platform with a gap to check</li><li><i class="k-l1"></i>Belongs to</li><li><i class="k-l2"></i>Multi-unit path: implant to the top it gives</li><li><i class="k-l3"></i>Two platforms list the same part</li><li><i class="k-l4"></i>Shared-part link to check</li></ul>';
    h+='<p class="small muted">Click a dot to see its links. Click a platform a second time to open its parts. Drag a dot to move it. Scroll or pinch to zoom.</p>';
    var pr=G.nodes.filter(function(x){return x.prob}),wl=G.links.filter(function(l){return l.warn});
    h+='<h3>To check ('+(pr.length+wl.length)+')</h3>'+(MAP_AUDIT?'':'<p class="small muted">Running the stack and finder checks…</p>')+'<ul class="map-list">'+pr.map(function(x){return '<li><button class="link" data-act="map-go" data-v="'+esc(x.id)+'">'+esc(mapPlatName(x.sys,x.pl))+'</button> <span class="muted">'+esc(mapProbText(x))+'</span></li>'}).join('')+wl.map(function(l){return '<li class="warn"><button class="link" data-act="map-go" data-v="'+esc(l.a.id)+'">'+esc(mapPlatName(l.a.sys,l.a.pl))+'</button> and '+esc(mapPlatName(l.b.sys,l.b.pl))+' <span class="muted">'+esc(l.why[0])+'</span></li>'}).join('')+'</ul>';return h}
  if(n.t==='brand'){h='<span class="eyebrow">Maker</span><h2>'+esc(brandById(n.id.slice(2)).name)+'</h2><ul class="map-list">'+SYSTEMS.filter(function(s){return 'b:'+s.brand===n.id}).map(function(s){return '<li><button class="link" data-act="map-go" data-v="s:'+s.id+'">'+esc(s.name)+'</button> <span class="muted">'+(s.level==='mua'?'Multi-unit':'Implant level')+', '+s.plats.length+' platform'+(s.plats.length>1?'s':'')+'</span></li>'}).join('')+'</ul>';return h}
  if(n.t==='sys'){var sy=sysById(n.sys);h='<span class="eyebrow">'+(sy.level==='mua'?'Multi-unit system':'Implant-level system')+'</span><h2>'+esc(sysLabel(sy))+'</h2>'+(sy.note?'<p class="small">'+esc(sy.note)+'</p>':'')+(sy.usesNote?'<div class="note low small">'+esc(sy.usesNote)+'</div>':'');
    h+='<h3>Platforms</h3><ul class="map-list">'+sy.plats.map(function(pl){var P=G.by['p:'+sy.id+'|'+pl];return '<li><button class="link" data-act="map-go" data-v="'+esc(P.id)+'">'+esc(pl)+'</button> <span class="muted">'+P.total+' parts'+(P.prob?'. '+esc(mapProbText(P)):'')+'</span></li>'}).join('')+'</ul>';return h}
  if(n.t==='plat'){var all=partsFor(n.sys,n.pl),ty={};all.forEach(function(p){ty[p.type]=(ty[p.type]||0)+1});
    h='<span class="eyebrow">Platform</span><h2>'+esc(mapPlatName(n.sys,n.pl))+'</h2><p class="small muted">'+all.length+' parts, '+all.filter(function(p){return p.stocked}).length+' in the drawers.</p>';
    if(n.prob)h+='<div class="note out small">'+ico(UI_ICON.warn,16)+' '+esc(mapProbText(n))+'</div>';
    if(n.gaps.length)h+='<details class="small"><summary>'+n.gaps.length+' check result'+(n.gaps.length>1?'s':'')+'</summary><ul>'+n.gaps.slice(0,12).map(function(g){return '<li>'+esc(g)+'</li>'}).join('')+'</ul></details>';
    h+=mapFlagList('plat:'+n.key);
    h+='<div class="map-btns"><button class="btn sm" data-act="map-open" data-v="'+esc(n.id)+'">'+(u.open[n.key]?'Close its parts':'Open its parts on the map')+'</button></div>';
    h+='<div class="map-types">'+TYPE_ORDER.filter(function(t){return ty[t]}).map(function(t){return '<button class="mchip" data-act="map-grp" data-v="'+esc('g:'+n.key+'|'+t)+'">'+esc(TYPE_LABEL[t])+' <b>'+ty[t]+'</b></button>'}).join('')+'</div>';
    var ls=G.links.filter(function(l){return l.kind!=='h'&&(l.a===n||l.b===n)});ls.sort(function(a,b){return (b.warn?1:0)-(a.warn?1:0)||(a.kind==='mua'?0:1)-(b.kind==='mua'?0:1)||b.n-a.n});
    if(ls.length)h+='<h3>Links to other platforms ('+ls.length+')</h3><ul class="map-list">'+ls.map(function(l){return mapLinkRow(l,n)}).join('')+'</ul>';
    h+='<div>'+mapFlagBtn('plat',n.key,'Platform: '+mapPlatName(n.sys,n.pl))+'</div>';return h}
  if(n.t==='grp'){var P2=G.by['p:'+n.key];h='<span class="eyebrow">'+esc(mapPlatName(P2.sys,P2.pl))+'</span><h2>'+esc(TYPE_LABEL[n.type])+' ('+n.parts.length+')</h2><div class="map-btns"><button class="btn sm" data-act="map-open" data-v="'+esc(n.id)+'">'+(u.openG[n.id]?'Close these parts':'Open these parts on the map')+'</button></div>'+(n.more>0?'<p class="small muted">The map shows the first '+MAP_CAP+'. The list below has all of them.</p>':'');
    h+='<ul class="map-list parts">'+n.parts.map(function(p){return '<li><button class="link" data-act="open" data-v="'+esc(p.id)+'">'+esc(p.pn||'no number')+'</button> <span>'+esc(vName(p))+'</span> <span class="muted">'+esc(brandName(p.maker))+(p.stocked?', '+esc(p.bin||'in stock'):'')+'</span></li>'}).join('')+'</ul>';return h}
  var p=n.p;h='<span class="eyebrow">'+esc(brandName(p.maker))+'</span><h2>'+esc(p.pn||'')+'</h2><p>'+esc(partName(p))+'</p><p class="small muted">'+esc(ctx(p))+'</p>'+(p.stocked?'<p class="small">In the drawers'+(p.bin?': '+esc(p.bin):'')+'.</p>':'<p class="small muted">Not stocked.</p>');
  var fits=p.fits&&p.fits.length?p.fits:[[p.sys,p.plat]];if(fits.length>1)h+='<h3>Fits '+fits.length+' platforms</h3><ul class="map-list">'+fits.map(function(f){return '<li><button class="link" data-act="map-go" data-v="'+esc('p:'+f[0]+'|'+f[1])+'">'+esc(mapPlatName(f[0],f[1]))+'</button></li>'}).join('')+'</ul>';
  h+=mapFlagList('part:'+mapPartKey(p))+'<div class="map-btns"><button class="btn sm" data-act="open" data-v="'+esc(p.id)+'">Open the part card</button></div><div>'+mapFlagBtn('part',mapPartKey(p),'Part: '+(p.pn||'')+' '+partName(p)+' ('+mapPlatName(p.sys,p.plat)+')')+'</div>';return h}
function mapProbText(n){var a=[];if(!n.total)return 'No parts are listed for this platform.';if(n.miss.length)a.push('No '+n.miss.join(', no ')+' is listed.');if(n.noTop)a.push(n.noTop+' multi-unit abutment'+(n.noTop>1?'s have':' has')+' no top system in the catalog.');if(n.gaps.length)a.push(n.gaps.length+' gap'+(n.gaps.length>1?'s':'')+' from the stack and finder checks.');return a.join(' ')}
function mapPanel(){var el=document.getElementById('map-panel');if(el){el.innerHTML=mapPanelHTML();el.scrollTop=0}var fb=document.getElementById('map-flags');if(fb)fb.innerHTML=ico(UI_ICON.flag,16)+'Review list <span class="badge">'+mapFlags().length+'</span>'}
function viewMap(){var u=mapUI();if(!MAPG)mapBuild();
  var h='<header class="vh"><h1>Map</h1><p class="lede">How the makers, systems, platforms and parts connect. Use it to learn what fits with what, and to catch links that look wrong.</p></header>';
  h+='<div class="map-bar"><div class="map-search"><input id="map-q" type="search" placeholder="Find a part number or a system" value="'+esc(u.q)+'" autocomplete="off" aria-label="Find on the map"><div id="map-hits" class="map-hits" hidden></div></div>';
  h+='<button class="mchip" id="map-prob" data-act="map-prob" aria-pressed="'+!!u.prob+'">'+ico(UI_ICON.warn,16)+'Problems only <span class="badge">'+MAPG.probN+'</span></button>';
  h+='<button class="mchip" data-act="map-stock" aria-pressed="'+!!u.stock+'">'+ico(TAB_ICON.stock,16)+'In stock only</button>';
  h+='<button class="mchip" data-act="map-fit">'+ico(UI_ICON.fit,16)+'Show all</button>';
  h+='<button class="mchip" id="map-flags" data-act="map-flags">'+ico(UI_ICON.flag,16)+'Review list <span class="badge">'+mapFlags().length+'</span></button></div>';
  h+='<div class="map-wrap"><div class="map-stage"><canvas id="map-cv" aria-label="Map of makers, systems, platforms and parts"></canvas></div><aside id="map-panel" class="map-panel" aria-live="polite"></aside></div>';
  return h}
var MAP_ACT={
  'map-go':function(v){mapGo(v)},
  'map-open':function(v){var n=MAPG.by[v];if(n)mapToggle(n)},
  'map-grp':function(v){var u=mapUI(),key=v.slice(2,v.lastIndexOf('|'));u.open[key]=true;mapBuild();MAPG.cv=document.getElementById('map-cv');for(var i=0;i<40;i++)mapTick();u.sel=v;mapPanel();mapDraw();mapLoop()},
  'map-prob':function(v,el){var u=mapUI();u.prob=!u.prob;u.sel=null;el.setAttribute('aria-pressed',u.prob);mapPanel();mapDraw()},
  'map-stock':function(v,el){var u=mapUI();u.stock=!u.stock;el.setAttribute('aria-pressed',u.stock);mapBuild();MAPG.cv=document.getElementById('map-cv');if(u.sel&&!MAPG.by[u.sel])u.sel=null;mapPanel();mapDraw();mapLoop()},
  'map-fit':function(){mapUI().sel=null;mapFitView();mapPanel();mapDraw()},
  'map-flags':function(){var u=mapUI();u.panel=u.panel==='flags'?null:'flags';u.sel=null;u.flagFor=null;u.copy=null;mapPanel();mapDraw()},
  'map-flag':function(v){var u=mapUI();u.flagFor=MAPG.refs[+v];mapPanel();var t=document.getElementById('map-note');if(t)t.focus()},
  'map-flag-cancel':function(){mapUI().flagFor=null;mapPanel()},
  'map-flag-save':function(){var u=mapUI(),t=document.getElementById('map-note'),note=t?t.value.trim():'';if(!note){toast('Type what is wrong first.');if(t)t.focus();return}
    S.flags=S.flags||[];S.flags.push({id:nextId('fl'),d:mapToday(),by:byWho(),kind:u.flagFor.kind,ref:u.flagFor.ref,label:u.flagFor.label,note:note,status:'open'});u.flagFor=null;save();toast('Flag saved to the review list.');
    mapBuild();MAPG.cv=document.getElementById('map-cv');mapPanel();mapDraw()},
  'map-flag-done':function(v){(S.flags||[]).forEach(function(f){if(String(f.id)===String(v)){f.status='fixed';f.fixedBy=byWho();f.fixedD=mapToday()}});save();mapBuild();MAPG.cv=document.getElementById('map-cv');mapPanel();mapDraw()},
  'map-copy':function(){var u=mapUI(),txt=mapFlags().map(function(f,i){return (i+1)+'. '+f.label+'\n   '+f.note+'\n   ('+(f.by||'')+', '+f.d+', ref '+f.ref+')'}).join('\n')||'No open flags.';u.copy=txt;mapPanel();
    var done=function(){toast('Copied. Paste the list to Claude.')},sel=function(){var t=document.getElementById('map-copytxt');if(t){t.focus();t.select()}toast('Select the text and copy it.')};
    try{navigator.clipboard.writeText(txt).then(done,sel)}catch(e){sel()}}
};
/* MAP-END */
