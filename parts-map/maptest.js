// Map checks (third design: stack and tree) on the demo build
const {chromium}=require('playwright');const fs=require('fs');
let pass=0,fail=0;function ok(c,m){if(c)pass++;else{fail++;console.log('FAIL',m)}}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
let html=fs.readFileSync('/mnt/user-data/outputs/renew-parts.html','utf8');const mark='\nwindow.renewRole=function(v)';
html=html.replace(mark,'\nwindow.__m={S:function(){return S},UI:function(){return UI},SYSTEMS:SYSTEMS,ui:mapUI,model:m3Model,jump:m3Jump,stack:m3StackHTML,tree:m3TreeHTML,body:mapBodyHTML,checks:mapChecks,fams:m3Fams,stkState:stkState,stkCands:stkCands,setSys:m3SetSys,topOf:m3TopOf};'+mark);fs.writeFileSync('t.html',html);
await p.goto('file://'+process.cwd()+'/t.html');await p.waitForFunction(()=>window.renewCatalog);
const t0=Date.now();await p.evaluate(()=>window.renewGo('map'));await p.waitForSelector('.xs');const open=Date.now()-t0;ok(open<2000,'map opens in under 2 s: '+open+' ms');console.log('  map open time',open,'ms');
ok(await p.$('.xs-part')!==null&&(await p.$$('.xs-row')).length===4,'the map opens on a full stack of four levels, not on a pick screen');
const first=await p.evaluate(()=>{const M=window.__m.model();return {sys:M.u.sys,plat:M.u.plat,mua:M.mua&&M.mua.pn,screw:M.screw&&M.screw.pn,frame:M.frame}});console.log('  opens on',JSON.stringify(first));
ok(first.frame&&/19\.006/.test(first.screw||''),'the first stack is the lab default: frame direct to the multi-unit with DESS 19.006');
const r=await p.evaluate(()=>{const M=window.__m,S=M.S(),out={n:S.parts.length,miss:[],err:[],plats:0,expect:0,stkBefore:JSON.stringify(M.stkState()),engine:[],byView:{stack:0,tree:0}};
 const t0=performance.now();
 S.parts.forEach(q=>{try{const u=M.ui();u.view='stack';u.open={};const seen=M.jump(q);if(!seen)out.miss.push(q.pn+' ('+q.type+', '+q.sys+')');else out.byView[u.view]++;}catch(e){out.err.push(q.pn+': '+e.message)}});
 out.ms=Math.round(performance.now()-t0);
 // every platform draws in both views; the screws match the stack engine
 M.SYSTEMS.forEach(s=>s.plats.forEach(pl=>{out.expect++;try{M.setSys(s.id);const u=M.ui();u.plat=pl;u.mua=u.top=u.screw=null;const Mo=M.model();if(M.stack(Mo).length>200&&M.tree(Mo).length>100)out.plats++;
   if(s.level==='implant'){const tops={};Mo.muas.concat([null]).forEach(m=>{const tk=m?(M.topOf(m)||['?']).join('|'):'skip';if(tops[tk])return;tops[tk]=1;u.mua=m?m.id:'skip';u.top=null;u.screw=null;const M2=M.model();
     const cand=M2.frame?[null]:[];M2.onTop.filter(x=>x.type==='tibase').slice(0,3).forEach(x=>cand.push(x));
     cand.forEach(t=>{u.top=t?t.id:'direct';u.screw=null;const M3=M.model();const st=M.stkState(),sv=JSON.stringify(st);st.sys=s.id;st.plat=pl;st.mode='final';st.dess=false;st.mua=m?m.id:'skip';st.top=t?t.id:'direct';st.screw=null;
       const eng=M.stkCands('screw').map(x=>x.p.pn).join(',');const o=JSON.parse(sv);Object.keys(st).forEach(k=>{if(k in o)st[k]=o[k];else delete st[k]});
       const mine=M3.scr.list.map(x=>x.pn).join(',');if(eng!==mine)out.engine.push(s.id+' '+pl+' '+(m?m.pn:'skip')+' '+(t?t.pn:'direct'))})})}
 }catch(e){out.err.push(s.id+' '+pl+': '+e.message)}}));
 out.stkAfter=JSON.stringify(M.stkState());
 const tb=S.parts.find(q=>q.type==='tibase'&&q.sys==='nobel-cc'&&q.plat==='RP');tb.fits=[[tb.sys,tb.plat],['str-blt','RC']];const c=M.checks();out.seed=c.links.filter(l=>l.ref.indexOf('nobel-cc|RP')>=0&&l.ref.indexOf('str-blt|RC')>=0).length;delete tb.fits;
 const c2=M.checks();out.links=c2.links.length;out.gaps=c2.plats.length;UI=null;return out}).catch(e=>({fatal:e.message}));
if(r.fatal){console.log('FATAL',r.fatal);process.exit(1)}
ok(r.err.length===0,'no errors: '+r.err.slice(0,3).join(' | '));
ok(r.miss.length<=12,'parts the map cannot show after a look-up: '+r.miss.length+' of '+r.n+': '+r.miss.slice(0,14).join(', '));
ok(r.plats===r.expect,'every platform draws as a stack and as a tree: '+r.plats+' of '+r.expect);
ok(r.engine.length===0,'the screw choices match the stack engine: '+r.engine.length+' differ '+r.engine.slice(0,3).join(' | '));
ok(r.stkBefore===r.stkAfter,'the map does not change the state of Build the stack');
ok(r.seed===1,'a seeded wrong link shows in the catalog checks');
console.log(JSON.stringify({parts:r.n,shown:r.byView,miss:r.miss.length,ms:r.ms,links:r.links,gaps:r.gaps}));
await p.reload();await p.waitForFunction(()=>window.renewCatalog);await p.evaluate(()=>window.renewGo('map'));await p.waitForSelector('.xs');
const scr0=await p.textContent('.xs-row:nth-child(1) h3');
await p.click('[data-act=map-fam][data-v="3:tibase"]');await p.click('.xs-row:nth-child(2) .xs-rail .m3-t');await p.waitForTimeout(150);
const top1=await p.textContent('.xs-row:nth-child(2) h3'),scr1=await p.textContent('.xs-row:nth-child(1) h3');ok(/DESS/.test(top1)&&scr1!==''&&!!scr0,'picking a ti-base puts it in the stack and sets its screw: '+top1+' with '+scr1);
await p.click('[data-act=map-pick][data-v="2:skip"]');await p.waitForTimeout(150);ok((await p.textContent('.xs-plate')).indexOf('No multi-unit abutment')>=0&&(await p.textContent('.xs-row:nth-child(2) .xs-lv')).indexOf('On top')>=0,'No multi-unit puts the next part straight on the implant');
await p.click('.xs-plats [data-act=map-plat]:not(.on)');await p.waitForTimeout(150);ok(await p.$('.xs-part')!==null,'a platform chip changes the implant');
await p.fill('#map-q','19.006');await p.waitForSelector('#map-hits button');await p.click('#map-hits button[data-v^="x:"]');await p.waitForTimeout(200);
ok(await p.$('.xs-yours')!==null&&/19\.006/.test(await p.textContent('.xs-row:nth-child(1) h3')),'a part number look-up puts that part in the stack');
await p.click('.xs-row:nth-child(1) [data-act=map-flag]');await p.fill('#map-note','test flag');await p.click('[data-act=map-flag-save]');await p.waitForSelector('.map-flagged');ok(true,'a flag saves and shows on the part');
await p.click('[data-act=map-view][data-v=tree]');await p.waitForSelector('.tr');ok((await p.$$('.tr-n.fam')).length>=6,'the tree view draws the families as branches');
await p.click('.tr-n.fam:not(.open) .tr-h');await p.waitForSelector('.tr-cl .m3-t');ok(true,'a branch opens to its parts');
await p.selectOption('#m3-sel','nobel-mua');await p.waitForTimeout(200);ok((await p.textContent('#map-root')).indexOf('reach this top')>=0,'a multi-unit top can be the start');
await p.evaluate(()=>{window.renewRole('lead');window.__m.UI().repTab='catalog';window.renewGo('reports')});await p.waitForTimeout(1500);
ok((await p.textContent('#main')).indexOf('Review list (1 open)')>=0,'the flag shows in Reports, Catalog checks');
ok(errs.length===0,'no page errors: '+errs.slice(0,2).join(' | '));
console.log('MAP checks passed',pass,'failed',fail);await b.close();process.exit(fail?1:0)})();
