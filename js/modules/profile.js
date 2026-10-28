/* MODULE: My profile */
function pgProfile(){
 $('#view').innerHTML=`<div class="top"><h2>My profile</h2></div><div class="panel" style="max-width:520px">
 <div style="display:flex;gap:16px;align-items:center">${avatar(me,'big')}<div><b>${esc(me.full_name)}</b><div class="mut">${esc(me.designation||'')} · ${esc(me.roles.name)}</div><div class="mut">User ID: ${esc(me.login_id)}</div></div></div>
 <label style="margin-top:18px">Profile picture (compressed automatically)</label><input type="file" id="pf" accept="image/*">
 <button class="btn full" id="pb">Upload picture</button>
 <button class="btn ghost full" onclick="logout()">Sign out</button></div>`;
 $('#pb').onclick=async()=>{const f=$('#pf').files[0];if(!f)return toast('Choose a picture first',1);
  try{const blob=await compress(f),path=`${me.id}/${Date.now()}.jpg`;
   const u=await sb.storage.from('avatars').upload(path,blob,{contentType:'image/jpeg'});if(u.error)throw u.error;
   const r=await sb.rpc('update_my_profile',{p_full_name:null,p_designation:null,p_avatar_path:path});if(r.error)throw r.error;
   toast('Picture updated ('+Math.round(blob.size/1024)+' KB)');loadMe()}catch(e){toast(e.message,1)}}
}

App.register({id:'profile',icon:'🙂',label:'Profile',group:'Account',order:99,page:null,render:async()=>pgProfile(),tables:[]});
