// Map checks (second design) on the demo build
const {chromium}=require('playwright');const fs=require('fs');
let pass=0,fail=0;function ok(c,m){if(c)pass++;else{fail++;console.log('FAIL',m)}}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
let html=fs.readFileSync('/mnt/user-data/outputs/renew-parts.html','utf8');const mark='\nwindow.renewRole=function(v)';
html=html.replace(mark,'\nwindow.__m={S:function(){return S},world:mapWorld,answer:mapAnswer,checks:mapChecks,html:mapWorldHTML,UI:function(){return UI},SYSTEMS:SYSTEMS};'+mark);fs.writeFileSync('t.html',html);
await p.goto('file://'+process.cwd()+'/t.html');await p.waitForFunction(()=>window.renewCatalog);
const t0=Date.now();await p.evaluate(()=>window.renewGo('map'));await p.waitForSelector('.mp-home');const open=Date.now()-t0;ok(open<2000,'map opens in under 2 s: '+open+' ms');console.log('  map open time',open,'ms');
const r=await p.evaluate(()=>{const M=window.__m,S=M.S(),out={n:S.parts.length,noWorld:0,noFit:[],kinds:{},err:[],slow:0};
 const t0=performance.now();
 S.parts.forEach((q,i)=>{try{const W=M.world({t:'part',id:q.id});if(!W){out.noWorld++;return}out.kinds[W.kind]=(out.kinds[W.kind]||0)+1;
   if(!W.impl.length&&!W.tops.length)out.noFit.push(q.pn);if(!M.answer(W))out.err.push(q.pn);if(i%40===0)M.html(W)}catch(e){out.err.push(q.pn+': '+e.message)}});
 out.ms=Math.round(performance.now()-t0);
 let pl=0;M.SYSTEMS.forEach(s=>s.plats.forEach(x=>{const W=M.world({t:'plat',key:s.id+'|'+x});if(W){pl++;M.html(W)}}));out.plats=pl;out.expect=M.SYSTEMS.reduce((a,s)=>a+s.plats.length,0);
 const tb=S.parts.find(q=>q.type==='tibase'&&q.sys==='nobel-cc'&&q.plat==='RP');tb.fits=[[tb.sys,tb.plat],['str-blt','RC']];const c=M.checks();out.seed=c.links.filter(l=>l.ref.indexOf('nobel-cc|RP')>=0&&l.ref.indexOf('str-blt|RC')>=0).length;delete tb.fits;
 const c2=M.checks();out.links=c2.links.length;out.gaps=c2.plats.length;return out});
ok(r.noWorld===0&&r.err.length===0,'every part gets an answer: '+r.n+' parts, '+r.noWorld+' without, errors '+r.err.slice(0,3).join(' | '));
ok(r.noFit.length<=12,'parts with no platform and no top to show: '+r.noFit.length+' '+r.noFit.slice(0,12).join(', '));
ok(r.plats===r.expect,'every platform has a page: '+r.plats+' of '+r.expect);ok(r.seed===1,'a seeded wrong link shows in the catalog checks');
await p.click('.mp-home .mp-tile');await p.waitForSelector('.mp-held');ok((await p.textContent('.mp-answer')).length>30,'picking a stocked part shows its answer');
await p.click('.mp-lane .mp-chip');await p.waitForTimeout(200);ok(await p.$('.mp-held')===null&&(await p.textContent('.mp-answer')).indexOf('Parts for')===0,'a platform chip opens the platform page');
await p.click('[data-act=map-back]');await p.waitForSelector('.mp-held');ok(true,'Back returns to the part');
await p.click('[data-act=map-flag]');await p.fill('#map-note','test flag');await p.click('[data-act=map-flag-save]');await p.waitForSelector('.map-flagged');ok(true,'a flag saves and shows on the part');
await p.evaluate(()=>{window.renewRole('lead');window.__m.UI().repTab='catalog';window.renewGo('reports')});await p.waitForTimeout(1500);
ok((await p.textContent('#main')).indexOf('Review list (1 open)')>=0,'the flag shows in Reports, Catalog checks');
ok(errs.length===0,'no page errors: '+errs.slice(0,2).join(' | '));
console.log(JSON.stringify({kinds:r.kinds,ms:r.ms,links:r.links,gaps:r.gaps}));console.log('MAP checks passed',pass,'failed',fail);await b.close();process.exit(fail?1:0)})();
