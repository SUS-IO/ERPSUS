/* MODULE: Users and access (Super Admin) */
async function pgUsers(){
 const{data,error}=await sb.from('profiles').select('id,login_id,employee_code,full_name,designation,active,avatar_path,roles(name),departments!department_id(name)').order('login_id');
 if(error)throw error;
 $('#view').innerHTML=`<div class="top"><div><h2>Users</h2><p class="mut">${data.length} people · passwords are never shown, only reset by Super Admin</p></div>${isSuper()?'<button class="btn" onclick="userForm()">＋ Add user</button>':''}</div><div id="dt" class="panel"></div>`;
 dataTable($('#dt'),{id:'users',rows:data,sort:'login_id',cols:[
  {key:'av',label:'',sort:false,render:u=>avatar(u)},
  {key:'login_id',label:'User ID'},{key:'full_name',label:'Name'},{key:'designation',label:'Designation'},
  {key:'role',label:'Role',filter:1,val:u=>u.roles?.name},{key:'dept',label:'Department',filter:1,val:u=>u.departments?.name},
  {key:'status',label:'Status',filter:1,val:u=>u.active?'Active':'Inactive',render:u=>`<span class="pill ${u.active?'':'off'}">${u.active?'Active':'Inactive'}</span>`},
  ...(isSuper()?[{key:'act',label:'',sort:false,render:u=>`<button class="btn ghost sm" onclick="editUser('${u.id}')">Edit</button> <button class="btn ghost sm" onclick="resetPw('${u.id}','${esc(u.login_id)}')">Reset password</button> <button class="btn ghost sm" onclick="setActive('${u.id}',${!u.active})">${u.active?'Deactivate':'Activate'}</button>`}]:[])]})
}
async function resetPw(id,login){
 const pw=prompt('New password for '+login+' (8+ characters):');if(!pw)return;
 try{await call({action:'reset_password',user_id:id,password:pw});toast('Password reset')}catch(e){toast(e.message,1)}
}
async function setActive(id,active){
 try{await call({action:'set_active',user_id:id,active});toast(active?'User activated':'User deactivated');go('users')}catch(e){toast(e.message,1)}
}
async function userForm(){
 const q=t=>sb.from(t).select('*').eq('active',true).order('name');
 const[r,d,c,s,pg]=await Promise.all([sb.from('roles').select('*').order('name'),q('departments'),q('companies'),q('stores'),sb.from('pages').select('*').order('sort_order')]);
 const chk=(n,rows)=>`<div class="chk">${rows.map(x=>`<label><input type="checkbox" name="${n}" value="${x.id}">${esc(x.name)}</label>`).join('')||'<span class="mut">None yet</span>'}</div>`;
 modal(`<h2 style="margin-bottom:6px">Add user</h2><form id="uf">
 <div class="cols"><div><label>User ID (login)</label><input name="login_id" required placeholder="e.g. sus0002" autocapitalize="off"></div>
 <div><label>Password (8+ characters)</label><input name="password" type="password" minlength="8" required></div>
 <div><label>Full name</label><input name="full_name" required></div><div><label>Designation</label><input name="designation"></div>
 <div><label>Employee code</label><input name="employee_code"></div>
 <div><label>Department</label><select name="department_id"><option value="">—</option>${d.data.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>
 <div><label>Role</label><select name="role_code">${r.data.map(x=>`<option value="${x.code}" ${x.code==='user'?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div></div>
 <label>Companies</label>${chk('company_ids',c.data)}<label>Departments (can act for)</label>${chk('department_ids',d.data)}<label>Stores (own and vendor)</label>${chk('store_ids',s.data)}
 <label>Page access (applies to Standard User role)</label><div class="tw"><table><thead><tr><th>Page</th><th>View</th><th>Add</th><th>Edit</th><th>Approve</th></tr></thead><tbody>
 ${pg.data.map(p=>`<tr><td>${esc(p.name)} <span class="mut">${esc(p.module)}</span></td>${['view','add','edit','approve'].map(a=>`<td><input type="checkbox" data-pg="${p.code}" data-a="${a}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
 <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px"><button type="button" class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" id="ub">Create user</button></div></form>`);
 $('#uf').onsubmit=async e=>{e.preventDefault();const f=e.target,b=$('#ub');b.disabled=true;
  const all=n=>[...f.querySelectorAll(`[name=${n}]:checked`)].map(x=>x.value);
  const pages=pg.data.map(p=>{const g=a=>f.querySelector(`[data-pg="${p.code}"][data-a="${a}"]`).checked;return{page_code:p.code,can_view:g('view')||g('add')||g('edit')||g('approve'),can_add:g('add'),can_edit:g('edit'),can_approve:g('approve')}}).filter(p=>p.can_view);
  const body={action:'create',login_id:f.login_id.value,password:f.password.value,full_name:f.full_name.value,designation:f.designation.value,employee_code:f.employee_code.value,department_id:f.department_id.value,role_code:f.role_code.value,company_ids:all('company_ids'),department_ids:all('department_ids'),store_ids:all('store_ids'),pages};
  try{await call(body);closeModal();toast('User created');go('users')}catch(er){toast(er.message,1);b.disabled=false}}
}


async function editUser(uid){
 const q=t=>sb.from(t).select('*').eq('active',true).order('name');
 const[u,r,d,c,s,pg,us,uc,ud,up]=await Promise.all([sb.from('profiles').select('*').eq('id',uid).single(),sb.from('roles').select('*').order('name'),q('departments'),q('companies'),q('stores'),sb.from('pages').select('*').order('sort_order'),sb.from('user_stores').select('store_id').eq('user_id',uid),sb.from('user_companies').select('company_id').eq('user_id',uid),sb.from('user_departments').select('department_id').eq('user_id',uid),sb.from('user_page_access').select('*,pages(code)').eq('user_id',uid)]);
 if(u.error)return toast(u.error.message,1);
 const p=u.data,has=(x,k)=>new Set((x.data||[]).map(y=>y[k])),S1=has(us,'store_id'),C1=has(uc,'company_id'),D1=has(ud,'department_id'),A={};
 (up.data||[]).forEach(x=>{if(x.pages)A[x.pages.code]=x});
 const chk=(n,rows,set)=>`<div class="chk">${rows.map(x=>`<label><input type="checkbox" name="${n}" value="${x.id}" ${set.has(x.id)?'checked':''}>${esc(x.name)}</label>`).join('')||'<span class="mut">None yet</span>'}</div>`;
 const self=uid===me.id;
 modal(`<h2 style="margin-bottom:6px">Edit ${esc(p.login_id)}</h2><form id="ef"><div class="cols">
 <div><label>Full name</label><input name="full_name" required value="${esc(p.full_name)}"></div><div><label>Designation</label><input name="designation" value="${esc(p.designation)}"></div>
 <div><label>Employee code</label><input name="employee_code" value="${esc(p.employee_code)}"></div>
 <div><label>Department</label><select name="department_id"><option value="">—</option>${d.data.map(x=>`<option value="${x.id}" ${x.id===p.department_id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
 <div><label>Role ${self?'(your own role cannot be changed)':''}</label><select name="role_id" ${self?'disabled':''}>${r.data.map(x=>`<option value="${x.id}" ${x.id===p.role_id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div></div>
 <label>Companies</label>${chk('company_ids',c.data,C1)}<label>Departments (can act for)</label>${chk('department_ids',d.data,D1)}<label>Stores (own and vendor)</label>${chk('store_ids',s.data,S1)}
 <label>Page access (applies to Standard User role)</label><div class="tw"><table><thead><tr><th>Page</th><th>View</th><th>Add</th><th>Edit</th><th>Approve</th></tr></thead><tbody>
 ${pg.data.map(x=>`<tr><td>${esc(x.name)} <span class="mut">${esc(x.module)}</span></td>${['view','add','edit','approve'].map(a=>`<td><input type="checkbox" data-pg="${x.code}" data-a="${a}" ${(A[x.code]||{})['can_'+a]?'checked':''}></td>`).join('')}</tr>`).join('')}</tbody></table></div>
 <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px"><button type="button" class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" id="eb">Save changes</button></div></form>`);
 const f=$('#ef');
 f.onsubmit=async e=>{e.preventDefault();$('#eb').disabled=true;
  try{
   const o={full_name:f.full_name.value.trim(),designation:f.designation.value.trim()||null,employee_code:f.employee_code.value.trim()||null,department_id:f.department_id.value||null};if(!self)o.role_id=f.role_id.value;
   let x=await sb.from('profiles').update(o).eq('id',uid);if(x.error)throw x.error;
   const all=n=>[...f.querySelectorAll(`[name=${n}]:checked`)].map(c=>c.value);
   for(const[t,col,vals]of[['user_stores','store_id',all('store_ids')],['user_companies','company_id',all('company_ids')],['user_departments','department_id',all('department_ids')]]){
    x=await sb.from(t).delete().eq('user_id',uid);if(x.error)throw x.error;
    if(vals.length){x=await sb.from(t).insert(vals.map(v=>({user_id:uid,[col]:v})));if(x.error)throw x.error}}
   const pages=pg.data.map(pp=>{const g=a=>f.querySelector(`[data-pg="${pp.code}"][data-a="${a}"]`).checked;return{user_id:uid,page_id:pp.id,can_view:g('view')||g('add')||g('edit')||g('approve'),can_add:g('add'),can_edit:g('edit'),can_approve:g('approve')}}).filter(pp=>pp.can_view);
   x=await sb.from('user_page_access').delete().eq('user_id',uid);if(x.error)throw x.error;
   if(pages.length){x=await sb.from('user_page_access').insert(pages);if(x.error)throw x.error}
   closeModal();toast('User updated');go('users')
  }catch(er){toast(er.message,1);$('#eb').disabled=false}}
}
App.register({id:'users',icon:'👥',label:'Users',group:'Admin',order:50,page:'users',render:pgUsers,tables:['profiles','user_page_access']});
