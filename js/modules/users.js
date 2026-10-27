/* MODULE: Users and access (Super Admin) */
async function pgUsers(){
 const{data,error}=await sb.from('profiles').select('id,login_id,employee_code,full_name,designation,active,avatar_path,roles(name),departments!department_id(name)').order('login_id');
 if(error)throw error;
 $('#view').innerHTML=`<div class="top"><h2>Users</h2>${isSuper()?'<button class="btn" onclick="userForm()">＋ Add user</button>':''}</div>
 <div class="panel tw"><table><thead><tr><th></th><th>User ID</th><th>Name</th><th>Designation</th><th>Role</th><th>Department</th><th>Status</th>${isSuper()?'<th></th>':''}</tr></thead><tbody>
 ${data.map((u,i)=>`<tr style="animation-delay:${i*40}ms"><td>${avatar(u)}</td><td>${esc(u.login_id)}</td><td>${esc(u.full_name)}</td><td>${esc(u.designation)}</td><td>${esc(u.roles?.name)}</td><td>${esc(u.departments?.name)}</td>
 <td><span class="pill ${u.active?'':'off'}">${u.active?'Active':'Inactive'}</span></td>
 ${isSuper()?`<td><button class="btn ghost sm" onclick="resetPw('${u.id}','${esc(u.login_id)}')">Reset password</button> <button class="btn ghost sm" onclick="setActive('${u.id}',${!u.active})">${u.active?'Deactivate':'Activate'}</button></td>`:''}</tr>`).join('')}
 </tbody></table></div><p class="mut">Passwords are never shown anywhere. Super Admin can only set or reset them.</p>`
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


App.register({id:'users',icon:'👥',label:'Users',group:'Admin',order:50,page:'users',render:pgUsers,tables:['profiles','user_page_access']});
