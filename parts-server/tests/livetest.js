// two "devices" (separate browser contexts) against a real server
const {spawn}=require('child_process');const fs=require('fs');const {chromium}=require('playwright');
const PORT=18081,B='http://127.0.0.1:'+PORT,DATA=__dirname+'/srvtest/live';
let pass=0,failN=0;function ok(c,m){if(c)pass++;else{failN++;console.log('FAIL',m)}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function start(){const p=spawn(__dirname+'/rps',['-port',''+PORT,'-data',DATA],{stdio:'pipe'});return new Promise(res=>{p.stdout.on('data',d=>{if(String(d).includes('Leave this window'))res(p)})})}
(async()=>{fs.rmSync(DATA,{recursive:true,force:true});fs.mkdirSync(DATA+'/app',{recursive:true});
// test build of the app = the real file + a hook to reach its data
let html=fs.readFileSync('/mnt/user-data/outputs/renew-parts.html','utf8');const mark='\nwindow.renewRole=function(v)';
html=html.replace(mark,'\nwindow.__t={S:function(){return S},save:save,render:render,LIVE:LIVE,byWho:byWho,nextId:nextId,admin:function(){return ADMIN}};'+mark);fs.writeFileSync(DATA+'/app/index.html',html);
let srv=await start();const br=await chromium.launch();const errs=[];
async function dev(){const ctx=await br.newContext({viewport:{width:390,height:800}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));return p}
const A=await dev();await A.goto(B+'/');
await A.waitForSelector('#ls-go');ok(true,'setup form shows on a new server');
await A.fill('#ls-pass','lab1234');await A.fill('#ls-pin','12');await A.click('#ls-go');ok((await A.textContent('#live-err')).includes('4 digits'),'setup checks the PIN');
await A.fill('#ls-pin','4821');await A.fill('#ls-people','Richard\nWill\nMaya\nKyle');await A.click('#ls-go');
await A.waitForSelector('#ll-go');await A.selectOption('#ll-name','Richard');await A.fill('#ll-pass','wrong');await A.click('#ll-go');await sleep(1200);ok((await A.textContent('#live-err')).includes('not right'),'wrong passcode message');
await A.fill('#ll-pass','lab1234');await A.click('#ll-go');await A.waitForSelector('#live-badge',{timeout:20000});await sleep(2500);
ok((await A.textContent('#live-badge')).trim()==='Live · Richard','badge: '+await A.textContent('#live-badge'));
let st=await A.evaluate(()=>{const S=window.__t.S();return {pulls:S.pulls.length,ret:S.returns.length,req:S.requests.length,stocked:S.parts.filter(p=>p.stocked).length,onhand:S.parts.reduce((a,p)=>a+(p.onHand||0),0),bins:S.parts.filter(p=>p.bin).length,q:window.__t.LIVE.q.length,pair:Object.keys(S.pairings).length}});
ok(st.pulls===0&&st.ret===0&&st.req===0&&st.onhand===0,'starts clean: no sample pulls or counts '+JSON.stringify(st));ok(st.stocked>50&&st.bins>20,'bin setup kept: '+st.stocked+' stocked, '+st.bins+' with bins');ok(st.q===0,'baseline uploaded');
const tokA=await A.evaluate(()=>localStorage.getItem('renew-live-token'));
const api=async(p,tok)=>(await fetch(B+p,{headers:{Authorization:'Bearer '+tok}})).json();
let sv=await api('/api/state',tokA);ok(sv.seeded&&sv.docs.parts.length>=st.stocked,'server holds the baseline: '+sv.docs.parts.length+' part records for '+st.stocked+' stocked');ok((sv.docs.pairings||[]).length===st.pair,'pairings uploaded');
// device B
const Bp=await dev();await Bp.goto(B+'/');await Bp.waitForSelector('#ll-go');await Bp.selectOption('#ll-name','Will');await Bp.fill('#ll-pass','lab1234');await Bp.click('#ll-go');await Bp.waitForSelector('#live-badge',{timeout:20000});await sleep(1500);
let sb=await Bp.evaluate(()=>{const S=window.__t.S();return {stocked:S.parts.filter(p=>p.stocked).length,bins:S.parts.filter(p=>p.bin).length,who:window.__t.byWho()}});
ok(sb.stocked===st.stocked&&sb.bins===st.bins&&sb.who==='Will','device B loads the same setup as Will: '+JSON.stringify(sb));
// A (office) sets a count; B must see it within 2 s
const pid=await A.evaluate(()=>{const S=window.__t.S();const p=S.parts.filter(p=>p.stocked&&p.bin)[0];p.onHand=10;p.min=3;window.__t.save();return p.id});
const t0=Date.now();let seen=false;while(Date.now()-t0<2000){if(await Bp.evaluate(id=>window.__t.S().parts.filter(p=>p.id===id)[0].onHand,pid)===10){seen=true;break}await sleep(50)}
ok(seen,'count set on A shows on B in '+(Date.now()-t0)+' ms');console.log('  sync time A to B:',Date.now()-t0,'ms');
// both pull the same part at the same moment
const pull=(pg,pt)=>pg.evaluate(([id,pt])=>{const S=window.__t.S();const p=S.parts.filter(p=>p.id===id)[0];p.onHand-=2;S.pulls.push({d:'2026-11-10',p:id,q:2,pt:pt,by:window.__t.byWho()});window.__t.save()},[pid,pt]);
await Promise.all([pull(A,'10482'),pull(Bp,'10561')]);await sleep(1500);
const view=pg=>pg.evaluate(id=>{const S=window.__t.S();return {oh:S.parts.filter(p=>p.id===id)[0].onHand,pulls:S.pulls.map(x=>x.pt+':'+x.by+':'+(x.p===id)).sort().join(' '),q:window.__t.LIVE.q.length}},pid);
let va=await view(A),vb=await view(Bp);ok(va.oh===6&&vb.oh===6,'both pulls count: A sees '+va.oh+', B sees '+vb.oh);ok(va.pulls===vb.pulls&&va.pulls==='10482:Richard:true 10561:Will:true','both devices list both pulls with names: '+va.pulls+' / '+vb.pulls);
sv=await api('/api/state',tokA);const sp=sv.docs.parts.filter(r=>r.d.onHand===6);ok(sp.length===1&&sv.docs.pulls.length===2,'server agrees: 6 on hand, 2 pulls');ok(/^(k:|om-)/.test(sv.docs.pulls[0].d.p),'server stores the stable part key: '+sv.docs.pulls[0].d.p);
// records with ids: a request on B shows on A; edit and delete travel too
await Bp.evaluate(id=>{const S=window.__t.S();S.requests.push({id:window.__t.nextId('r'),kind:'pull',partId:id,qty:1,patient:'10590',by:window.__t.byWho(),d:'2026-11-10',status:'requested'});window.__t.save()},pid);await sleep(900);
let rq=await A.evaluate(()=>window.__t.S().requests.map(r=>r.by+':'+r.status+':'+r.partId));ok(rq.length===1&&rq[0]==='Will:requested:'+pid,'request from B shows on A with the right part: '+rq);
await A.evaluate(()=>{const S=window.__t.S();S.requests[0].status='done';window.__t.save()});await sleep(900);ok(await Bp.evaluate(()=>window.__t.S().requests[0].status)==='done','edit on A shows on B');
await A.evaluate(()=>{const S=window.__t.S();S.requests=[];window.__t.save()});await sleep(900);ok(await Bp.evaluate(()=>window.__t.S().requests.length)===0,'delete on A shows on B');
// server goes down: change waits, badge says so, nothing lost
srv.kill();await sleep(600);await pull(A,'10600');await sleep(5500);
let bd=await A.textContent('#live-badge');ok(/Not saved yet: 2 changes/.test(bd),'badge while server is down: '+bd);
srv=await start();const t1=Date.now();let back=false;while(Date.now()-t1<15000){if(await A.evaluate(()=>window.__t.LIVE.q.length)===0){back=true;break}await sleep(200)}
ok(back,'queue sent after the server returned ('+(Date.now()-t1)+' ms)');await sleep(4000);
vb=await view(Bp);ok(vb.oh===4,'B catches up after the outage: '+vb.oh);
// page closed while the server is down: the change is still sent next time
srv.kill();await sleep(600);await pull(A,'10601');await sleep(300);const q1=await A.evaluate(()=>localStorage.getItem('renew-live-q'));ok(q1&&JSON.parse(q1).length===2,'change kept on the device');
A.on('dialog',d=>d.accept());await A.goto('about:blank');srv=await start();await A.goto(B+'/');await A.waitForSelector('#live-badge',{timeout:20000});await sleep(2000);
va=await view(A);ok(va.oh===2&&va.q===0,'after reopening: change was sent, count is '+va.oh);ok(await A.evaluate(()=>window.__t.byWho())==='Richard','still signed in after reopening');
await sleep(4000);vb=await view(Bp);ok(vb.oh===2,'B agrees: '+vb.oh);
// map flags travel between devices
await Bp.evaluate(()=>{const S=window.__t.S();S.flags=S.flags||[];S.flags.push({id:window.__t.nextId('fl'),d:'2026-11-10',by:window.__t.byWho(),kind:'plat',ref:'plat:nobel-cc|NP',label:'Platform: test',note:'test flag',status:'open'});window.__t.save()});await sleep(1200);
ok(await A.evaluate(()=>(window.__t.S().flags||[]).map(f=>f.by+':'+f.status+':'+f.ref).join())==='Will:open:plat:nobel-cc|NP','flag from B shows on A');
await A.evaluate(()=>{const S=window.__t.S();S.flags[0].status='fixed';window.__t.save()});await sleep(1200);ok(await Bp.evaluate(()=>window.__t.S().flags[0].status)==='fixed','flag marked fixed on A shows on B');
// office PIN
ok(await A.evaluate(()=>window.__t.admin())===false,'tech view by default');
const r1=await fetch(B+'/api/admin',{method:'POST',headers:{Authorization:'Bearer '+tokA,'Content-Type':'application/json'},body:JSON.stringify({pin:'4821'})});ok(r1.status===200,'office PIN accepted');
await A.reload();await A.waitForSelector('#live-badge',{timeout:20000});await sleep(1500);ok(await A.evaluate(()=>window.__t.admin())===true,'admin view follows the server');
await A.click('#live-badge');ok(await A.isVisible('#lm-people')&&await A.isVisible('#lm-update'),'office menu shows for admin');await A.click('#lm-close');
await Bp.click('#live-badge');ok(!(await Bp.isVisible('#lm-people')),'no office menu for a tech');await Bp.click('#lm-close');
srv.kill();await sleep(500);srv=await start();sv=await api('/api/state',tokA);ok(sv.docs.pulls.length===4&&sv.docs.parts.filter(r=>r.d.onHand===2).length===1,'restart keeps data: '+sv.docs.pulls.length+' pulls');
ok(errs.length===0,'no page errors: '+errs.slice(0,3).join(' | '));
srv.kill();await br.close();console.log('LIVE checks passed',pass,'failed',failN);process.exit(failN?1:0)})();
