/* MODULE: Home */
async function pgHome(){
 const c=async t=>(await sb.from(t).select('*',{count:'exact',head:true})).count??0;
 const[u,co,d,s]=await Promise.all([c('profiles'),c('companies'),c('departments'),c('stores')]);
 const tiles=[['Users',u],['Companies',co],['Departments',d],['Stores',s]];
 $('#view').innerHTML=`<div class="top"><h2>Welcome, ${esc(me.full_name)} 👋</h2><button class="btn ghost" onclick="logout()">Sign out</button></div>
 <div class="grid">${tiles.map((t,i)=>`<div class="tile" style="animation-delay:${i*80}ms"><b>${t[1]}</b><span>${t[0]}</span></div>`).join('')}</div>
 <div class="panel" style="margin-top:16px"><b>Coming next</b><p class="mut" style="margin-top:6px">Product Master with photos → PR → PO → GRN → Stock → MRF → Issue and Challan → Job Cards.</p></div>`
}


App.register({id:'home',icon:'🏠',label:'Home',group:'',order:1,page:null,render:pgHome,tables:['profiles','companies','departments','stores']});
