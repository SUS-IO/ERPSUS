/* AUTH - login, session, logout */
function showLogin(msg){
 $('#app').innerHTML=`<div class="login"><div class="blob b1"></div><div class="blob b2"></div>
 <form class="card" id="lf"><div class="logo">🚛</div><h1>Fleet ERP</h1><p class="sub">Purchase · Stores · Workshop</p>
 <label>User ID</label><input id="u" autocomplete="username" autocapitalize="off" required>
 <label>Password</label><input id="p" type="password" autocomplete="current-password" required>
 <button class="btn full" id="lb">Sign in</button><div class="err" id="le">${esc(msg||'')}</div></form></div>`;
 $('#lf').onsubmit=async e=>{e.preventDefault();const b=$('#lb');b.disabled=true;$('#le').textContent='';
  const{error}=await sb.auth.signInWithPassword({email:$('#u').value.trim().toLowerCase()+DOMAIN,password:$('#p').value});
  if(error){$('#le').textContent='Wrong user id or password';b.disabled=false;return}
  loadMe()}
}
async function loadMe(){
 const{data:{user}}=await sb.auth.getUser();if(!user)return showLogin();
 const{data:p,error}=await sb.from('profiles').select('*,roles(code,name)').eq('id',user.id).single();
 if(error||!p||!p.active){await sb.auth.signOut();return showLogin(error?'Could not load profile: '+error.message:(!p?'No profile found for this login':'This account is not active'))}
 me=p;role=p.roles.code;shell()
}
async function logout(){await sb.removeAllChannels();rt=null;await sb.auth.signOut();me=null;App.perms=null;showLogin()}

