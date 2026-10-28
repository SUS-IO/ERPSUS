/* MODULE: Vendors */
async function pgVendors(){
 const[v,ca,ce]=await Promise.all([sb.from('vendors').select('*').order('code'),sb.rpc('has_perm',{p_page:'vendors',p_action:'add'}),sb.rpc('has_perm',{p_page:'vendors',p_action:'edit'})]);
 if(v.error)throw v.error;
 $('#view').innerHTML=`<div class="top"><div><h2>Vendors</h2><p class="mut">${v.data.length} vendors</p></div>${ca.data?'<button class="btn" onclick="vendorForm()">＋ Add vendor</button>':''}</div><div id="dt" class="panel"></div>`;
 dataTable($('#dt'),{id:'vendors',rows:v.data,sort:'code',cols:[{key:'code',label:'Code'},{key:'name',label:'Name'},{key:'contact',label:'Contact person'},{key:'phone',label:'Phone'},{key:'tax_no',label:'Tax / GST no'},{key:'address',label:'Address'},
  {key:'status',label:'Status',filter:1,val:r=>r.active?'Active':'Inactive',render:r=>`<span class="pill ${r.active?'':'off'}">${r.active?'Active':'Inactive'}</span>`},
  ...(ce.data?[{key:'act',label:'',sort:false,render:r=>`<button class="btn ghost sm" onclick="vendorForm('${r.id}')">Edit</button>`}]:[])]})
}
async function vendorForm(id){
 let p={active:true};
 if(id){const r=await sb.from('vendors').select('*').eq('id',id).single();if(r.error)return toast(r.error.message,1);p=r.data}
 else{const{count}=await sb.from('vendors').select('*',{count:'exact',head:true});p.code='V'+String((count||0)+1).padStart(3,'0')}
 modal(`<h2 style="margin-bottom:6px">${id?'Edit':'Add'} vendor</h2><form id="vf"><div class="cols">
 <div><label>Vendor code</label><input name="code" required value="${esc(p.code)}"></div><div><label>Vendor name</label><input name="name" required value="${esc(p.name)}"></div>
 <div><label>Contact person</label><input name="contact" value="${esc(p.contact)}"></div><div><label>Phone</label><input name="phone" value="${esc(p.phone)}"></div>
 <div><label>Tax / GST no</label><input name="tax_no" value="${esc(p.tax_no)}"></div><div class="chk" style="align-self:end"><label><input type="checkbox" name="active" ${p.active?'checked':''}>Active</label></div>
 <div style="grid-column:1/-1"><label>Address</label><input name="address" value="${esc(p.address)}"></div></div>
 <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px"><button type="button" class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" id="vb">Save vendor</button></div></form>`);
 const f=$('#vf');
 f.onsubmit=async e=>{e.preventDefault();$('#vb').disabled=true;const g=n=>f[n].value.trim()||null;
  const o={code:f.code.value.trim().toUpperCase(),name:f.name.value.trim(),contact:g('contact'),phone:g('phone'),tax_no:g('tax_no'),address:g('address'),active:f.active.checked};
  const r=id?await sb.from('vendors').update(o).eq('id',id):await sb.from('vendors').insert(o);
  if(r.error){toast(r.error.message.includes('duplicate')?'That vendor code already exists':r.error.message,1);$('#vb').disabled=false;return}
  closeModal();toast('Vendor saved');go('vendors')}
}
App.register({id:'vendors',icon:'🏭',label:'Vendors',group:'Masters',order:14,page:'vendors',render:pgVendors,tables:['vendors']});
