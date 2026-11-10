// node apitest.js  -> starts the server on a temp data folder and checks the API
const {spawn}=require('child_process');const fs=require('fs');const B='http://127.0.0.1:18080';
let pass=0,failN=0;function ok(c,m){if(c)pass++;else{failN++;console.log('FAIL',m)}}
const j=async(p,body,tok,method)=>{const r=await fetch(B+p,{method:method||(body?'POST':'GET'),headers:Object.assign({'Content-Type':'application/json'},tok?{Authorization:'Bearer '+tok}:{}),body:body?JSON.stringify(body):undefined});let d=null;try{d=await r.json()}catch(e){}return {s:r.status,d}};
function start(){const p=spawn('./rps',['-port','18080','-data','srvtest/data'],{stdio:'pipe'});return new Promise(res=>{p.stdout.on('data',d=>{if(String(d).includes('Leave this window'))res(p)})})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{fs.rmSync('srvtest/data',{recursive:true,force:true});let srv=await start();
let r=await j('/api/hello');ok(r.d.renewParts&&r.d.setup===false,'hello before setup');
r=await j('/api/state');ok(r.s===401,'state needs sign-in');
r=await j('/api/setup',{passcode:'12',pin:'9999',people:['A']});ok(r.s===400,'short passcode refused');
r=await j('/api/setup',{passcode:'lab1234',pin:'lab1234',people:['A']});ok(r.s===400,'pin same as passcode refused');
r=await j('/api/setup',{passcode:'lab1234',pin:'9911',people:['Richard','Maya',' Will ','will']});ok(r.s===200,'setup');
r=await j('/api/setup',{passcode:'zzzz1',pin:'0000',people:['X']});ok(r.s===403,'second setup refused');
r=await j('/api/hello');ok(r.d.setup&&r.d.people.join()==='Maya,Richard,Will','people cleaned: '+r.d.people);
r=await j('/api/login',{passcode:'nope',name:'Richard'});ok(r.s===403,'wrong passcode');
r=await j('/api/login',{passcode:'lab1234',name:'Nobody'});ok(r.s===400,'unknown name');
const A=(await j('/api/login',{passcode:'lab1234',name:'Richard'})).d.token,Bk=(await j('/api/login',{passcode:'lab1234',name:'Will'})).d.token;ok(A&&Bk&&A!==Bk,'two sessions');
// live events for B
const ev=[];const ctl=new AbortController();fetch(B+'/api/events?token='+Bk,{signal:ctl.signal}).then(async res=>{const rd=res.body.getReader();const dec=new TextDecoder();let buf='';for(;;){const {done,value}=await rd.read();if(done)break;buf+=dec.decode(value);let i;while((i=buf.indexOf('\n\n'))>=0){const blk=buf.slice(0,i);buf=buf.slice(i+2);const m=/^data: (.*)$/m.exec(blk);if(m&&!/^event: hello/m.test(blk))ev.push(JSON.parse(m[1]))}}}).catch(()=>{});
await sleep(200);
r=await j('/api/ops',{ops:[{o:'a1',t:'set',c:'parts',id:'k:dess|19.006|x|RP|sc',f:{stocked:true,bin:'C17',min:4}},{o:'a2',t:'inc',c:'parts',id:'k:dess|19.006|x|RP|sc',k:'onHand',n:500}]},A);ok(r.s===200&&r.d.applied.length===2,'set + inc');
await sleep(150);ok(ev.length===2&&ev[0].who==='Richard'&&ev[1].op.t==='inc','B got 2 live events: '+ev.length);
// two devices pull the same part at the same moment, 200 times each
const jobs=[];for(let i=0;i<200;i++){jobs.push(j('/api/ops',{ops:[{o:'pa'+i,t:'inc',c:'parts',id:'k:dess|19.006|x|RP|sc',k:'onHand',n:-1},{o:'pua'+i,t:'put',c:'pulls',id:'ua'+i,d:{d:'2026-11-10',p:'k:dess|19.006|x|RP|sc',q:1,pt:'10482',by:'Richard'}}]},A));jobs.push(j('/api/ops',{ops:[{o:'pb'+i,t:'inc',c:'parts',id:'k:dess|19.006|x|RP|sc',k:'onHand',n:-1},{o:'pub'+i,t:'put',c:'pulls',id:'ub'+i,d:{d:'2026-11-10',p:'k:dess|19.006|x|RP|sc',q:1,pt:'10561',by:'Will'}}]},Bk))}
const rs=await Promise.all(jobs);ok(rs.every(x=>x.s===200),'400 parallel requests all saved');
r=await j('/api/state',null,A);const part=r.d.docs.parts[0].d;ok(part.onHand===100,'stock exact after 400 parallel pulls: '+part.onHand);ok(part.bin==='C17'&&part.stocked===true&&part.min===4,'fields kept');ok(r.d.docs.pulls.length===400,'400 pulls saved');
// retry of an op that was already saved must not count twice
r=await j('/api/ops',{ops:[{o:'pa0',t:'inc',c:'parts',id:'k:dess|19.006|x|RP|sc',k:'onHand',n:-1}]},A);ok(r.s===200&&r.d.applied[0]==='pa0','retry accepted');
r=await j('/api/state',null,A);ok(r.d.docs.parts[0].d.onHand===100,'retry did not count twice');
r=await j('/api/ops',{ops:[{o:'d1',t:'del',c:'pulls',id:'ua0'}]},A);r=await j('/api/state',null,A);ok(r.d.docs.pulls.length===399,'delete');
r=await j('/api/ops',{ops:[{o:'bad1',t:'zap',c:'x',id:'1'},{o:'bad2',t:'inc',c:'parts',id:'k:dess|19.006|x|RP|sc',k:'onHand',n:-50}]},A);ok(r.s===400,'bad op refused');
r=await j('/api/state',null,A);ok(r.d.docs.parts[0].d.onHand===100,'bad batch saved nothing');
// admin
r=await j('/api/people',{people:['Richard','Maya','Will','Kyle']},A);ok(r.s===403,'people needs PIN');
r=await j('/api/admin',{pin:'0000'},A);ok(r.s===403,'wrong PIN');
r=await j('/api/admin',{pin:'9911'},A);ok(r.s===200,'PIN ok');
r=await j('/api/people',{people:['Richard','Maya','Will','Kyle']},A);ok(r.s===200&&r.d.people.length===4,'people updated');
r=await j('/api/export',null,A);ok(r.s===200&&r.d.records.length===400&&r.d.history.length>800,'export has records and history');
r=await j('/api/export',null,Bk);ok(r.s===403,'export needs PIN');
const page=await fetch(B+'/');const html=await page.text();ok(page.status===200&&html.length>1000000,'serves the app');
// restart: nothing lost
ctl.abort();srv.kill();await sleep(500);srv=await start();
r=await j('/api/state',null,A);ok(r.s===200&&r.d.docs.parts[0].d.onHand===100&&r.d.docs.pulls.length===399&&r.d.name==='Richard'&&r.d.admin===true,'after restart: data and sign-in kept');
r=await j('/api/logout',{},A);r=await j('/api/state',null,A);ok(r.s===401,'sign out');
srv.kill();console.log('API checks passed',pass,'failed',failN);process.exit(failN?1:0)})();
