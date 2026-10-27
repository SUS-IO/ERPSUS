/* MODULE: Purchase Requisition (PR) */
const PRS={draft:'Draft',submitted:'Submitted',signed:'Signed',cancelled:'Cancelled'};
let PEOPLE=null;
async function people(force){if(!PEOPLE||force){const r=await sb.rpc('list_people');PEOPLE=r.data||[]}return PEOPLE}
async function myScope(){
 const[c,d,uc,ud]=await Promise.all([sb.from('companies').select('id,code,name').eq('active',true).order('code'),sb.from('departments').select('id,code,name').eq('active',true).order('name'),sb.from('user_companies').select('company_id').eq('user_id',me.id),sb.from('user_departments').select('department_id').eq('user_id',me.id)]);
 const base={allC:c.data||[],allD:d.data||[]};
 if(isAdm())return{...base,c:base.allC,d:base.allD};
 const cs=new Set((uc.data||[]).map(x=>x.company_id)),ds=new Set((ud.data||[]).map(x=>x.department_id));if(me.department_id)ds.add(me.department_id);
 return{...base,c:base.allC.filter(x=>cs.has(x.id)),d:base.allD.filter(x=>ds.has(x.id))}
}
async function pgPR(){
 const[h,pe,sc]=await Promise.all([sb.from('pr_headers').select('*').order('created_at',{ascending:false}).limit(300),people(),myScope()]);
 if(h.error)throw h.error;
 const P=Object.fromEntries(pe.map(x=>[x.id,x.full_name])),CO=Object.fromEntries(sc.allC.map(x=>[x.id,x.code])),DE=Object.fromEntries(sc.allD.map(x=>[x.id,x.name]));
 $('#view').innerHTML=`<div class="top"><h2>Purchase Requisitions</h2>${can('pr','add')?'<button class="btn" onclick="prForm()">＋ New PR</button>':''}</div>
 <div class="panel tw"><table><thead><tr><th>PR No</th><th>Company</th><th>Department</th><th>Raised by</th><th>Required</th><th>Status</th><th></th></tr></thead><tbody>
 ${h.data.map((r,i)=>`<tr style="animation-delay:${Math.min(i,15)*30}ms"><td>${esc(r.pr_no||'— draft —')}</td><td>${esc(CO[r.company_id])}</td><td>${esc(DE[r.department_id])}</td><td>${esc(P[r.raised_by])}</td><td>${esc(r.required_date||'')}</td><td><span class="pill ${r.status==='draft'?'warn':''}">${PRS[r.status]||esc(r.status)}</span></td><td><button class="btn ghost sm" onclick="prForm('${r.id}')">${r.status==='draft'&&r.raised_by===me.id?'Edit':'Open'}</button></td></tr>`).join('')||'<tr><td colspan="7" class="mut">No PRs yet</td></tr>'}</tbody></table></div>`
}
async function prForm(id){
 const[pe,sc]=await Promise.all([people(),myScope()]);
 let h={status:'draft',version:1},L=[],S=[];
 if(id){const[a,b,c]=await Promise.all([sb.from('pr_headers').select('*').eq('id',id).single(),sb.from('pr_lines').select('*').eq('pr_id',id).order('line_no'),sb.from('pr_signers').select('*').eq('pr_id',id).order('sort_order')]);
  if(a.error)return toast(a.error.message,1);h=a.data;L=b.data||[];S=c.data||[]}
 const ro=h.status!=='draft'||(h.raised_by&&h.raised_by!==me.id)||!can('pr','add');
 if(!ro&&(!sc.c.length||!sc.d.length))return toast('Ask Super Admin to assign your company and department first',1);
 if(!L.length)L=[{}];
 const others=pe.filter(x=>x.id!==me.id),P=Object.fromEntries(pe.map(x=>[x.id,x])),dis=ro?'disabled':'';
 const ver=(S.find(x=>x.role_label==='Verified by')||{}).user_id,apr=new Set(S.filter(x=>x.role_label==='Approved by').map(x=>x.user_id));
 const opt=(rows,sel,lab)=>rows.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(lab(x))}</option>`).join('');
 const row=(l,i)=>`<tr><td>${i+1}</td><td><input data-f="d" ${dis} value="${esc(l.description)}" placeholder="Item description" style="min-width:200px"></td><td><input data-f="q" ${dis} type="number" step="0.001" min="0" value="${l.qty??''}" style="width:90px"></td><td><input data-f="u" ${dis} value="${esc(l.unit)}" style="width:80px" placeholder="Nos"></td><td>${ro?'':'<button type="button" class="btn ghost sm" data-rm="1">✕</button>'}</td></tr>`;
 const who=s=>{const p=P[s.user_id]||{};return `${esc(s.role_label)}: <b>${esc(s.name_snap||p.full_name)}</b>${(s.designation_snap||p.designation)?', '+esc(s.designation_snap||p.designation):''}`};
 modal(`<h2 style="margin-bottom:6px">${h.pr_no?esc(h.pr_no):(id?'Edit PR (draft)':'New PR')} ${h.status!=='draft'?`<span class="pill">${PRS[h.status]}</span>`:''}</h2><form id="prf">
 <div class="cols"><div><label>Company</label><select name="company_id" required ${dis}>${opt(ro?sc.allC:sc.c,h.company_id,x=>x.code+' - '+x.name)}</select></div>
 <div><label>Department</label><select name="department_id" required ${dis}>${opt(ro?sc.allD:sc.d,h.department_id,x=>x.name)}</select></div>
 <div><label>Required by</label><input type="date" name="required_date" value="${h.required_date||''}" ${dis}></div>
 <div><label>Purpose / remarks</label><input name="purpose" value="${esc(h.purpose)}" ${dis}></div></div>
 <label>Items (plain text and quantity; stores map them to the Product Master later)</label>
 <div class="tw"><table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th></th></tr></thead><tbody id="prl">${L.map(row).join('')}</tbody></table></div>
 ${ro?'':'<button type="button" class="btn ghost sm" id="addl" style="margin-top:8px">＋ Add item</button>'}
 <label>Signatories printed on the PR</label>
 ${ro&&S.length?`<div class="panel" style="margin:0;line-height:1.9">${S.map(who).join('<br>')}</div>`:`<div class="cols"><div><label>Verified by (Department Manager)</label><select name="ver" ${dis}><option value="">—</option>${opt(others,ver,x=>x.full_name+(x.designation?' · '+x.designation:''))}</select></div></div>
 <label>Approvers (signatures required)</label><div class="chk">${others.map(x=>`<label><input type="checkbox" name="apr" value="${x.id}" ${apr.has(x.id)?'checked':''} ${dis}>${esc(x.full_name)}${x.designation?' · '+esc(x.designation):''}</label>`).join('')}</div>`}
 ${ro&&h.status!=='draft'?'<p class="mut" style="margin-top:12px">🔒 Submitted and frozen. Print, sign and upload the signed copy (coming in the next step).</p>':''}
 <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap"><button type="button" class="btn ghost" onclick="closeModal()">Close</button>
 ${ro?'':'<button type="button" class="btn ghost" id="sd">Save draft</button><button type="button" class="btn" id="sf">Submit and freeze</button>'}</div></form>`);
 if(ro)return;
 const f=$('#prf'),tb=$('#prl');
 const renum=()=>[...tb.rows].forEach((r,i)=>r.cells[0].textContent=i+1);
 tb.onclick=e=>{if(e.target.dataset.rm&&tb.rows.length>1){e.target.closest('tr').remove();renum()}};
 $('#addl').onclick=()=>{tb.insertAdjacentHTML('beforeend',row({},tb.rows.length))};
 const lines=()=>[...tb.rows].map(tr=>({description:tr.querySelector('[data-f=d]').value.trim(),qty:+tr.querySelector('[data-f=q]').value,unit:tr.querySelector('[data-f=u]').value.trim()||null})).filter(x=>x.description);
 async function save(submit){
  if(!f.reportValidity())return;
  const ls=lines();if(!ls.length||ls.some(l=>!(l.qty>0)))return toast('Add at least one item, each with a quantity above 0',1);
  if(submit&&!f.ver.value)return toast('Select who verifies this PR',1);
  if(submit&&!confirm('Submit and freeze this PR? It cannot be edited afterwards.'))return;
  $('#sd').disabled=$('#sf').disabled=true;
  try{
   const o={company_id:f.company_id.value,department_id:f.department_id.value,required_date:f.required_date.value||null,purpose:f.purpose.value.trim()||null};let pid=id;
   if(id){const r=await sb.from('pr_headers').update(o).eq('id',id).eq('version',h.version).select('id');if(r.error)throw r.error;
    if(!r.data.length){toast('This PR was changed elsewhere. Showing the latest version.',1);closeModal();return prForm(id)}}
   else{const r=await sb.from('pr_headers').insert(o).select('id').single();if(r.error)throw r.error;pid=r.data.id}
   let x=await sb.from('pr_lines').delete().eq('pr_id',pid);if(x.error)throw x.error;
   x=await sb.from('pr_signers').delete().eq('pr_id',pid);if(x.error)throw x.error;
   x=await sb.from('pr_lines').insert(ls.map((l,i)=>({...l,pr_id:pid,line_no:i+1})));if(x.error)throw x.error;
   const sg=[];if(f.ver.value)sg.push({pr_id:pid,user_id:f.ver.value,role_label:'Verified by',sort_order:1});
   [...f.querySelectorAll('[name=apr]:checked')].forEach((c,i)=>{if(c.value!==f.ver.value)sg.push({pr_id:pid,user_id:c.value,role_label:'Approved by',sort_order:2+i})});
   if(sg.length){x=await sb.from('pr_signers').insert(sg);if(x.error)throw x.error}
   if(submit){const r=await sb.rpc('submit_pr',{p_id:pid});if(r.error)throw r.error;toast('Submitted as '+r.data)}else toast('Draft saved');
   closeModal();go('pr')
  }catch(er){toast(er.message,1);$('#sd').disabled=$('#sf').disabled=false}
 }
 $('#sd').onclick=()=>save(false);$('#sf').onclick=()=>save(true);
}
App.register({id:'pr',icon:'📝',label:'Requisitions (PR)',group:'Purchase',order:20,page:'pr',render:pgPR,tables:['pr_headers']});
