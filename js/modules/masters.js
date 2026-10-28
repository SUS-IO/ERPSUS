/* MODULE: Companies, Departments, Stores */
const MS={companies:{t:'Companies'},departments:{t:'Departments'},stores:{t:'Stores',type:1}};
async function pgMaster(t){
 const m=MS[t],{data,error}=await sb.from(t).select('*').order('code');if(error)throw error;
 $('#view').innerHTML=`<div class="top"><div><h2>${m.t}</h2><p class="mut">${data.length} records</p></div></div>
 ${isAdm()?`<form class="panel row" id="mf"><div><label>Code</label><input name="code" required></div><div><label>Name</label><input name="name" required></div>
 ${m.type?'<div><label>Type</label><select name="store_type"><option value="own">Own store</option><option value="vendor">Vendor store</option></select></div><div><label>Vendor name</label><input name="vendor_name"></div>':''}
 <div style="flex:0"><button class="btn">Add</button></div></form>`:''}<div id="dt" class="panel"></div>`;
 dataTable($('#dt'),{id:'m_'+t,rows:data,sort:'code',cols:[{key:'code',label:'Code'},{key:'name',label:'Name'},
  ...(m.type?[{key:'type',label:'Type',filter:1,val:r=>r.store_type==='vendor'?'Vendor store':'Own store'},{key:'vendor_name',label:'Vendor'}]:[]),
  {key:'status',label:'Status',filter:1,val:r=>r.active?'Active':'Inactive',render:r=>`<span class="pill ${r.active?'':'off'}">${r.active?'Active':'Inactive'}</span>`},
  ...(isAdm()?[{key:'act',label:'',sort:false,render:r=>`<button class="btn ghost sm" onclick="renameRow('${t}','${r.id}','${esc(r.name).replace(/'/g,'')}')">Rename</button> <button class="btn ghost sm" onclick="toggleRow('${t}','${r.id}',${!r.active})">${r.active?'Deactivate':'Activate'}</button>`}]:[])]});
 const f=$('#mf');if(f)f.onsubmit=async e=>{e.preventDefault();const o={code:f.code.value.trim().toUpperCase(),name:f.name.value.trim()};
  if(m.type){o.store_type=f.store_type.value;o.vendor_name=f.vendor_name.value.trim()||null}
  const{error}=await sb.from(t).insert(o);if(error)return toast(error.message.includes('duplicate')?'That code already exists':error.message,1);toast('Added');go(t)}
}
async function toggleRow(t,id,active){const{error}=await sb.from(t).update({active}).eq('id',id);if(error)return toast(error.message,1);go(t)}
async function renameRow(t,id,old){const n=prompt('New name:',old);if(!n||!n.trim())return;const{error}=await sb.from(t).update({name:n.trim()}).eq('id',id);if(error)return toast(error.message,1);toast('Updated');go(t)}


[['companies','🏢','Companies',10],['departments','🧩','Departments',11],['stores','📦','Stores',12]].forEach(([id,icon,label,order])=>App.register({id,icon,label,group:'Masters',order,page:id,render:()=>pgMaster(id),tables:[id]}));
