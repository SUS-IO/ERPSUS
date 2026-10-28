/* MAIN - loads the modules listed in config.js, then starts the app */
(async function(){
 const load=n=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=`js/modules/${n}.js?v=${APP_VERSION}`;s.onload=ok;s.onerror=()=>no(n);document.head.appendChild(s)});
 const res=await Promise.allSettled(MODULES.map(load));
 res.forEach((r,i)=>{if(r.status==='rejected')console.error('Module failed to load:',MODULES[i])});
 App.mods.sort((a,b)=>(a.order||99)-(b.order||99));
 App.byId=Object.fromEntries(App.mods.map(m=>[m.id,m]));
 const{data}=await sb.auth.getSession();
 data.session?loadMe():showLogin();
})();
