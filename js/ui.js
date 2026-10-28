/* UI - reusable data table (search, filters, sorting, paging, CSV) and small effects */
const TBL={};   /* remembers search/sort/filter per table, even after a live refresh */
function dataTable(el,o){
 const st=TBL[o.id]||(TBL[o.id]={q:'',sort:o.sort||null,dir:1,f:{...(o.f||{})},page:1,size:o.size||25});
 const cols=o.cols,ncol=cols.length;
 const val=(r,c)=>c.val?c.val(r):r[c.key];
 const txt=(r,c)=>{const v=val(r,c);return v==null?'':String(v)};
 const fcols=cols.filter(c=>c.filter);
 const opts=Object.fromEntries(fcols.map(c=>[c.key,[...new Set(o.rows.map(r=>txt(r,c)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))]));
 el.innerHTML=`<div class="dt first"><div class="dt-bar"><div class="dt-search"><span>🔍</span><input class="dt-q" placeholder="Search anything…" value="${esc(st.q)}"></div>
 ${fcols.map(c=>`<select class="dt-f" data-k="${c.key}"><option value="">${esc(c.label)}: all</option>${opts[c.key].map(v=>`<option ${st.f[c.key]===v?'selected':''}>${esc(v)}</option>`).join('')}</select>`).join('')}
 <span class="dt-sp"></span><button class="btn ghost sm" data-dt="clear">Clear</button><button class="btn ghost sm" data-dt="csv">⬇ CSV</button></div>
 <div class="tw"><table><thead><tr>${cols.map(c=>`<th data-k="${c.key}" class="${c.sort===false?'':'srt'}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody></tbody></table></div><div class="dt-foot"></div></div>`;
 const q=s=>el.querySelector(s);
 const rowsNow=()=>{
  let rows=o.rows.filter(r=>{for(const c of fcols){const f=st.f[c.key];if(f&&txt(r,c)!==f)return false}
   if(!st.q)return true;const t=st.q.toLowerCase();return cols.some(c=>txt(r,c).toLowerCase().includes(t))});
  const c=cols.find(x=>x.key===st.sort);
  if(c)rows=[...rows].sort((a,b)=>{const A=val(a,c)??'',B=val(b,c)??'';return(typeof A==='number'&&typeof B==='number'?A-B:String(A).localeCompare(String(B),undefined,{numeric:true,sensitivity:'base'}))*st.dir});
  return rows};
 function draw(){
  const rows=rowsNow(),total=rows.length,pages=Math.max(1,Math.ceil(total/st.size));if(st.page>pages)st.page=pages;
  const from=(st.page-1)*st.size,sl=rows.slice(from,from+st.size);
  q('tbody').innerHTML=sl.map(r=>`<tr>${cols.map(c=>`<td>${c.render?c.render(r):esc(txt(r,c))}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${ncol}" class="dt-empty">🗂️ Nothing to show${o.rows.length?' — try clearing the filters':' yet'}</td></tr>`;
  el.querySelectorAll('th').forEach(th=>{th.classList.toggle('asc',th.dataset.k===st.sort&&st.dir===1);th.classList.toggle('desc',th.dataset.k===st.sort&&st.dir===-1)});
  q('.dt-foot').innerHTML=`<span class="mut">${total?`${from+1}–${from+sl.length} of ${total}`:'0 results'}${total!==o.rows.length?` (filtered from ${o.rows.length})`:''}</span><span class="dt-sp"></span>
  <select class="dt-s">${[10,25,50,100].map(n=>`<option ${n===st.size?'selected':''}>${n}</option>`).join('')}</select><span class="mut">per page</span>
  <button class="btn ghost sm" data-dt="prev" ${st.page<=1?'disabled':''}>‹</button><span class="mut">${st.page} / ${pages}</span><button class="btn ghost sm" data-dt="next" ${st.page>=pages?'disabled':''}>›</button>`}
 el.oninput=e=>{if(e.target.classList.contains('dt-q')){st.q=e.target.value;st.page=1;draw()}};
 el.onchange=e=>{const t=e.target;
  if(t.classList.contains('dt-f')){st.f[t.dataset.k]=t.value;st.page=1;draw()}
  else if(t.classList.contains('dt-s')){st.size=+t.value;st.page=1;draw()}};
 el.onclick=e=>{
  const th=e.target.closest('th.srt');if(th){const k=th.dataset.k;st.dir=st.sort===k?-st.dir:1;st.sort=k;draw();return}
  const b=e.target.closest('[data-dt]');if(!b)return;const a=b.dataset.dt;
  if(a==='prev')st.page--;else if(a==='next')st.page++;
  else if(a==='clear'){st.q='';st.f={};st.page=1;q('.dt-q').value='';el.querySelectorAll('.dt-f').forEach(s=>s.value='')}
  else if(a==='csv'){const cs=cols.filter(c=>c.label&&c.csv!==false),qt=v=>'"'+String(v).replace(/"/g,'""')+'"';
   const out=[cs.map(c=>qt(c.label)).join(',')].concat(rowsNow().map(r=>cs.map(c=>qt(txt(r,c))).join(',')));
   saveBlob(new Blob(['\uFEFF'+out.join('\r\n')],{type:'text/csv'}),(o.id||'export')+'.csv');return}
  draw()};
 draw();setTimeout(()=>{const d=el.querySelector('.dt');if(d)d.classList.remove('first')},700);
}
function countUp(){document.querySelectorAll('[data-count]').forEach(el=>{const to=+el.dataset.count,t0=performance.now();const step=t=>{const p=Math.min(1,(t-t0)/700);el.textContent=Math.round(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)})}
async function qa(id,fn,arg){await go(id);if(typeof window[fn]==='function')window[fn](arg)}
