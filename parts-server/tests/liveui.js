// real screens and the app's own pull function, in live mode
const {spawn}=require('child_process');const fs=require('fs');const {chromium}=require('playwright');
const PORT=18082,B='http://127.0.0.1:'+PORT,DATA=__dirname+'/srvtest/ui';
let pass=0,failN=0;function ok(c,m){if(c)pass++;else{failN++;console.log('FAIL',m)}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function start(){const p=spawn(__dirname+'/rps',['-port',''+PORT,'-data',DATA],{stdio:'pipe'});return new Promise(res=>{p.stdout.on('data',d=>{if(String(d).includes('Leave this window'))res(p)})})}
(async()=>{fs.rmSync(DATA,{recursive:true,force:true});fs.mkdirSync(DATA+'/app',{recursive:true});
let html=fs.readFileSync('/mnt/user-data/outputs/renew-parts.html','utf8');const mark='\nwindow.renewRole=function(v)';
html=html.replace(mark,'\nwindow.__t={S:function(){return S},save:save,render:render,LIVE:LIVE,byWho:byWho,doPull:doPull,partById:partById,admin:function(){return ADMIN}};'+mark);fs.writeFileSync(DATA+'/app/index.html',html);
const srv=await start();
await fetch(B+'/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passcode:'lab1234',pin:'4821',people:['Richard','Will','Maya']})});
const br=await chromium.launch();const errs=[];
async function dev(name){const ctx=await br.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();await p.route(/fonts\.googleapis|cdnjs|jsdelivr|unpkg/,r=>r.abort());p.on('pageerror',e=>errs.push(name+': '+e.message));
  await p.goto(B+'/');await p.waitForSelector('#ll-go');await p.selectOption('#ll-name',name);await p.fill('#ll-pass','lab1234');await p.click('#ll-go');await p.waitForSelector('#live-badge',{timeout:20000});await sleep(2000);return p}
const A=await dev('Maya'),T=await dev('Will');
// every screen, tech view
for(const [a,v] of [['nav','learn'],['learn-tab','types'],['learn-tab','systems'],['learn-tab','screws'],['learn-tab','drill'],['nav','patient'],['nav','find'],['find-mode','browse'],['find-mode','rx'],['find-mode','guided']]){const el=T.locator(`[data-act="${a}"][data-v="${v}"]`).first();if(await el.count()){await el.click().catch(e=>errs.push(a+' '+e.message));await sleep(150)}else console.log('missing',a,v)}
ok(await T.evaluate(()=>document.documentElement.scrollWidth)===390,'tech screens fit a phone in live mode');
// the real office PIN screen
await A.locator('[data-act="pin-open"]').first().click();await A.waitForSelector('#pin-in');
ok((await A.textContent('body')).includes('Type the 4-digit admin PIN'),'PIN screen asks for the PIN (not "set a PIN")');
await A.fill('#pin-in','0000');await A.locator('[data-act="pin-go"]').click();await sleep(1500);ok((await A.textContent('body')).includes('That PIN is not right'),'wrong PIN refused by the server');
await A.fill('#pin-in','4821');await A.locator('[data-act="pin-go"]').click();await sleep(1200);ok(await A.evaluate(()=>window.__t.admin())===true,'right PIN opens admin view');
for(const v of ['stockhub','reports','layout']){await A.evaluate(v=>window.renewGo(v),v);await sleep(300)}
ok(await A.evaluate(()=>document.documentElement.scrollWidth)===390,'admin screens fit a phone in live mode');
// Maya's team enters a real count; a tech pulls with the app's own pull function
const pid=await A.evaluate(()=>{const S=window.__t.S();const p=S.parts.filter(p=>p.stocked&&p.bin)[0];p.onHand=8;window.__t.save();return p.id});await sleep(800);
const res=await T.evaluate(id=>{const t=window.__t;const r=t.doPull(t.partById(id),2,'10482');t.save();const S=t.S();const pl=S.pulls[S.pulls.length-1];return {msg:r&&r.msg,by:pl.by,pt:pl.pt,q:pl.q,oh:t.partById(id).onHand,n:S.pulls.length}},pid);
ok(res.by==='Will'&&res.pt==='10482'&&res.q===2&&res.oh===6,'pull logged with the person\'s name: '+JSON.stringify(res));
await sleep(900);const seenA=await A.evaluate(id=>{const t=window.__t,S=t.S();return {oh:t.partById(id).onHand,n:S.pulls.length,by:S.pulls[0]&&S.pulls[0].by}},pid);
ok(seenA.oh===6&&seenA.n===1&&seenA.by==='Will','office device sees the pull: '+JSON.stringify(seenA));
// a remote change must not wipe what someone is typing
await T.locator('[data-act="nav"][data-v="patient"]').first().click();await sleep(200);await T.fill('#chg-pt','104');await T.focus('#chg-pt');
await A.evaluate(id=>{const t=window.__t;t.partById(id).onHand+=10;t.save()},pid);await sleep(900);
ok(await T.inputValue('#chg-pt')==='104','typing kept while a change arrived');ok(await T.evaluate(id=>window.__t.partById(id).onHand,pid)===16,'the change still arrived underneath');
// reports screen on the office device shows the real pull
await A.evaluate(()=>window.renewGo('reports'));await sleep(400);ok(errs.length===0,'no page errors: '+errs.slice(0,3).join(' | '));
// sign out
await T.locator('#chg-pt').blur();await T.click('#live-badge');await T.click('#lm-out');await T.waitForSelector('#ll-go',{timeout:15000});ok(true,'sign out returns to the sign-in screen');
await A.screenshot({path:__dirname+'/live_admin.png'});await T.screenshot({path:__dirname+'/live_login.png'});
srv.kill();await br.close();console.log('LIVE UI checks passed',pass,'failed',failN);process.exit(failN?1:0)})();
