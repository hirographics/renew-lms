// node review2.js out.jsonl sheet.png [typeFilter] [limit] [offset]  -> one tile per picture, with the part name and type in readable text
const {chromium}=require('playwright');const fs=require('fs');
const rows=fs.readFileSync(process.argv[2],'utf8').trim().split('\n').map(JSON.parse);
const T=JSON.parse(fs.readFileSync(__dirname+'/types.json'));const R=JSON.parse(fs.readFileSync(__dirname+'/../oem/oem_rows.json'));const N={};R.forEach(r=>N[r[1]+'|'+r[0]]=r[5]);
const filt=process.argv[4]&&process.argv[4]!=='all'?process.argv[4]:null;
const by={};rows.forEach(r=>{if(!r.raw)return;const t=T[r.maker+'|'+r.pn]||'?';if(filt&&t!==filt)return;const k=r.hash+'|'+t;(by[k]=by[k]||{r,t,pns:[]}).pns.push(r.pn)});
let items=Object.values(by);const lim=+(process.argv[5]||200),off=+(process.argv[6]||0);items=items.slice(off,off+lim);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1560,height:900}});
await p.goto('file://'+__dirname+'/h2.html');await p.waitForTimeout(2500);
const html=await p.evaluate(({items,N})=>{let h='<div style="display:flex;flex-wrap:wrap;gap:3px;background:#fff;font:11px sans-serif">';
 items.forEach((it,i)=>{const r=it.r;h+='<div style="width:126px;border:1px solid #ccc;padding:2px"><div style="width:74px;margin:auto">'+window.__trRender(r.raw,it.t)+'</div><div><b style="color:#b00">'+it.t+'</b> '+r.pn+(it.pns.length>1?' +'+(it.pns.length-1):'')+'<br>'+String(N[r.maker+'|'+r.pn]||'').slice(0,44)+'</div></div>'});
 return h+'</div>'},{items,N});
await p.setContent('<body style="margin:0;background:#fff">'+html+'</body>');await p.waitForTimeout(300);
await p.screenshot({path:process.argv[3],fullPage:true});console.log('tiles',items.length);await b.close()})();
