/* MODULE: Purchase Order (PO) */
const POS={draft:'Draft',submitted:'Awaiting signed copy',signed:'Signed - ready to finalize',finalized:'Finalized',cancelled:'Cancelled'};
const money=n=>(+n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const lineAmt=l=>(+l.qty||0)*(+l.rate||0)*(1+(+l.tax_pct||0)/100);

async function pgPO(){
 const[h,ln,v,pe,sc]=await Promise.all([sb.from('po_headers').select('*').order('created_at',{ascending:false}).limit(300),sb.from('po_lines').select('po_id,qty,rate,tax_pct').limit(10000),sb.from('vendors').select('id,name'),people(),myScope()]);
 if(h.error)throw h.error;
 const P=Object.fromEntries(pe.map(x=>[x.id,x.full_name])),V=Object.fromEntries((v.data||[]).map(x=>[x.id,x.name])),CO=Object.fromEntries(sc.allC.map(x=>[x.id,x.code]));
 const T={};(ln.data||[]).forEach(l=>{T[l.po_id]=(T[l.po_id]||0)+lineAmt(l)});
 const cnt=s=>h.data.filter(r=>r.status===s).length;
 $('#view').innerHTML=`<div class="top"><div><h2>Purchase Orders</h2><p class="mut">${h.data.length} purchase orders</p></div>${can('po','add')?'<button class="btn" onclick="poForm()">＋ New PO</button>':''}</div>
 <div class="bento">${[['Draft','📝',cnt('draft')],['Awaiting signed copy','⏳',cnt('submitted')],['Signed - to finalize','✍️',cnt('signed')],['Finalized','🏬',cnt('finalized')]].map((x,i)=>`<div class="bx stat" style="animation-delay:${i*70}ms"><div class="ic">${x[1]}</div><b data-count="${x[2]}">0</b><span class="mut">${x[0]}</span></div>`).join('')}</div>
 <div id="dt" class="panel"></div>`;
 countUp();
 dataTable($('#dt'),{id:'po',rows:h.data,sort:'created_at',dir:-1,cols:[
  {key:'po_no',label:'PO No',val:r=>r.po_no||'Draft'},{key:'company',label:'Company',filter:1,val:r=>CO[r.company_id]},
  {key:'vendor',label:'Vendor',filter:1,val:r=>V[r.vendor_id]},{key:'by',label:'Raised by',filter:1,val:r=>P[r.raised_by]},
  {key:'order_date',label:'Order date'},{key:'delivery_date',label:'Delivery by'},
  {key:'amt',label:'Amount (₹)',val:r=>Math.round((T[r.id]||0)*100)/100,render:r=>money(T[r.id])},
  {key:'status',label:'Status',filter:1,val:r=>POS[r.status]||r.status,render:r=>`<span class="pill ${r.status==='draft'?'warn':''}">${esc(POS[r.status]||r.status)}</span>`},
  {key:'act',label:'',sort:false,render:r=>`<button class="btn ghost sm" onclick="poForm('${r.id}')">${r.status==='draft'&&r.raised_by===me.id?'Edit':'Open'}</button>`}]})
}

async function poForm(id){
 const[pe,sc,vn,pd,stn,sp]=await Promise.all([people(),myScope(),sb.from('vendors').select('id,code,name,tax_no').eq('active',true).order('name'),sb.from('products').select('id,item_code,item_name').eq('active',true).order('item_code').limit(2000),sb.from('stores').select('id,code,name').eq('active',true).order('name'),sb.from('pr_headers').select('id,pr_no,department_id').eq('status','signed').order('pr_no')]);
 let h={status:'draft',version:1,order_date:new Date().toISOString().slice(0,10)},L=[],S=[];
 if(id){const[a,b,c]=await Promise.all([sb.from('po_headers').select('*').eq('id',id).single(),sb.from('po_lines').select('*').eq('po_id',id).order('line_no'),sb.from('po_signers').select('*').eq('po_id',id).order('sort_order')]);
  if(a.error)return toast(a.error.message,1);h=a.data;L=b.data||[];S=c.data||[]}
 const ro=h.status!=='draft'||(h.raised_by&&h.raised_by!==me.id)||!can('po','add');
 const canUp=h.raised_by===me.id||isAdm();
 if(!ro&&!sc.c.length)return toast('Ask Super Admin to assign your company first',1);
 if(!ro&&!vn.data.length)return toast('Add a vendor first (Masters → Vendors)',1);
 if(!L.length)L=[{tax_pct:0}];
 const pc=Object.fromEntries((pd.data||[]).map(p=>[p.id,p.item_code])),byCode=Object.fromEntries((pd.data||[]).map(p=>[p.item_code,p.id]));
 const others=pe.filter(x=>x.id!==me.id),P=Object.fromEntries(pe.map(x=>[x.id,x])),dis=ro?'disabled':'';
 const ver=(S.find(x=>x.role_label==='Verified by')||{}).user_id,apr=new Set(S.filter(x=>x.role_label==='Approved by').map(x=>x.user_id));
 const opt=(rows,sel,lab)=>rows.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(lab(x))}</option>`).join('');
 const row=(l,i)=>`<tr data-pr="${l.pr_id||''}" data-prl="${l.pr_line_id||''}"><td>${i+1}</td>
  <td><input data-f="d" ${dis} value="${esc(l.description)}" placeholder="Item description" style="min-width:180px"></td>
  <td><input data-f="p" list="pdl" ${dis} value="${esc(pc[l.product_id]||'')}" placeholder="optional" style="min-width:120px"></td>
  <td><input data-f="q" ${dis} type="number" step="0.001" min="0" value="${l.qty??''}" style="width:80px"></td>
  <td><input data-f="u" ${dis} value="${esc(l.unit)}" style="width:70px"></td>
  <td><input data-f="r" ${dis} type="number" step="0.01" min="0" value="${l.rate??''}" style="width:90px"></td>
  <td><input data-f="t" ${dis} type="number" step="0.01" min="0" value="${l.tax_pct??0}" style="width:70px"></td>
  <td class="amt">${money(lineAmt(l))}</td><td>${ro?'':'<button type="button" class="btn ghost sm" data-rm="1">✕</button>'}</td></tr>`;
 const who=s=>{const p=P[s.user_id]||{};return `${esc(s.role_label)}: <b>${esc(s.name_snap||p.full_name)}</b>${(s.designation_snap||p.designation)?', '+esc(s.designation_snap||p.designation):''}`};
 const storeName=(stn.data.find(x=>x.id===h.assigned_store_id)||{}).name;
 modal(`<h2 style="margin-bottom:6px">${h.po_no?esc(h.po_no):(id?'Edit PO (draft)':'New PO')} ${h.status!=='draft'?`<span class="pill">${esc(POS[h.status])}</span>`:''}</h2><form id="pof">
 <datalist id="pdl">${(pd.data||[]).map(p=>`<option value="${esc(p.item_code)}">${esc(p.item_name)}</option>`).join('')}</datalist>
 <div class="cols"><div><label>Company</label><select name="company_id" required ${dis}>${opt(ro?sc.allC:sc.c,h.company_id,x=>x.code+' - '+x.name)}</select></div>
 <div><label>Vendor</label><select name="vendor_id" required ${dis}>${opt(vn.data,h.vendor_id,x=>x.code+' - '+x.name)}</select></div>
 <div><label>Order date</label><input type="date" name="order_date" required value="${h.order_date||''}" ${dis}></div>
 <div><label>Delivery by</label><input type="date" name="delivery_date" value="${h.delivery_date||''}" ${dis}></div>
 <div><label>Payment terms</label><input name="payment_terms" value="${esc(h.payment_terms)}" ${dis}></div>
 <div><label>Remarks / terms</label><input name="remarks" value="${esc(h.remarks)}" ${dis}></div></div>
 ${ro?'':`<label>Import items from a signed PR</label><select id="imp"><option value="">＋ Choose a signed PR…</option>${(sp.data||[]).map(x=>`<option value="${x.id}">${esc(x.pr_no)}</option>`).join('')}</select>`}
 <label>Items</label><div class="tw"><table><thead><tr><th>#</th><th>Description</th><th>Product code</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Tax %</th><th>Amount</th><th></th></tr></thead><tbody id="pol">${L.map(row).join('')}</tbody></table></div>
 ${ro?'':'<button type="button" class="btn ghost sm" id="addl" style="margin-top:8px">＋ Add item</button>'}
 <div class="panel" style="margin:12px 0 0;text-align:right;line-height:1.9" id="tot"></div>
 <label>Signatories printed on the PO</label>
 ${ro&&S.length?`<div class="panel" style="margin:0;line-height:1.9">${S.map(who).join('<br>')}</div>`:`<div class="cols"><div><label>Verified by (Purchase Manager)</label><select name="ver" ${dis}><option value="">—</option>${opt(others,ver,x=>x.full_name+(x.designation?' · '+x.designation:''))}</select></div></div>
 <label>Approvers (signatures required)</label><div class="chk">${others.map(x=>`<label><input type="checkbox" name="apr" value="${x.id}" ${apr.has(x.id)?'checked':''} ${dis}>${esc(x.full_name)}${x.designation?' · '+esc(x.designation):''}</label>`).join('')}</div>`}
 ${ro&&h.status!=='draft'?'<p class="mut" style="margin-top:12px">🔒 Submitted and frozen.</p><div id="docs"></div>':''}
 ${ro&&h.status==='signed'&&canUp?`<div class="panel" style="margin:12px 0 0"><label style="margin-top:0">Finalize and assign to a store team</label><div class="row"><div><select id="fst">${opt(stn.data,null,x=>x.code+' - '+x.name)}</select></div><div style="flex:0"><button type="button" class="btn" id="fbtn">Finalize and assign</button></div></div></div>`:''}
 ${h.status==='finalized'?`<p style="margin-top:12px">🏬 Finalized and assigned to store: <b>${esc(storeName||'')}</b></p>`:''}
 <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap"><button type="button" class="btn ghost" onclick="closeModal()">Close</button>
 ${ro?'':'<button type="button" class="btn ghost" id="sd">Save draft</button><button type="button" class="btn" id="sf">Submit and freeze</button>'}</div></form>`);
 const f=$('#pof'),tb=$('#pol');
 const num=(tr,k)=>+tr.querySelector(`[data-f=${k}]`).value||0;
 const calc=()=>{let sub=0,tax=0;[...tb.rows].forEach(tr=>{const a=num(tr,'q')*num(tr,'r'),t=a*num(tr,'t')/100;sub+=a;tax+=t;tr.querySelector('.amt').textContent=money(a+t)});
  $('#tot').innerHTML=`Subtotal: <b>₹ ${money(sub)}</b><br>Tax: <b>₹ ${money(tax)}</b><br><span style="font-size:18px">Total: <b>₹ ${money(sub+tax)}</b></span>`};
 calc();
 if(ro){
  if(h.status!=='draft'){
   const vd=vn.data.find(x=>x.id===h.vendor_id)||{},co=sc.allC.find(x=>x.id===h.company_id)||{};
   const sub=L.reduce((a,l)=>a+(+l.qty)*(+l.rate),0),tot=L.reduce((a,l)=>a+lineAmt(l),0);
   const makePdf=()=>buildPdf({company:co.name,title:'PURCHASE ORDER',docNo:h.po_no,
    meta:[['PO No',h.po_no],['Date',h.order_date],['Vendor',vd.name],['Vendor tax no',vd.tax_no],['Delivery by',h.delivery_date],['Payment terms',h.payment_terms],['Raised by',(P[h.raised_by]||{}).full_name],['Remarks',h.remarks]],
    cols:['#','Description','Qty','Unit','Rate (Rs.)','Tax %','Amount (Rs.)'],
    rows:L.map((l,i)=>[i+1,l.description,+l.qty,l.unit||'',money(l.rate),(+l.tax_pct||0)+'%',money(lineAmt(l))]).concat([['','','','','','Subtotal',money(sub)],['','','','','','Tax',money(tot-sub)],['','','','','','TOTAL',money(tot)]]),
    signers:S.map(s=>({label:s.role_label,name:s.name_snap,designation:s.designation_snap}))});
   docPanel($('#docs'),{type:'po',id:h.id,docNo:h.po_no,canUpload:canUp,makePdf,afterUpload:()=>{go('po',true);poForm(h.id)}});
   const fb=$('#fbtn');
   if(fb)fb.onclick=async()=>{if(!confirm('Finalize this PO and assign it to the selected store?'))return;fb.disabled=true;
    const r=await sb.rpc('finalize_po',{p_id:h.id,p_store:$('#fst').value});
    if(r.error){toast(r.error.message,1);fb.disabled=false;return}
    toast('PO finalized and assigned');closeModal();go('po',true)}
  }
  return}
 const renum=()=>[...tb.rows].forEach((r,i)=>r.cells[0].textContent=i+1);
 tb.oninput=calc;
 tb.onclick=e=>{if(e.target.dataset.rm&&tb.rows.length>1){e.target.closest('tr').remove();renum();calc()}};
 $('#addl').onclick=()=>tb.insertAdjacentHTML('beforeend',row({tax_pct:0},tb.rows.length));
 $('#imp').onchange=async e=>{const pid=e.target.value;if(!pid)return;
  const r=await sb.from('pr_lines').select('*').eq('pr_id',pid).order('line_no');if(r.error)return toast(r.error.message,1);
  const first=tb.rows[0];if(tb.rows.length===1&&!first.querySelector('[data-f=d]').value.trim())first.remove();
  r.data.forEach(l=>tb.insertAdjacentHTML('beforeend',row({description:l.description,qty:l.qty,unit:l.unit,tax_pct:0,pr_id:pid,pr_line_id:l.id},tb.rows.length)));
  renum();calc();e.target.value='';toast(r.data.length+' items imported - now enter the rates')};
 const lines=()=>[...tb.rows].map(tr=>{const code=tr.querySelector('[data-f=p]').value.trim();return{description:tr.querySelector('[data-f=d]').value.trim(),code,product_id:code?(byCode[code]||'?'):null,pr_id:tr.dataset.pr||null,pr_line_id:tr.dataset.prl||null,qty:num(tr,'q'),unit:tr.querySelector('[data-f=u]').value.trim()||null,rate:num(tr,'r'),tax_pct:num(tr,'t')}}).filter(x=>x.description);
 async function save(submit){
  if(!f.reportValidity())return;
  const ls=lines();if(!ls.length||ls.some(l=>!(l.qty>0)))return toast('Add at least one item, each with a quantity above 0',1);
  const bad=ls.find(l=>l.product_id==='?');if(bad)return toast('Unknown product code: '+bad.code+' (leave it empty or pick from the list)',1);
  if(submit){if(ls.some(l=>!(l.rate>0)))return toast('Every item needs a rate above 0 before submitting',1);if(!f.ver.value)return toast('Select who verifies this PO',1);
   if(!confirm('Submit and freeze this PO? It cannot be edited afterwards.'))return}
  $('#sd').disabled=$('#sf').disabled=true;
  try{
   const o={company_id:f.company_id.value,vendor_id:f.vendor_id.value,order_date:f.order_date.value,delivery_date:f.delivery_date.value||null,payment_terms:f.payment_terms.value.trim()||null,remarks:f.remarks.value.trim()||null};let pid=id;
   if(id){const r=await sb.from('po_headers').update(o).eq('id',id).eq('version',h.version).select('id');if(r.error)throw r.error;
    if(!r.data.length){toast('This PO was changed elsewhere. Showing the latest version.',1);closeModal();return poForm(id)}}
   else{const r=await sb.from('po_headers').insert(o).select('id').single();if(r.error)throw r.error;pid=r.data.id}
   let x=await sb.from('po_lines').delete().eq('po_id',pid);if(x.error)throw x.error;
   x=await sb.from('po_signers').delete().eq('po_id',pid);if(x.error)throw x.error;
   x=await sb.from('po_lines').insert(ls.map((l,i)=>({po_id:pid,line_no:i+1,description:l.description,product_id:l.product_id,pr_id:l.pr_id,pr_line_id:l.pr_line_id,qty:l.qty,unit:l.unit,rate:l.rate,tax_pct:l.tax_pct})));if(x.error)throw x.error;
   const sg=[];if(f.ver.value)sg.push({po_id:pid,user_id:f.ver.value,role_label:'Verified by',sort_order:1});
   [...f.querySelectorAll('[name=apr]:checked')].forEach((c,i)=>{if(c.value!==f.ver.value)sg.push({po_id:pid,user_id:c.value,role_label:'Approved by',sort_order:2+i})});
   if(sg.length){x=await sb.from('po_signers').insert(sg);if(x.error)throw x.error}
   if(submit){const r=await sb.rpc('submit_po',{p_id:pid});if(r.error)throw r.error;toast('Submitted as '+r.data)}else toast('Draft saved');
   closeModal();go('po')
  }catch(er){toast(er.message,1);$('#sd').disabled=$('#sf').disabled=false}
 }
 $('#sd').onclick=()=>save(false);$('#sf').onclick=()=>save(true);
}
App.register({id:'po',icon:'🧾',label:'Purchase Orders',group:'Purchase',order:21,page:'po',render:pgPO,tables:['po_headers','po_lines']});
