/* ROUTER - module registry, permissions, menu, live sync */
const App={mods:[],byId:{},perms:null,register(m){this.mods.push(m)}};
/* A module calls App.register({id,icon,label,group,order,page,render,tables}) */

async function loadPerms(){
 if(['super_admin','admin','viewer'].includes(role)){App.perms='all';return}
 const{data}=await sb.from('user_page_access').select('can_view,can_add,can_edit,can_approve,pages(code)').eq('user_id',me.id);
 App.perms={};(data||[]).forEach(r=>{if(r.pages)App.perms[r.pages.code]=r})
}
function can(pg,a='view'){
 if(!pg)return true;
 if(App.perms==='all')return role==='viewer'?a==='view':true;
 const r=App.perms&&App.perms[pg];return !!(r&&r['can_'+a])
}
async function shell(){
 await loadPerms();
 const vis=App.mods.filter(m=>can(m.page,'view'));let last=null;
 const nav=vis.map(m=>{const g=m.group&&m.group!==last?`<div class="grp">${esc(m.group)}</div>`:'';if(m.group)last=m.group;return g+`<button data-p="${m.id}"><span>${m.icon}</span>${esc(m.label)}</button>`}).join('');
 $('#app').innerHTML=`<div class="shell"><aside class="side"><div class="brand">🚛 Fleet ERP</div><nav class="nav">${nav}</nav>
 <div class="who">${avatar(me)}<div>${esc(me.full_name)}<small>${esc(me.roles.name)}</small></div></div></aside>
 <main class="main"><div id="view" class="view"></div></main></div>`;
 document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>go(b.dataset.p));
 go(App.byId[page]&&can(App.byId[page].page,'view')?page:'home')
}
async function go(id,quiet){
 live();const m=App.byId[id];if(!m)return;page=id;
 document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('on',b.dataset.p===id));
 const v=$('#view');
 if(!quiet){v.className='';void v.offsetWidth;v.className='view';v.innerHTML='<div class="spin"></div>'}
 if(!can(m.page,'view')){v.innerHTML='<div class="panel">You do not have access to this page.</div>';return}
 try{await m.render()}catch(e){v.innerHTML=`<div class="panel">Something went wrong: ${esc(e.message)}</div>`}
}
let rt=null,rtT=null;
function live(){
 if(rt)return;
 rt=sb.channel('live').on('postgres_changes',{event:'*',schema:'public'},pl=>{
  M.uoms=null;const m=App.byId[page];if(!m||!(m.tables||[]).includes(pl.table))return;
  clearTimeout(rtT);rtT=setTimeout(()=>{const a=document.activeElement;if(a&&/INPUT|SELECT/.test(a.tagName))return;go(page,true)},300)}).subscribe()
}
