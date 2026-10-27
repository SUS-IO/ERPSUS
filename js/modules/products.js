/* MODULE: Product Master */
async function masters(force){
 if(!force&&M.uoms)return M;
 const[u,c]=await Promise.all([sb.from('uoms').select('*').eq('active',true).order('code'),sb.from('categories').select('*').eq('active',true).order('name')]);
 M.uoms=u.data||[];M.cats=c.data||[];return M
}
const imgUrl=p=>`${SB_URL}/storage/v1/object/public/product-images/${p}`;
async function pgProducts(){
 const[m,pr,im,ca,ce]=await Promise.all([masters(),sb.from('products').select('*').order('item_code').limit(1000),sb.from('product_images').select('product_id,slot,storage_path').order('slot'),sb.rpc('has_perm',{p_page:'product_master',p_action:'add'}),sb.rpc('has_perm',{p_page:'product_master',p_action:'edit'})]);
 if(pr.error)throw pr.error;
 const th={};(im.data||[]).forEach(i=>{if(!th[i.product_id])th[i.product_id]=i.storage_path});
 const U=Object.fromEntries(m.uoms.map(x=>[x.id,x.code])),C=Object.fromEntries(m.cats.map(x=>[x.id,x.name]));
 const row=(p,i)=>`<tr style="animation-delay:${Math.min(i,15)*30}ms"><td>${th[p.id]?`<img class="av" src="${imgUrl(th[p.id])}" alt="">`:'<div class="av">📦</div>'}</td><td>${esc(p.item_code)}</td><td>${esc(p.item_name)}</td><td>${esc(p.item_type)}</td><td>${esc(p.brand)}</td><td>${U[p.purchase_uom_id]||'?'} → ${U[p.base_uom_id]||'?'} ×${+p.uoq}</td><td>${[p.l1_category_id,p.l2_category_id,p.l3_category_id].filter(Boolean).map(x=>esc(C[x])).join(' › ')}</td><td><span class="pill ${p.active?'':'off'}">${p.active?'Active':'Inactive'}</span></td>${ce.data?`<td><button class="btn ghost sm" onclick="productForm('${p.id}')">Edit</button></td>`:''}</tr>`;
 $('#view').innerHTML=`<div class="top"><h2>Product Master</h2>${ca.data?'<button class="btn" onclick="productForm()">＋ Add product</button>':''}</div>
 <input id="pq" placeholder="🔍 Search code, name, brand or part no." style="margin-bottom:14px;max-width:420px">
 <div class="panel tw"><table><thead><tr><th></th><th>Code</th><th>Name</th><th>Type</th><th>Brand</th><th>Units</th><th>Category</th><th>Status</th>${ce.data?'<th></th>':''}</tr></thead><tbody id="pbody">${pr.data.map(row).join('')}</tbody></table></div>
 <p class="mut">${pr.data.length} products</p>`;
 $('#pq').oninput=e=>{const t=e.target.value.toLowerCase();$('#pbody').innerHTML=pr.data.filter(p=>(p.item_code+' '+p.item_name+' '+(p.brand||'')+' '+(p.ref_part_no||'')).toLowerCase().includes(t)).map(row).join('')}
}
async function productForm(id){
 const m=await masters();
 let p={uoq:1,item_type:'product',allow_decimal:false,active:true,version:1},ims=[];
 if(id){const[a,b]=await Promise.all([sb.from('products').select('*').eq('id',id).single(),sb.from('product_images').select('*').eq('product_id',id)]);if(a.error)return toast(a.error.message,1);p=a.data;ims=b.data||[]}
 else{const{count}=await sb.from('products').select('*',{count:'exact',head:true});p.item_code='F'+String((count||0)+1).padStart(3,'0')}
 const S=[1,2,3,4,5,6].map(n=>({n,old:ims.find(i=>i.slot===n)||null,file:null,del:false}));
 const uo=sel=>m.uoms.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(x.code)} - ${esc(x.name)}</option>`).join('');
 const co=(l,par,sel)=>'<option value="">—</option>'+m.cats.filter(c=>c.level===l&&(l===1||c.parent_id===par)).map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join('');
 modal(`<h2 style="margin-bottom:6px">${id?'Edit':'Add'} product</h2><form id="pf2">
 <div class="cols"><div><label>Item code</label><input name="item_code" required value="${esc(p.item_code)}"></div>
 <div><label>Type</label><select name="item_type"><option value="product" ${p.item_type==='product'?'selected':''}>Product</option><option value="service" ${p.item_type==='service'?'selected':''}>Service</option></select></div>
 <div style="grid-column:1/-1"><label>Item name</label><input name="item_name" required value="${esc(p.item_name)}"></div>
 <div><label>Brand</label><input name="brand" value="${esc(p.brand)}"></div><div><label>Ref part no</label><input name="ref_part_no" value="${esc(p.ref_part_no)}"></div>
 <div><label>Purchase UOM (what you buy in)</label><select name="purchase_uom_id">${uo(p.purchase_uom_id)}</select></div>
 <div><label>Base UOM (stock is kept in this)</label><select name="base_uom_id">${uo(p.base_uom_id)}</select></div>
 <div><label>UOQ (base units in 1 purchase unit)</label><input name="uoq" type="number" step="0.001" min="0.001" required value="${+p.uoq}"></div>
 <div class="chk" style="align-self:end"><label><input type="checkbox" name="allow_decimal" ${p.allow_decimal?'checked':''}>Decimal consumption</label><label><input type="checkbox" name="active" ${p.active?'checked':''}>Active</label></div></div>
 <label>Category (L1 › L2 › L3)</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${[1,2,3].map(l=>`<div style="display:flex;gap:4px"><select name="l${l}"></select><button type="button" class="btn ghost sm" data-c="${l}">＋</button></div>`).join('')}</div>
 <label>Photos (up to 6, optional, compressed automatically)</label><div class="imgs" id="imgs"></div>
 <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px"><button type="button" class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" id="sbtn">Save product</button></div></form>`);
 const f=$('#pf2');
 f.l1.innerHTML=co(1,null,p.l1_category_id);f.l2.innerHTML=co(2,p.l1_category_id,p.l2_category_id);f.l3.innerHTML=co(3,p.l2_category_id,p.l3_category_id);
 f.l1.onchange=()=>{f.l2.innerHTML=co(2,f.l1.value);f.l3.innerHTML=co(3,'')};
 f.l2.onchange=()=>{f.l3.innerHTML=co(3,f.l2.value)};
 f.querySelectorAll('[data-c]').forEach(bt=>bt.onclick=async()=>{
  const l=+bt.dataset.c,par=l===1?null:f['l'+(l-1)].value;
  if(l>1&&!par)return toast('Choose the level '+(l-1)+' category first',1);
  const n=prompt('New level '+l+' category name:');if(!n||!n.trim())return;
  const r=await sb.from('categories').insert({parent_id:par,level:l,name:n.trim()}).select('id').single();
  if(r.error)return toast(r.error.message.includes('duplicate')?'Already exists':r.error.message,1);
  await masters(true);const k=[f.l1.value,f.l2.value,f.l3.value];
  f.l1.innerHTML=co(1,null,l===1?r.data.id:k[0]);f.l2.innerHTML=co(2,f.l1.value,l===2?r.data.id:k[1]);f.l3.innerHTML=co(3,f.l2.value,l===3?r.data.id:k[2])});
 const draw=()=>{$('#imgs').innerHTML=S.map(s=>{const src=s.file?URL.createObjectURL(s.file):(!s.del&&s.old?imgUrl(s.old.storage_path):'');return `<div class="slot" data-n="${s.n}">${src?`<img src="${src}" alt=""><span class="x" data-x="1">✕</span>`:'<b>＋</b>'}</div>`}).join('');
  document.querySelectorAll('#imgs .slot').forEach(el=>el.onclick=e=>{const s=S[+el.dataset.n-1];
   if(e.target.dataset.x){s.file=null;s.del=!!s.old;draw();return}
   const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=()=>{if(i.files[0]){s.file=i.files[0];s.del=false;draw()}};i.click()})};
 draw();
 f.onsubmit=async e=>{e.preventDefault();const b=$('#sbtn');b.disabled=true;
  const o={item_code:f.item_code.value.trim(),item_name:f.item_name.value.trim(),item_type:f.item_type.value,brand:f.brand.value.trim()||null,ref_part_no:f.ref_part_no.value.trim()||null,purchase_uom_id:f.purchase_uom_id.value,base_uom_id:f.base_uom_id.value,uoq:+f.uoq.value,allow_decimal:f.allow_decimal.checked,active:f.active.checked,l1_category_id:f.l1.value||null,l2_category_id:f.l2.value||null,l3_category_id:f.l3.value||null};
  try{let pid=id;
   if(id){const r=await sb.from('products').update(o).eq('id',id).eq('version',p.version).select('id');if(r.error)throw r.error;
    if(!r.data.length){toast('Someone else changed this product. Showing the latest version.',1);closeModal();return productForm(id)}}
   else{const r=await sb.from('products').insert(o).select('id').single();if(r.error)throw r.error;pid=r.data.id}
   for(const s of S){
    if((s.del||s.file)&&s.old){await sb.storage.from('product-images').remove([s.old.storage_path]);await sb.from('product_images').delete().eq('id',s.old.id)}
    if(s.file){const bl=await compress(s.file,1280,.72),path=`${pid}/${s.n}-${Date.now()}.jpg`;
     const u=await sb.storage.from('product-images').upload(path,bl,{contentType:'image/jpeg'});if(u.error)throw u.error;
     const i=await sb.from('product_images').insert({product_id:pid,slot:s.n,storage_path:path});if(i.error)throw i.error}}
   closeModal();toast('Product saved');go('products')
  }catch(er){toast(String(er.message).includes('duplicate')?'This product already exists (same code, or same name + brand + type + part no.)':er.message,1);b.disabled=false}}
}


App.register({id:'products',icon:'🧰',label:'Products',group:'Masters',order:13,page:'product_master',render:pgProducts,tables:['products','product_images','categories']});
