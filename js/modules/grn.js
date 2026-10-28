/* MODULE: GRN - Goods Receipt Note (receives against a finalized PO and loads rate-wise stock) */
const GRS={draft:'Draft',submitted:'Posted - awaiting signed copy',signed:'Signed',cancelled:'Cancelled'};
async function myStoreIds(){const r=await sb.from('user_stores').select('store_id').eq('user_id',me.id);return new Set((r.data||[]).map(x=>x.store_id))}

async function pgGRN(){
 const[h,v,stn,po,sc]=await Promise.all([sb.from('grn_headers').select('*').order('created_at',{ascending:false}).limit(300),sb.from('vendors').select('id,name'),sb.from('stores').select('id,name'),sb.from('po_headers').select('id,po_no'),myScope()]);
 if(h.error)throw h.error;
 const V=idMap(v.data),ST=idMap(stn.data),PO=idMap(po.data,'po_no'),CO=idMap(sc.allC,'code');
 const cnt=s=>h.data.filter(r=>r.status===s).length;
 $('#view').innerHTML=`<div class="top"><div><h2>Goods Receipt (GRN)</h2><p class="mut">${h.data.length} receipts</p></div>${can('grn','add')?'<button class="btn" onclick="grnForm()">＋ New GRN</button>':''}</div>
 <div class="bento">${[['Draft','📝',cnt('draft')],['Posted - awaiting signed copy','⏳',cnt('submitted')],['Signed','✅',cnt('signed')],['Total','📦',h.data.length]].map((x,i)=>`<div class="bx stat" style="animation-delay:${i*70}ms"><div class="ic">${x[1]}</div><b data-count="${x[2]}">0</b><span class="mut">${x[0]}</span></div>`).join('')}</div>
 <div id="dt" class="panel"></div>`;
 countUp();
 dataTable($('#dt'),{id:'grn',rows:h.data,sort:'created_at',dir:-1,cols:[
  {key:'grn_no',label:'GRN No',val:r=>r.grn_no||'Draft'},{key:'company',label:'Company',filter:1,val:r=>CO[r.company_id]},
  {key:'store',label:'Store',filter:1,val:r=>ST[r.store_id]},{key:'po',label:'PO No',val:r=>PO[r.po_id]||''},
  {key:'vendor',label:'Vendor',filter:1,val:r=>V[r.vendor_id]},{key:'received_date',label:'Received on'},{key:'vendor_dc_no',label:'Vendor DC / invoice'},
  {key:'status',label:'Status',filter:1,val:r=>GRS[r.status]||r.status,render:r=>`<span class="pill ${r.status==='draft'?'warn':''}">${esc(GRS[r.status]||r.status)}</span>`},
  {key:'act',label:'',sort:false,render:r=>`<button class="btn ghost sm" onclick="grnForm('${r.id}')">${r.status==='draft'&&r.received_by===me.id?'Edit':'Open'}</button>`}]})
}

async function grnForm(id){
 const[sc,stn,vn,pdq,mine,m,pe]=await Promise.all([myScope(),sb.from('stores').select('id,code,name'),sb.from('vendors').select('id,name'),sb.from('products').select('id,item_code,item_name,item_type,purchase_uom_id,base_uom_id,uoq').eq('active',true).order('item_code').limit(2000),myStoreIds(),masters(),people()]);
 const U=idMap(m.uoms,'code'),PD=pdq.data||[],byCode=Object.fromEntries(PD.map(p=>[p.item_code,p])),byId=Object.fromEntries(PD.map(p=>[p.id,p]));
 let h={status:'draft',version:1,received_date:new Date().toISOString().slice(0,10)},GL=[],S=[],po=null,elig=[];
 if(id){const[a,b,c]=await Promise.all([sb.from('grn_headers').select('*').eq('id',id).single(),sb.from('grn_lines').select('*').eq('grn_id',id).order('line_no'),sb.from('grn_signers').select('*').eq('grn_id',id).order('sort_order')]);
  if(a.error)return toast(a.error.message,1);h=a.data;GL=b.data||[];S=c.data||[];
  po=(await sb.from('po_headers').select('*').eq('id',h.po_id).single()).data}
 const ro=h.status!=='draft'||(h.received_by&&h.received_by!==me.id)||!can('grn','add');
 if(!ro&&!id){const r=await sb.from('po_headers').select('id,po_no,vendor_id,assigned_store_id,company_id').eq('status','finalized').order('po_no');
  elig=(r.data||[]).filter(x=>mine.has(x.assigned_store_id));
  if(!elig.length)return toast('No finalized PO is assigned to your store yet. Purchase must finalize a PO to your store, and Super Admin must assign you the store.',1)}
 const ST=idMap(stn.data),VN=idMap(vn.data),P=Object.fromEntries(pe.map(x=>[x.id,x])),others=pe.filter(x=>x.id!==me.id),dis=ro?'disabled':'';
 const ver=(S.find(x=>x.role_label==='Verified by')||{}).user_id,apr=new Set(S.filter(x=>x.role_label==='Approved by').map(x=>x.user_id));
 const opt=(rows,sel,lab)=>rows.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(lab(x))}</option>`).join('');
 const who=s=>{const p=P[s.user_id]||{};return `${esc(s.role_label)}: <b>${esc(s.name_snap||p.full_name)}</b>${(s.designation_snap||p.designation)?', '+esc(s.designation_snap||p.designation):''}`};
 let ROWS=[];
 async function rowsFor(poId){
  const l=await sb.from('po_lines').select('*').eq('po_id',poId).order('line_no');if(l.error){toast(l.error.message,1);return[]}
  const ids=l.data.map(x=>x.id),rv=ids.length?await sb.from('po_line_received').select('*').in('po_line_id',ids):{data:[]};
  const got=Object.fromEntries((rv.data||[]).map(x=>[x.po_line_id,+x.accepted_qty]));
  return l.data.map(pl=>{const gl=GL.find(x=>x.po_line_id===pl.id),prev=got[pl.id]||0;return{pl,gl,prev,pending:+pl.qty-prev}}).filter(r=>ro?r.gl:(r.gl||r.pending>0))
 }
 const grow=(r,i)=>{const pd=byId[(r.gl&&r.gl.product_id)||r.pl.product_id]||{};
  return `<tr data-pl="${r.pl.id}" data-pend="${r.pending}"><td>${i+1}</td><td style="min-width:170px">${esc(r.pl.description)}<div class="mut">PO rate ₹${money(r.pl.rate)}</div></td>
  <td><input data-f="p" list="gdl" ${dis} value="${esc(pd.item_code||'')}" style="min-width:110px"></td><td class="un"></td><td>${fmtq(r.pl.qty)}</td><td>${ro?'—':fmtq(r.pending)}</td>
  <td><input data-f="rc" type="number" step="0.001" min="0" ${dis} value="${r.gl?r.gl.received_qty:''}" style="width:85px"></td>
  <td><input data-f="rj" type="number" step="0.001" min="0" ${dis} value="${r.gl?r.gl.rejected_qty:0}" style="width:85px"></td>
  <td><input data-f="rs" ${dis} value="${esc(r.gl&&r.gl.reject_reason)}" placeholder="if rejected" style="min-width:120px"></td><td class="ac"></td><td class="bq mut"></td></tr>`};
 const calc=()=>{const tb=$('#gtb');if(!tb)return;[...tb.rows].forEach(tr=>{const g=k=>tr.querySelector(`[data-f=${k}]`),pd=byCode[g('p').value.trim()],rc=+g('rc').value||0,rj=+g('rj').value||0,ac=Math.max(0,rc-rj);
  tr.querySelector('.un').textContent=pd?(U[pd.purchase_uom_id]||''):'';
  tr.querySelector('.ac').innerHTML=`<b style="color:${ac>+tr.dataset.pend+1e-9?'var(--bad)':'inherit'}">${fmtq(ac)}</b>`;
  tr.querySelector('.bq').textContent=pd?`${fmtq(ac*pd.uoq)} ${U[pd.base_uom_id]||''}`:''})};
 async function draw(poId){
  ROWS=poId?await rowsFor(poId):[];
  $('#glines').innerHTML=poId?`<div class="tw"><table><thead><tr><th>#</th><th>PO item</th><th>Product code</th><th>Unit</th><th>Ordered</th><th>Pending</th><th>Received</th><th>Rejected</th><th>Reject reason</th><th>Accepted</th><th>In base units</th></tr></thead><tbody id="gtb">${ROWS.map(grow).join('')||'<tr><td colspan="11" class="mut">Nothing pending on this PO</td></tr>'}</tbody></table></div>`:'<p class="mut">Choose a PO to see its items.</p>';
  calc()
 }
 const poLabel=x=>`${x.po_no} · ${VN[x.vendor_id]||''} · ${ST[x.assigned_store_id]||''}`;
 modal(`<h2 style="margin-bottom:6px">${h.grn_no?esc(h.grn_no):(id?'Edit GRN (draft)':'New GRN')} ${h.status!=='draft'?`<span class="pill">${esc(GRS[h.status])}</span>`:''}</h2><form id="gf">
 <datalist id="gdl">${PD.map(p=>`<option value="${esc(p.item_code)}">${esc(p.item_name)}</option>`).join('')}</datalist>
 <div class="cols"><div><label>Purchase order</label>${id?`<input disabled value="${esc(po?po.po_no:'')} · ${esc(VN[h.vendor_id]||'')}">`:`<select id="gpo" required><option value="">Choose a finalized PO…</option>${elig.map(x=>`<option value="${x.id}">${esc(poLabel(x))}</option>`).join('')}</select>`}</div>
 <div><label>Received on</label><input type="date" name="received_date" required value="${h.received_date||''}" ${dis}></div>
 <div><label>Vendor DC / invoice no</label><input name="vendor_dc_no" value="${esc(h.vendor_dc_no)}" ${dis}></div><div><label>Remarks</label><input name="remarks" value="${esc(h.remarks)}" ${dis}></div></div>
 <label>Items received (quantities in the product's purchase unit; the rate comes from the PO)</label><div id="glines"></div>
 <label>Signatories printed on the GRN</label>
 ${ro&&S.length?`<div class="panel" style="margin:0;line-height:1.9">${S.map(who).join('<br>')}</div>`:`<div class="cols"><div><label>Verified by (Store In-charge)</label><select name="ver" ${dis}><option value="">—</option>${opt(others,ver,x=>x.full_name+(x.designation?' · '+x.designation:''))}</select></div></div>
 <label>Approvers (signatures required)</label><div class="chk">${others.map(x=>`<label><input type="checkbox" name="apr" value="${x.id}" ${apr.has(x.id)?'checked':''} ${dis}>${esc(x.full_name)}${x.designation?' · '+esc(x.designation):''}</label>`).join('')}</div>`}
 ${ro&&h.status!=='draft'?'<p class="mut" style="margin-top:12px">🔒 Posted and frozen. Stock has been loaded.</p><div id="docs"></div>':''}
 <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap"><button type="button" class="btn ghost" onclick="closeModal()">Close</button>
 ${ro?'':'<button type="button" class="btn ghost" id="sd">Save draft</button><button type="button" class="btn" id="sf">Post GRN and load stock</button>'}</div></form>`);
 const f=$('#gf');
 await draw(id?h.po_id:'');
 if(ro){
  if(h.status!=='draft'){
   const canUp=h.received_by===me.id||isAdm(),co=sc.allC.find(x=>x.id===h.company_id)||{};
   const makePdf=()=>buildPdf({company:co.name,title:'GOODS RECEIPT NOTE',docNo:h.grn_no,
    meta:[['GRN No',h.grn_no],['Received on',h.received_date],['PO No',po&&po.po_no],['Vendor',VN[h.vendor_id]],['Store',ST[h.store_id]],['Vendor DC / invoice',h.vendor_dc_no],['Received by',(P[h.received_by]||{}).full_name],['Remarks',h.remarks]],
    cols:['#','PO item','Product','Unit','Received','Rejected','Accepted','Rate (Rs.)','Amount (Rs.)'],
    rows:ROWS.map((r,i)=>{const g=r.gl,pd=byId[g.product_id]||{};return[i+1,r.pl.description,pd.item_code||'',U[pd.purchase_uom_id]||'',fmtq(g.received_qty),fmtq(g.rejected_qty)+(g.reject_reason?' ('+g.reject_reason+')':''),fmtq(g.accepted_qty),money(g.rate),money(+g.accepted_qty*(+g.rate||0))]}),
    signers:S.map(s=>({label:s.role_label,name:s.name_snap,designation:s.designation_snap}))});
   docPanel($('#docs'),{type:'grn',id:h.id,docNo:h.grn_no,canUpload:canUp,makePdf,afterUpload:()=>go('grn',true)})
  }
  return}
 if(id){po=po||{}}
 let cur=null;
 if(!id)$('#gpo').onchange=async e=>{cur=elig.find(x=>x.id===e.target.value)||null;await draw(e.target.value)};
 $('#gtb')&&0;
 f.oninput=calc;f.onchange=calc;
 async function save(post){
  if(!f.reportValidity())return;
  const poId=id?h.po_id:$('#gpo').value;if(!poId)return toast('Choose a PO first',1);
  const tb=$('#gtb');if(!tb)return;
  const ls=[...tb.rows].filter(tr=>tr.dataset.pl).map(tr=>{const g=k=>tr.querySelector(`[data-f=${k}]`),code=g('p').value.trim();
   return{po_line_id:tr.dataset.pl,pend:+tr.dataset.pend,code,product_id:code?((byCode[code]||{}).id||'?'):null,received_qty:+g('rc').value||0,rejected_qty:+g('rj').value||0,reject_reason:g('rs').value.trim()||null}}).filter(l=>l.received_qty>0);
  if(!ls.length)return toast('Enter a received quantity for at least one item',1);
  let bad=ls.find(l=>l.product_id==='?');if(bad)return toast('Unknown product code: '+bad.code,1);
  bad=ls.find(l=>l.rejected_qty>l.received_qty);if(bad)return toast('Rejected quantity cannot be more than received',1);
  bad=ls.find(l=>l.rejected_qty>0&&!l.reject_reason);if(bad)return toast('Give a reason for the rejected items',1);
  bad=ls.find(l=>l.received_qty-l.rejected_qty>l.pend+1e-9);if(bad)return toast('Accepted quantity is more than the pending PO quantity',1);
  if(post){if(ls.some(l=>!l.product_id))return toast('Select the Product Master item for every received line',1);if(!f.ver.value)return toast('Select who verifies this GRN',1);
   if(!confirm('Post this GRN? Stock will be loaded and the GRN will be frozen.'))return}
  $('#sd').disabled=$('#sf').disabled=true;
  try{
   const base={received_date:f.received_date.value,vendor_dc_no:f.vendor_dc_no.value.trim()||null,remarks:f.remarks.value.trim()||null};let gid=id;
   if(id){const r=await sb.from('grn_headers').update(base).eq('id',id).eq('version',h.version).select('id');if(r.error)throw r.error;
    if(!r.data.length){toast('This GRN was changed elsewhere. Showing the latest version.',1);closeModal();return grnForm(id)}}
   else{const r=await sb.from('grn_headers').insert({...base,company_id:cur.company_id,po_id:cur.id,store_id:cur.assigned_store_id,vendor_id:cur.vendor_id}).select('id').single();if(r.error)throw r.error;gid=r.data.id}
   let x=await sb.from('grn_lines').delete().eq('grn_id',gid);if(x.error)throw x.error;
   x=await sb.from('grn_signers').delete().eq('grn_id',gid);if(x.error)throw x.error;
   x=await sb.from('grn_lines').insert(ls.map((l,i)=>({grn_id:gid,line_no:i+1,po_line_id:l.po_line_id,product_id:l.product_id,received_qty:l.received_qty,rejected_qty:l.rejected_qty,reject_reason:l.reject_reason})));if(x.error)throw x.error;
   const sg=[];if(f.ver.value)sg.push({grn_id:gid,user_id:f.ver.value,role_label:'Verified by',sort_order:1});
   [...f.querySelectorAll('[name=apr]:checked')].forEach((c,i)=>{if(c.value!==f.ver.value)sg.push({grn_id:gid,user_id:c.value,role_label:'Approved by',sort_order:2+i})});
   if(sg.length){x=await sb.from('grn_signers').insert(sg);if(x.error)throw x.error}
   if(post){const r=await sb.rpc('submit_grn',{p_id:gid});if(r.error)throw r.error;toast('Posted as '+r.data+' - stock loaded')}else toast('Draft saved');
   closeModal();go('grn')
  }catch(er){toast(er.message,1);$('#sd').disabled=$('#sf').disabled=false}
 }
 $('#sd').onclick=()=>save(false);$('#sf').onclick=()=>save(true);
}
App.register({id:'grn',icon:'📥',label:'Goods Receipt (GRN)',group:'Stores',order:30,page:'grn',render:pgGRN,tables:['grn_headers','po_headers']});
