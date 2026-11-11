// node review3.js from to out.png  -> numbered tiles from review_all.json
const {chromium}=require('playwright');const fs=require('fs');const all=JSON.parse(fs.readFileSync(__dirname+'/review_all.json'));
const a=+process.argv[2],b=+process.argv[3];const items=all.slice(a,b);
(async()=>{const br=await chromium.launch();const p=await br.newPage({viewport:{width:1560,height:900}});await p.goto('file://'+__dirname+'/h2.html');await p.waitForTimeout(2200);
const html=await p.evaluate(items=>{let h='<div style="display:flex;flex-wrap:wrap;gap:2px;background:#fff;font:10px/1.15 sans-serif">';items.forEach(it=>{h+='<div style="width:116px;height:108px;overflow:hidden;border:1px solid #ccc;padding:1px;display:flex;gap:3px"><div style="width:44px;flex:none">'+window.__trRender(it.raw,it.t)+'</div><div style="min-width:0;overflow-wrap:anywhere"><b>'+it.i+'</b> <b style="color:#b00">'+it.t+'</b><br>'+it.k.replace('|',' ')+(it.c>1?' +'+(it.c-1):'')+'<br>'+it.n+'</div></div>'});return h+'</div>'},items);
await p.setContent('<body style="margin:0;background:#fff">'+html+'</body>');await p.waitForTimeout(250);await p.screenshot({path:process.argv[4],fullPage:true});await br.close()})();
