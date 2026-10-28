/* DOCS - PDF builder, signed-copy versions and ZIP download.
   Shared by PR now, and by PO, GRN, MRF, Challan, Job Card later. */
const LIB={pdf:'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',tbl:'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',zip:'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'};
const _libs={};
function loadLib(url){return _libs[url]||(_libs[url]=new Promise((ok,no)=>{const s=document.createElement('script');s.src=url;s.onload=ok;s.onerror=()=>{delete _libs[url];no(new Error('Could not load a required library. Check the internet connection.'))};document.head.appendChild(s)}))}
function saveBlob(b,name){const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}

/* d = {company,title,docNo,meta:[[label,value]],cols:[],rows:[[]],signers:[{label,name,designation}]} */
async function buildPdf(d){
 await loadLib(LIB.pdf);await loadLib(LIB.tbl);
 const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'}),W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight();
 doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(d.company||'',W/2,16,{align:'center'});
 doc.setFontSize(12);doc.text(d.title,W/2,23,{align:'center'});doc.setFontSize(10);
 d.meta.forEach(([k,v],i)=>{const x=i%2?W/2+2:14,y=33+Math.floor(i/2)*6;doc.setFont('helvetica','bold');doc.text(k+':',x,y);doc.setFont('helvetica','normal');doc.text(String(v??'-').slice(0,38),x+30,y)});
 const y0=33+Math.ceil(d.meta.length/2)*6+3;
 doc.autoTable({startY:y0,head:[d.cols],body:d.rows,styles:{fontSize:9},headStyles:{fillColor:[99,102,241]},margin:{left:14,right:14,bottom:20}});
 const per=4,colW=(W-28)/per,n=d.signers.length,rows=Math.max(1,Math.ceil(n/per));
 let fy=doc.lastAutoTable.finalY+14;if(fy+rows*34>H-16){doc.addPage();fy=22}
 doc.setFontSize(9);
 d.signers.forEach((s,i)=>{const x=14+(i%per)*colW,y=fy+Math.floor(i/per)*34;
  doc.setFont('helvetica','bold');doc.text(s.label||'',x,y);
  doc.setFont('helvetica','normal');doc.line(x,y+16,x+colW-6,y+16);
  doc.text(doc.splitTextToSize(s.name||'',colW-6),x,y+21);
  doc.setFontSize(8);doc.text(doc.splitTextToSize(s.designation||'',colW-6),x,y+26);doc.setFontSize(9)});
 const N=doc.getNumberOfPages();
 for(let i=1;i<=N;i++){doc.setPage(i);doc.setFontSize(8);doc.text(`${d.docNo||''}  ·  Page ${i} of ${N}  ·  Generated ${new Date().toLocaleString()}`,W/2,H-8,{align:'center'})}
 return doc.output('blob')
}

async function docList(type,id){const r=await sb.from('doc_files').select('*').eq('doc_type',type).eq('doc_id',id).order('version');return r.data||[]}
async function docUpload(type,id,file){
 if(file.type!=='application/pdf')throw new Error('Please choose a PDF file');
 if(file.size>15*1024*1024)throw new Error('The file is larger than 15 MB');
 const path=`${type}/${id}/${Date.now()}.pdf`;
 const u=await sb.storage.from('documents').upload(path,file,{contentType:'application/pdf'});if(u.error)throw u.error;
 const r=await sb.rpc('register_signed_doc',{p_type:type,p_id:id,p_path:path,p_name:file.name,p_size:file.size});if(r.error)throw r.error;
 return r.data
}
async function docZip(type,id,printout,base){
 await loadLib(LIB.zip);const z=new JSZip();z.file(base+'_printout.pdf',printout);
 for(const f of await docList(type,id)){const b=await sb.storage.from('documents').download(f.storage_path);if(b.error)throw b.error;z.file(`${base}_signed_v${f.version}.pdf`,b.data)}
 return z.generateAsync({type:'blob'})
}
/* o = {type,id,docNo,canUpload,makePdf:async()=>blob,afterUpload:()=>{}} */
async function docPanel(el,o){
 const fl=await docList(o.type,o.id),base=String(o.docNo||o.id).replace(/[\/\\:*?"<>|]/g,'-');
 el.innerHTML=`<label>Documents</label><div class="panel" style="margin:0"><div style="display:flex;gap:8px;flex-wrap:wrap">
 <button type="button" class="btn sm" data-a="pdf">⬇ Download PDF to sign</button>${o.canUpload?'<button type="button" class="btn ghost sm" data-a="up">⬆ Upload signed copy</button>':''}<button type="button" class="btn ghost sm" data-a="zip">📦 All documents (ZIP)</button></div>
 <div style="margin-top:10px">${fl.length?fl.map(f=>`<div class="mut" style="padding:3px 0">📎 Signed v${f.version} · ${esc(f.file_name)} · ${new Date(f.created_at).toLocaleString()} · <a href="#" data-a="get" data-p="${esc(f.storage_path)}" data-v="${f.version}">download</a></div>`).join(''):'<div class="mut">No signed copy yet. Download the PDF, get it signed, then upload the scan.</div>'}</div></div>`;
 el.onclick=async e=>{
  const t=e.target.closest('[data-a]');if(!t)return;e.preventDefault();const a=t.dataset.a;
  try{
   if(a==='pdf'){t.disabled=true;saveBlob(await o.makePdf(),base+'_printout.pdf');t.disabled=false}
   else if(a==='zip'){t.disabled=true;toast('Preparing ZIP…');saveBlob(await docZip(o.type,o.id,await o.makePdf(),base),base+'_documents.zip');t.disabled=false}
   else if(a==='get'){const b=await sb.storage.from('documents').download(t.dataset.p);if(b.error)throw b.error;saveBlob(b.data,`${base}_signed_v${t.dataset.v}.pdf`)}
   else if(a==='up'){const i=document.createElement('input');i.type='file';i.accept='application/pdf';
    i.onchange=async()=>{if(!i.files[0])return;try{t.disabled=true;const v=await docUpload(o.type,o.id,i.files[0]);toast('Signed copy saved as version '+v);if(o.afterUpload)o.afterUpload();docPanel(el,o)}catch(er){toast(er.message,1);t.disabled=false}};i.click()}
  }catch(er){toast(er.message,1);t.disabled=false}
 }
}
