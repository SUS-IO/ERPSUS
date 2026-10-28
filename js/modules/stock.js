/* MODULE: Stock - lot-wise balances by store and department (rate-wise) */
async function pgStock(){
 const[l,stn,dpt,pdq,m]=await Promise.all([sb.from('stock_lots').select('*').order('received_at',{ascending:false}).limit(5000),sb.from('stores').select('id,name'),sb.from('departments').select('id,name'),sb.from('products').select('id,item_code,item_name,purchase_uom_id,base_uom_id').limit(5000),masters()]);
 if(l.error)throw l.error;
 const ST=idMap(stn.data),DP=idMap(dpt.data),PD=Object.fromEntries((pdq.data||[]).map(p=>[p.id,p])),U=idMap(m.uoms,'code');
 const rows=l.data.map(x=>{const p=PD[x.product_id]||{},pu=+x.qty_base/+x.uoq;
  return{...x,loc:x.store_id?'🏬 '+(ST[x.store_id]||''):'🏢 '+(DP[x.department_id]||''),code:p.item_code,name:p.item_name,pu,bu:U[p.base_uom_id]||'',pc:U[p.purchase_uom_id]||'',val:pu*(+x.rate_purchase),state:+x.qty_base>0?'In stock':'Empty'}});
 const live=rows.filter(r=>r.state==='In stock'),value=live.reduce((a,r)=>a+r.val,0);
 $('#view').innerHTML=`<div class="top"><div><h2>Stock</h2><p class="mut">Every purchase rate is kept as its own lot</p></div></div>
 <div class="bento">${[['Lots in stock','📦',live.length],['Products in stock','🧰',new Set(live.map(r=>r.product_id)).size],['Locations','🏬',new Set(live.map(r=>r.store_id||r.department_id)).size],['Stock value (₹)','💰',Math.round(value)]].map((x,i)=>`<div class="bx stat" style="animation-delay:${i*70}ms"><div class="ic">${x[1]}</div><b data-count="${x[2]}">0</b><span class="mut">${x[0]}</span></div>`).join('')}</div>
 <div id="dt" class="panel"></div>`;
 countUp();
 dataTable($('#dt'),{id:'stock',rows,sort:'code',f:{state:'In stock'},cols:[
  {key:'loc',label:'Location',filter:1},{key:'code',label:'Code'},{key:'name',label:'Product'},
  {key:'rate_purchase',label:'Rate (₹ / purchase unit)',val:r=>+r.rate_purchase,render:r=>money(r.rate_purchase)},
  {key:'pu',label:'Balance (purchase unit)',val:r=>Math.round(r.pu*1000)/1000,render:r=>`${fmtq(r.pu)} ${esc(r.pc)}`},
  {key:'qty_base',label:'Balance (base unit)',val:r=>+r.qty_base,render:r=>`${fmtq(r.qty_base)} ${esc(r.bu)}`},
  {key:'val',label:'Value (₹)',val:r=>Math.round(r.val*100)/100,render:r=>money(r.val)},
  {key:'lot_ref',label:'Source'},{key:'received_at',label:'Received',val:r=>(r.received_at||'').slice(0,10)},
  {key:'state',label:'State',filter:1}]})
}
App.register({id:'stock',icon:'🗃️',label:'Stock',group:'Stores',order:32,page:'stock',render:pgStock,tables:['stock_lots']});
