
/* ---- Live mode (Nov 10 2026). When the page comes from the Renew lab server, lab data is shared:
   stock, pulls, returns, swaps, requests and orders are saved on the server and every device sees them.
   Opened anywhere else (the public demo link, a saved file) the app stays in demo mode with sample data.
   How it works: after every change the app compares its data with the last synced copy and sends only the
   differences. Stock counts travel as "+2 / -2" so two people pulling at once both count. Changes wait in a
   queue on this device until the server confirms them. ---- */
var LIVE={on:false,ready:false,token:null,name:'',admin:false,sid:'',q:[],base:null,seq:0,busy:false,down:false,dev:null,n:0,pending:false,refused:0,k2p:{},id2k:{},seedPhoto:{}};
var LIVE_REF={pulls:['p'],returns:['p'],retired:['p'],changes:['from','to'],requests:['partId'],lines:['partId']};
var LIVE_COLLS=['pulls','returns','retired','changes','requests','lines','tests'];
var LIVE_KV=['pairings','suppliers','draftQty','draftRemoved'];
function byWho(){return LIVE.on&&LIVE.name?LIVE.name:ROLE_NAME[UI.role]}
function liveKey(p){return p.oem?p.id:'k:'+[p.maker,p.pn||'',p.sys,p.plat,p.k].join('|')}
function liveCanon(o){if(o===null||typeof o!=='object')return JSON.stringify(o===undefined?null:o);if(Array.isArray(o))return '['+o.map(liveCanon).join(',')+']';
  return '{'+Object.keys(o).sort().filter(function(k){return o[k]!==undefined}).map(function(k){return JSON.stringify(k)+':'+liveCanon(o[k])}).join(',')+'}'}
function liveNewId(prefix){return prefix+LIVE.dev+'-'+Date.now().toString(36)+'-'+(LIVE.n++)}
function liveIndex(){LIVE.k2p={};LIVE.id2k={};S.parts.forEach(function(p){var k=liveKey(p);LIVE.k2p[k]=p;LIVE.id2k[p.id]=k})}
function liveOut(c,rec){var o={},x;for(x in rec)o[x]=rec[x];(LIVE_REF[c]||[]).forEach(function(f){if(o[f]!=null&&LIVE.id2k[o[f]])o[f]=LIVE.id2k[o[f]]});return o}
function liveIn(c,rec){var o={},x;for(x in rec)o[x]=rec[x];(LIVE_REF[c]||[]).forEach(function(f){if(o[f]!=null&&LIVE.k2p[o[f]])o[f]=LIVE.k2p[o[f]].id});return o}
function liveKvOut(k){var m=/^low-(.+)$/.exec(k);return m&&LIVE.id2k[m[1]]?'low-'+LIVE.id2k[m[1]]:k}
function liveKvIn(k){var m=/^low-(.+)$/.exec(k);return m&&LIVE.k2p[m[1]]?'low-'+LIVE.k2p[m[1]].id:k}
function liveRecId(c,r){return c==='pulls'?r.i:r.id}
function livePartBlank(){return {stocked:false,loc:null,bin:null,onHand:0,min:0,photoOk:false,photoOff:false}}
function livePartSnap(p,k){return {stocked:!!p.stocked,loc:p.loc||null,bin:p.bin||null,onHand:+p.onHand||0,min:+p.min||0,photoOk:!!p.photoOk,photoOff:!!(LIVE.seedPhoto[k]&&!p.photo)}}
function liveEmptySnap(){var s={parts:{},colls:{},kv:{}};LIVE_COLLS.forEach(function(c){s.colls[c]={}});LIVE_KV.forEach(function(c){s.kv[c]={}});return s}
function liveSnap(){var s=liveEmptySnap();
  S.parts.forEach(function(p){var k=LIVE.id2k[p.id];if(k)s.parts[k]=livePartSnap(p,k)});
  LIVE_COLLS.forEach(function(c){(S[c]||[]).forEach(function(r){var id=liveRecId(c,r);if(id!=null)s.colls[c][id]=liveCanon(liveOut(c,r))})});
  LIVE_KV.forEach(function(c){var m=S[c]||{},k;for(k in m)if(m[k]!==undefined&&m[k]!==null)s.kv[c][c.indexOf('draft')===0?liveKvOut(k):k]=liveCanon(m[k])});
  return s}
function liveDiff(a,b){var ops=[],k,c;function op(o){o.o=liveNewId('o');ops.push(o)}
  for(k in b.parts){var x=a.parts[k]||livePartBlank(),y=b.parts[k],f={},any=false,fl;
    for(fl in y){if(fl==='onHand')continue;if(x[fl]!==y[fl]){f[fl]=y[fl];any=true}}
    if(any)op({t:'set',c:'parts',id:k,f:f});
    if(x.onHand!==y.onHand)op({t:'inc',c:'parts',id:k,k:'onHand',n:y.onHand-x.onHand})}
  LIVE_COLLS.forEach(function(c){var A=a.colls[c]||{},B=b.colls[c],id;
    for(id in B)if(A[id]!==B[id])op({t:'put',c:c,id:id,d:JSON.parse(B[id])});
    for(id in A)if(!(id in B))op({t:'del',c:c,id:id})});
  LIVE_KV.forEach(function(c){var A=a.kv[c]||{},B=b.kv[c],id;
    for(id in B)if(A[id]!==B[id])op({t:'put',c:c,id:id,d:{v:JSON.parse(B[id])}});
    for(id in A)if(!(id in B))op({t:'del',c:c,id:id})});
  return ops}
function liveQSave(){lsSet('renew-live-q',LIVE.q.length?JSON.stringify(LIVE.q):null)}
function liveSync(){if(!LIVE.ready)return;
  (S.pulls||[]).forEach(function(pl){if(!pl.i)pl.i=liveNewId('u')});
  var cur=liveSnap(),ops=liveDiff(LIVE.base,cur);LIVE.base=cur;
  if(ops.length){LIVE.q=LIVE.q.concat(ops);liveQSave();liveFlush()}
  liveBadge()}
function liveApi(path,body,method){var h={'Content-Type':'application/json'};if(LIVE.token)h.Authorization='Bearer '+LIVE.token;
  return fetch(path,{method:method||(body?'POST':'GET'),headers:h,body:body?JSON.stringify(body):undefined,cache:'no-store'}).then(function(r){
    return r.json().catch(function(){return {}}).then(function(d){if(r.ok)return d;var e=new Error(d.error||('Server answered '+r.status));e.status=r.status;throw e})})}
function liveFlush(){if(LIVE.busy||!LIVE.q.length||!LIVE.token)return Promise.resolve();
  LIVE.busy=true;var batch=LIVE.q.slice(0,300);
  return liveApi('api/ops',{ops:batch}).then(function(d){var done={};(d.applied||[]).forEach(function(o){done[o]=1});
      LIVE.q=LIVE.q.filter(function(o){return !done[o.o]});liveQSave();LIVE.seq=Math.max(LIVE.seq,d.seq||0);LIVE.busy=false;LIVE.down=false;liveBadge();if(LIVE.q.length)return liveFlush()},
    function(e){LIVE.busy=false;
      if(e.status===401){liveSignedOut();return}
      if(e.status===400){/* the server refused this batch: set it aside so the queue is not stuck, then reload the truth */
        var ids={};batch.forEach(function(o){ids[o.o]=1});LIVE.q=LIVE.q.filter(function(o){return !ids[o.o]});liveQSave();LIVE.refused+=batch.length;
        try{localStorage.setItem('renew-live-refused',JSON.stringify({at:new Date().toISOString(),why:e.message,ops:batch}))}catch(x){}
        liveBadge();liveResync();return}
      LIVE.down=true;liveBadge();setTimeout(liveFlush,4000)})}
function liveSetPart(p,k,f,v){if(f==='photoOff'){if(v)delete p.photo;else if(LIVE.seedPhoto[k])p.photo=LIVE.seedPhoto[k]}else p[f]=v}
function liveApply(ev){if(!ev||!ev.op)return;if(ev.seq)LIVE.seq=Math.max(LIVE.seq,ev.seq);if(ev.sid===LIVE.sid||!LIVE.ready)return;
  var op=ev.op,c=op.c,B=LIVE.base;
  if(c==='parts'){var p=LIVE.k2p[op.id],b=B.parts[op.id]||(B.parts[op.id]=livePartBlank()),f;
    if(op.t==='set'){for(f in op.f){b[f]=op.f[f];if(p)liveSetPart(p,op.id,f,op.f[f])}}
    else if(op.t==='inc'){b[op.k]=(+b[op.k]||0)+op.n;if(p)p[op.k]=(+p[op.k]||0)+op.n}}
  else if(LIVE_COLLS.indexOf(c)>=0){var arr=S[c]||(S[c]=[]),ix=-1,i;for(i=0;i<arr.length;i++)if(String(liveRecId(c,arr[i]))===op.id){ix=i;break}
    if(op.t==='put'){var rec=liveIn(c,op.d);if(c==='pulls')rec.i=op.id;if(ix>=0)arr[ix]=rec;else arr.push(rec);B.colls[c][op.id]=liveCanon(liveOut(c,rec))}
    else if(op.t==='del'){if(ix>=0)arr.splice(ix,1);delete B.colls[c][op.id]}}
  else if(LIVE_KV.indexOf(c)>=0){var m=S[c]||(S[c]={}),lk=c.indexOf('draft')===0?liveKvIn(op.id):op.id;
    if(op.t==='put'){m[lk]=op.d.v;B.kv[c][op.id]=liveCanon(op.d.v)}else if(op.t==='del'){delete m[lk];delete B.kv[c][op.id]}}
  liveRerender()}
function liveTyping(){var a=document.activeElement;return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&!a.closest('#live-ov'))}
function liveRerender(){if(liveTyping()){LIVE.pending=true;return}LIVE.pending=false;try{render()}catch(e){}liveBadge()}
document.addEventListener('focusout',function(){if(LIVE.pending)setTimeout(function(){if(LIVE.pending&&!liveTyping())liveRerender()},80)});
/* put the server's records into S. Runs inside load() once the catalog is built, and again on every resync */
function liveBlank(st){st.pulls=[];st.returns=[];st.retired=[];st.changes=[];st.requests=[];st.lines=[];st.tests=[];st.draftQty={};st.draftRemoved={};st.parts.forEach(function(p){p.onHand=0})}
function liveOverlay(){var st=LIVE.state;liveIndex();
  if(!LIVE.photosKept){S.parts.forEach(function(p){if(p.photo)LIVE.seedPhoto[LIVE.id2k[p.id]]=p.photo});LIVE.photosKept=true}
  if(!st.seeded){LIVE.base=liveEmptySnap();return} /* first device on a new server: the app's bin setup becomes the starting data */
  var docs=st.docs||{},byK={};(docs.parts||[]).forEach(function(r){byK[r.id]=r.d});
  S.parts.forEach(function(p){var k=LIVE.id2k[p.id],d=byK[k]||{},b=livePartBlank(),f;for(f in b)liveSetPart(p,k,f,d[f]!==undefined?d[f]:b[f])});
  LIVE_COLLS.forEach(function(c){S[c]=(docs[c]||[]).map(function(r){var rec=liveIn(c,r.d);if(c==='pulls')rec.i=r.id;return rec})});
  LIVE_KV.forEach(function(c){var m={};(docs[c]||[]).forEach(function(r){m[c.indexOf('draft')===0?liveKvIn(r.id):r.id]=r.d.v});S[c]=m});
  LIVE.base=liveSnap();
  /* keep server-only part records (a part the catalog no longer lists) in the synced copy, so they are never deleted or re-sent */
  var k;for(k in byK)if(!LIVE.base.parts[k]){var o=livePartBlank(),f2;for(f2 in o)if(byK[k][f2]!==undefined)o[f2]=byK[k][f2];LIVE.base.parts[k]=o}}
function liveResync(){if(!LIVE.ready)return;if(LIVE.q.length){liveFlush();return}
  liveApi('api/state').then(function(d){if(LIVE.q.length)return;LIVE.state=d;LIVE.seq=d.seq;LIVE.down=false;liveOverlay();liveRerender()},function(e){if(e.status===401)liveSignedOut();else{LIVE.down=true;liveBadge()}})}
function liveEvents(){if(LIVE.es)try{LIVE.es.close()}catch(e){}
  var es=LIVE.es=new EventSource('api/events?token='+encodeURIComponent(LIVE.token));
  es.onmessage=function(e){try{liveApply(JSON.parse(e.data))}catch(x){}};
  es.addEventListener('hello',function(e){LIVE.down=false;try{var s=JSON.parse(e.data).seq;if(s!==LIVE.seq)liveResync()}catch(x){}liveBadge();liveFlush()});
  es.onerror=function(){LIVE.down=true;liveBadge()}}
document.addEventListener('visibilitychange',function(){if(LIVE.ready&&!document.hidden){liveFlush();liveResync()}});
window.addEventListener('online',function(){if(LIVE.ready)liveFlush()});
window.addEventListener('beforeunload',function(e){if(LIVE.on&&LIVE.q.length){e.preventDefault();e.returnValue=''}});
/* ---- screens: connecting, first-time setup, sign in ---- */
function liveOv(html){var o=document.getElementById('live-ov');if(!html){if(o)o.remove();return null}
  if(!o){o=document.createElement('div');o.id='live-ov';o.style.cssText='position:fixed;inset:0;z-index:9000;background:var(--bg,#E7EBEE);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 16px';document.body.appendChild(o)}
  o.innerHTML='<div style="background:var(--surface,#fff);border-radius:14px;padding:22px;max-width:420px;width:100%;margin-top:6vh;box-shadow:0 6px 24px rgba(0,0,0,.12);font:16px/1.45 Barlow,system-ui,sans-serif;color:var(--ink,#16212B)">'+html+'</div>';return o}
var LIVE_IN='style="display:block;width:100%;box-sizing:border-box;font:inherit;padding:11px 12px;margin:6px 0 14px;border:1px solid #9aa6b1;border-radius:9px;background:#fff;color:#16212B"';
var LIVE_BTN='style="font:inherit;font-weight:600;padding:12px 18px;border:0;border-radius:9px;background:var(--ink,#16212B);color:#fff;cursor:pointer;width:100%"';
function liveErr(m){var e=document.getElementById('live-err');if(e)e.textContent=m||''}
function liveSetupForm(){liveOv('<h2 style="margin:0 0 6px">Set up Renew Parts</h2><p style="margin:0 0 16px;color:#56636F">This is done once, by a lead. It can be changed later.</p>'
  +'<label>Lab passcode<br><span style="font-size:13px;color:#56636F">Everyone types this once on each device. 4 characters or more.</span><input id="ls-pass" type="text" autocomplete="off" '+LIVE_IN+'></label>'
  +'<label>Office PIN<br><span style="font-size:13px;color:#56636F">4 digits. Opens Stock, Reports and Drawer layout. For Maya’s team and leads.</span><input id="ls-pin" type="text" inputmode="numeric" maxlength="4" autocomplete="off" '+LIVE_IN+'></label>'
  +'<label>Names<br><span style="font-size:13px;color:#56636F">One name on each line. People pick their name when they sign in.</span><textarea id="ls-people" rows="7" '+LIVE_IN+'></textarea></label>'
  +'<p id="live-err" style="color:#B3261E;margin:0 0 10px;min-height:1em"></p><button id="ls-go" '+LIVE_BTN+'>Save setup</button>');
  document.getElementById('ls-go').onclick=function(){var pass=document.getElementById('ls-pass').value.trim(),pin=document.getElementById('ls-pin').value.trim(),ppl=document.getElementById('ls-people').value.split('\n').map(function(x){return x.trim()}).filter(Boolean);
    if(pass.length<4){liveErr('The passcode needs 4 characters or more.');return}if(!/^\d{4}$/.test(pin)){liveErr('The office PIN is 4 digits.');return}if(!ppl.length){liveErr('Add at least one name.');return}
    liveApi('api/setup',{passcode:pass,pin:pin,people:ppl}).then(function(){return liveApi('api/hello')}).then(function(h){LIVE.hello=h;liveLoginForm()},function(e){liveErr(e.message)})}}
function liveLoginForm(msg){var ppl=(LIVE.hello&&LIVE.hello.people)||[],last=lsGet('renew-live-name')||'';
  liveOv('<h2 style="margin:0 0 6px">Renew Parts</h2><p style="margin:0 0 16px;color:#56636F">Sign in on this device. You stay signed in.</p>'
  +'<label>Your name<select id="ll-name" '+LIVE_IN+'><option value="">Pick your name</option>'+ppl.map(function(n){return '<option'+(n===last?' selected':'')+'>'+esc(n)+'</option>'}).join('')+'</select></label>'
  +'<label>Lab passcode<input id="ll-pass" type="password" autocomplete="off" '+LIVE_IN+'></label>'
  +'<p id="live-err" style="color:#B3261E;margin:0 0 10px;min-height:1em">'+esc(msg||'')+'</p><button id="ll-go" '+LIVE_BTN+'>Sign in</button>');
  function go(){var name=document.getElementById('ll-name').value,pass=document.getElementById('ll-pass').value;if(!name){liveErr('Pick your name.');return}
    liveApi('api/login',{passcode:pass,name:name}).then(function(d){LIVE.token=d.token;lsSet('renew-live-token',d.token);lsSet('renew-live-name',name);liveLoadState()},function(e){liveErr(e.status===403?'That passcode is not right.':e.message)})}
  document.getElementById('ll-go').onclick=go;document.getElementById('ll-pass').onkeydown=function(e){if(e.key==='Enter')go()}}
function liveSignedOut(){LIVE.token=null;lsSet('renew-live-token',null);if(LIVE.es)try{LIVE.es.close()}catch(e){}
  liveApi('api/hello').then(function(h){LIVE.hello=h;liveLoginForm(LIVE.ready?'Please sign in again.':'')},function(){liveLoginForm('Please sign in again.')})}
function liveDownScreen(){liveOv('<h2 style="margin:0 0 6px">Can’t reach the lab server</h2><p style="color:#56636F">Check that this device is on the lab Wi-Fi and that the server computer is on.'+(LIVE.q.length?' '+LIVE.q.length+' change'+(LIVE.q.length>1?'s are':' is')+' saved on this device and will be sent when the server answers.':'')+'</p><button id="ld-go" '+LIVE_BTN+'>Try again</button>');
  document.getElementById('ld-go').onclick=function(){liveOv('<p style="margin:0">Connecting to the lab server…</p>');liveLoadState()}}
function liveLoadState(){
  var first=!LIVE.ready;
  (LIVE.q.length?liveApi('api/ops',{ops:LIVE.q}).then(function(d){LIVE.q=[];liveQSave()},function(e){if(e.status===400){try{localStorage.setItem('renew-live-refused',JSON.stringify({at:new Date().toISOString(),why:e.message,ops:LIVE.q}))}catch(x){}LIVE.refused+=LIVE.q.length;LIVE.q=[];liveQSave()}else throw e}):Promise.resolve())
  .then(function(){return liveApi('api/state')}).then(function(d){
    LIVE.state=d;LIVE.name=d.name;LIVE.admin=!!d.admin;LIVE.sid=d.sid;LIVE.seq=d.seq;LIVE.down=false;
    ADMIN=!!d.admin;lsSet('renew-parts-admin',d.admin?'1':null);lsSet('renew-parts-pin','live');
    if(first){LIVE.cb();LIVE.ready=true;
      if(!d.seeded){liveSync();liveFlush().then(function(){return liveApi('api/seeded',{})}).then(function(){LIVE.state.seeded=true},function(){})}}
    else{LIVE.ready=true;liveOverlay();try{render()}catch(e){}}
    liveOv(null);liveEvents();liveBadge()},
  function(e){if(e.status===401||e.status===403){liveSignedOut()}else liveDownScreen()})}
function liveBoot(cb){
  if(location.protocol==='file:'||/github\.io$/.test(location.hostname)){cb();return}
  var done=false,t=setTimeout(function(){if(!done){done=true;cb()}},3000);
  fetch('api/hello',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(h){if(done)return;done=true;clearTimeout(t);
    if(!h||!h.renewParts){cb();return}
    LIVE.on=true;LIVE.cb=cb;LIVE.hello=h;LIVE.dev=lsGet('renew-live-dev');if(!LIVE.dev){LIVE.dev=Math.random().toString(36).slice(2,6);lsSet('renew-live-dev',LIVE.dev)}
    try{LIVE.q=JSON.parse(lsGet('renew-live-q')||'[]')}catch(e){LIVE.q=[]}
    LIVE.token=lsGet('renew-live-token');document.title='Renew Parts';
    if(!h.setup)liveSetupForm();else if(!LIVE.token)liveLoginForm();else{liveOv('<p style="margin:0">Connecting to the lab server…</p>');liveLoadState()}
  }).catch(function(){if(!done){done=true;clearTimeout(t);cb()}})}
/* ---- the small status pill, bottom left ---- */
function liveBadge(){if(!LIVE.on)return;var b=document.getElementById('live-badge');
  if(!b){b=document.createElement('button');b.id='live-badge';b.style.cssText='position:fixed;left:10px;bottom:10px;z-index:800;font:600 13px/1 Barlow,system-ui,sans-serif;padding:8px 12px;border-radius:999px;border:1px solid rgba(0,0,0,.15);cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15)';b.onclick=liveMenu;document.body.appendChild(b)}
  var n=LIVE.q.length,txt,bg,fg='#fff';
  if(LIVE.down){txt=n?'Not saved yet: '+n+' change'+(n>1?'s':''):'Server not reached';bg='#B3261E'}
  else if(n){txt='Saving '+n+'…';bg='#9A6700'}
  else if(LIVE.refused){txt='Live · '+LIVE.name+' · '+LIVE.refused+' refused';bg='#9A6700'}
  else{txt='Live · '+LIVE.name;bg='#1B6E3C'}
  b.textContent=txt;b.style.background=bg;b.style.color=fg;b.setAttribute('aria-label','Lab server status: '+txt)}
function liveMenu(){var n=LIVE.q.length,h='<h2 style="margin:0 0 6px">Lab server</h2><p style="margin:0 0 14px;color:#56636F">Signed in as <b>'+esc(LIVE.name)+'</b>. '+(LIVE.down?'The server does not answer right now.':'Connected.')+(n?' '+n+' change'+(n>1?'s':'')+' waiting to save.':' All changes are saved.')+(LIVE.refused?' The server refused '+LIVE.refused+' change'+(LIVE.refused>1?'s':'')+'. Tell Richard.':'')+'</p>';
  var bs='style="font:inherit;font-weight:600;padding:11px 14px;border:1px solid #9aa6b1;border-radius:9px;background:#fff;color:#16212B;cursor:pointer;width:100%;margin-bottom:8px;text-align:left"';
  if(ADMIN){h+='<button id="lm-people" '+bs+'>Names on the sign-in list</button><button id="lm-pass" '+bs+'>Change the lab passcode</button><button id="lm-update" '+bs+'>Update the app</button><button id="lm-export" '+bs+'>Download a backup file</button>'}
  h+='<button id="lm-out" '+bs+'>Sign out on this device</button><p id="live-err" style="color:#56636F;margin:6px 0 10px;min-height:1em"></p><button id="lm-close" '+LIVE_BTN+'>Close</button>';
  liveOv(h);var $=function(i){return document.getElementById(i)};
  $('lm-close').onclick=function(){liveOv(null)};
  $('lm-out').onclick=function(){if(LIVE.q.length){liveErr('Wait until all changes are saved, then sign out.');return}liveApi('api/logout',{}).then(function(){lsSet('renew-live-token',null);location.reload()},function(){lsSet('renew-live-token',null);location.reload()})};
  if(ADMIN){
    $('lm-people').onclick=function(){liveApi('api/hello').then(function(hh){liveOv('<h2 style="margin:0 0 6px">Names</h2><p style="margin:0 0 10px;color:#56636F">One name on each line. Old pulls keep the name they were logged with.</p><textarea id="lp-t" rows="12" '+LIVE_IN+'>'+esc((hh.people||[]).join('\n'))+'</textarea><p id="live-err" style="color:#B3261E;margin:0 0 10px;min-height:1em"></p><button id="lp-go" '+LIVE_BTN+'>Save names</button>');
      document.getElementById('lp-go').onclick=function(){liveApi('api/people',{people:document.getElementById('lp-t').value.split('\n')}).then(function(){liveOv(null);toast('Names saved.')},function(e){liveErr(e.message)})}})};
    $('lm-pass').onclick=function(){liveOv('<h2 style="margin:0 0 6px">Change the lab passcode</h2><p style="margin:0 0 10px;color:#56636F">Devices that are signed in stay signed in. New sign-ins need the new passcode.</p><input id="lc-p" type="text" autocomplete="off" '+LIVE_IN+'><p id="live-err" style="color:#B3261E;margin:0 0 10px;min-height:1em"></p><button id="lc-go" '+LIVE_BTN+'>Save passcode</button>');
      document.getElementById('lc-go').onclick=function(){var v=document.getElementById('lc-p').value.trim();if(v.length<4){liveErr('4 characters or more.');return}liveApi('api/secrets',{passcode:v}).then(function(){liveOv(null);toast('Passcode changed.')},function(e){liveErr(e.message)})}};
    $('lm-update').onclick=function(){if(LIVE.q.length){liveErr('Wait until all changes are saved.');return}liveErr('Downloading the newest version…');liveApi('api/update-app',{}).then(function(){location.reload()},function(e){liveErr(e.message)})};
    $('lm-export').onclick=function(){fetch('api/export',{headers:{Authorization:'Bearer '+LIVE.token}}).then(function(r){return r.blob()}).then(function(bl){var a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download='renew-parts-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click()},function(){liveErr('Could not download.')})}}}
