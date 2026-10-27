/* CORE - shared helpers used by every module */
const sb=supabase.createClient(SB_URL,SB_KEY);
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let me=null,role='',page='home';
const isSuper=()=>role==='super_admin', isAdm=()=>role==='super_admin'||role==='admin';

function toast(m,bad){const t=$('#toast');t.textContent=m;t.className='show'+(bad?' bad':'');clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='',3500)}
function avatar(p,cls=''){return p.avatar_path?`<img class="av ${cls}" src="${SB_URL}/storage/v1/object/public/avatars/${esc(p.avatar_path)}" alt="">`:`<div class="av ${cls}">${esc((p.full_name||'?')[0].toUpperCase())}</div>`}
function modal(html){closeModal();const d=document.createElement('div');d.className='ov';d.id='ov';d.innerHTML=`<div class="md">${html}</div>`;d.addEventListener('mousedown',e=>{if(e.target===d)closeModal()});document.body.appendChild(d)}
function closeModal(){const o=$('#ov');if(o)o.remove()}
async function call(body){const{data,error}=await sb.functions.invoke('admin-users',{body});if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}return data}
function compress(file,max=400,q=.8){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>{const r=Math.min(1,max/Math.max(i.width,i.height));const c=document.createElement('canvas');c.width=Math.round(i.width*r);c.height=Math.round(i.height*r);c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(b=>b?res(b):rej(new Error('Image error')),'image/jpeg',q)};i.onerror=()=>rej(new Error('Not an image'));i.src=URL.createObjectURL(file)})}
const M={};   // cached masters (units, categories)
