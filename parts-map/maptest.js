// map checks on the demo build
const {chromium}=require('playwright');const fs=require('fs');
let pass=0,fail=0;function ok(c,m){if(c)pass++;else{fail++;console.log('FAIL',m)}}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
let html=fs.readFileSync('/mnt/user-data/outputs/renew-parts.html','utf8');const mark='\nwindow.renewRole=function(v)';
html=html.replace(mark,'\nwindow.__m={G:function(){return MAPG},UI:function(){return UI},S:function(){return S},build:mapBuild,tog:mapToggle,partsFor:partsFor,SYSTEMS:SYSTEMS};'+mark);fs.writeFileSync('t.html',html);
await p.goto('file://'+process.cwd()+'/t.html');await p.waitForFunction(()=>window.renewCatalog);
const t0=Date.now();await p.evaluate(()=>window.renewGo('map'));await p.waitForSelector('#map-cv');const open=Date.now()-t0;ok(open<2000,'map opens in under 2 s: '+open+' ms');console.log('  map open time',open,'ms');
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{const M=window.__m,G=M.G(),S=M.S();const out={};
 out.nodes=G.nodes.length;out.plats=G.nodes.filter(n=>n.t==='plat').length;out.expect=M.SYSTEMS.reduce((a,s)=>a+s.plats.length,0);
 // every part reachable: each part is in the list of at least one platform node
 const seen={};G.nodes.filter(n=>n.t==='plat').forEach(n=>M.partsFor(n.sys,n.pl).forEach(q=>seen[q.id]=1));out.reach=Object.keys(seen).length;out.parts=S.parts.length;
 out.warn=G.links.filter(l=>l.warn).length;out.prob=G.nodes.filter(n=>n.prob).length;
 // seeded wrong link: put a Ti-base on an unrelated platform
 const tb=S.parts.find(q=>q.type==='tibase'&&q.sys==='nobel-cc'&&q.plat==='RP');tb.fits=[[tb.sys,tb.plat],['str-blt','RC']];M.build();const G2=M.G();
 const l=G2.links.find(l=>l.kind==='share'&&((l.a.key==='nobel-cc|RP'&&l.b.key==='str-blt|RC')||(l.b.key==='nobel-cc|RP'&&l.a.key==='str-blt|RC')));out.seed=l?[l.warn,l.why.join(' ')]:null;
 delete tb.fits;M.build();
 // open a platform and a group
 const P=M.G().by['p:nobel-cc|RP'];M.tog(P);const g=M.G().nodes.filter(n=>n.t==='grp');out.groups=g.length;M.tog(g[0]);out.partNodes=M.G().nodes.filter(n=>n.t==='part').length;out.more=M.G().by[g[0].id].more;
 return out});
ok(r.plats===r.expect,'every platform is on the map: '+r.plats+' of '+r.expect);ok(r.reach===r.parts,'every part is reachable: '+r.reach+' of '+r.parts);
ok(r.seed&&r.seed[0]===true,'a seeded wrong link is marked: '+JSON.stringify(r.seed));ok(r.groups>=5&&r.partNodes>0,'platform opens into groups and parts: '+r.groups+' groups, '+r.partNodes+' part dots');
ok(errs.length===0,'no page errors: '+errs.slice(0,2).join(' | '));
console.log(JSON.stringify(r));console.log('MAP checks passed',pass,'failed',fail);await b.close();process.exit(fail?1:0)})();
