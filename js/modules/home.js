/* MODULE: Home - bento dashboard */
async function pgHome(){
 const n=(t,f)=>{let q=sb.from(t).select('*',{count:'exact',head:true});if(f)q=f(q);return q.then(r=>r.count??0)};
 const showPR=can('pr','view');
 const[u,co,d,s,p,pd,ps,pg,rec]=await Promise.all([n('profiles'),n('companies'),n('departments'),n('stores'),n('products'),
  showPR?n('pr_headers',q=>q.eq('status','draft')):0,showPR?n('pr_headers',q=>q.eq('status','submitted')):0,showPR?n('pr_headers',q=>q.eq('status','signed')):0,
  showPR?sb.from('pr_headers').select('id,pr_no,status,created_at').order('created_at',{ascending:false}).limit(5):{data:[]}]);
 const hr=new Date().getHours(),gr=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
 const tiles=[['users','👥','Users',u,'users'],['companies','🏢','Companies',co,'companies'],['departments','🧩','Departments',d,'departments'],['stores','📦','Stores',s,'stores'],['products','🧰','Products',p,'product_master']].filter(t=>can(t[4],'view'));
 const tot=(pd+ps+pg)||1,seg=(v,c)=>`<i style="width:${v/tot*100}%;background:${c}"></i>`;
 const acts=[['pr','pr','📝 New PR','prForm'],['products','product_master','🧰 Add product','productForm'],['users','users','👤 Add user','userForm']].filter(a=>a[0]==='users'?isSuper():can(a[1],'add'));
 const st=x=>typeof PRS!=='undefined'?PRS[x]:x;
 $('#view').innerHTML=`<div class="bento">
 <div class="bx hero w2"><h2>${gr}, ${esc(me.full_name.split(' ')[0])} 👋</h2><p class="mut" style="margin-top:6px">${new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · ${esc(me.roles.name)}</p>
  <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">${acts.map(a=>`<button class="btn" style="background:rgba(255,255,255,.22)" onclick="qa('${a[0]}','${a[3]}')">${a[2]}</button>`).join('')}</div></div>
 ${showPR?`<div class="bx w2 click" onclick="go('pr')" style="animation-delay:80ms"><b>Requisitions</b><div class="bar">${seg(pd,'#f59e0b')}${seg(ps,'#6366f1')}${seg(pg,'#10b981')}</div>
  <div class="lg"><span style="--c:#f59e0b">Draft ${pd}</span><span style="--c:#6366f1">Awaiting signed copy ${ps}</span><span style="--c:#10b981">Signed ${pg}</span></div></div>`:''}
 ${tiles.map((t,i)=>`<div class="bx stat click" onclick="go('${t[0]}')" style="animation-delay:${120+i*70}ms"><div class="ic">${t[1]}</div><b data-count="${t[3]}">0</b><span class="mut">${t[2]}</span></div>`).join('')}
 ${showPR?`<div class="bx w2" style="animation-delay:200ms"><b>Recent requisitions</b><div style="margin-top:8px">${rec.data.map(r=>`<div class="li" onclick="qa('pr','prForm','${r.id}')"><span>${esc(r.pr_no||'Draft')}</span><span class="pill ${r.status==='draft'?'warn':''}">${esc(st(r.status))}</span></div>`).join('')||'<p class="mut">None yet</p>'}</div></div>`:''}
 <div class="bx w2" style="animation-delay:260ms"><b>Coming next</b><p class="mut" style="margin:6px 0 12px">Built step by step</p><div class="chips"><span class="chip">Purchase Orders</span><span class="chip">GRN</span><span class="chip">Stock</span><span class="chip">MRF</span><span class="chip">Issue and Challan</span><span class="chip">Job Cards</span></div></div></div>`;
 countUp()
}
App.register({id:'home',icon:'🏠',label:'Home',group:'',order:1,page:null,render:pgHome,tables:['profiles','companies','departments','stores','products','pr_headers']});
