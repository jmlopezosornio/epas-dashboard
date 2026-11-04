(function(){
  const BOOK_ID='1t1gopI3Iy6tB5DC-2wJEjrLJeDUFKmxG9azBHlYbhGM';
  const WORKS_GID='0';
  const dateByKey=new Map();
  let loaded=false;

  function keyPart(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
  }
  function rowKey(localidad,nombre,expediente){
    return [keyPart(localidad),keyPart(nombre),keyPart(expediente)].join('|');
  }
  function normalizeDate(v){
    const s=String(v||'').trim();
    if(!s) return '—';
    const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if(!m) return s;
    const yy=m[3].length===2?'20'+m[3]:m[3];
    return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${yy}`;
  }
  async function loadDates(){
    try{
      const matrix=await loadGvizJsonp(BOOK_ID,WORKS_GID);
      for(let i=0;i<matrix.length;i++){
        const r=matrix[i]||[];
        const first=keyPart(r[0]);
        if(!first || first==='OBRAS A EJECUTAR' || first==='LOCALIDAD' || first==='PROYECTOS A CONTRATAR' || first.startsWith('SUBTOTALES') || first.startsWith('TOTALES')) continue;
        const k=rowKey(r[0],r[1],r[9]);
        dateByKey.set(k,normalizeDate(r[10]));
      }
      loaded=true;
      enhancePlanTable();
    }catch(err){
      console.warn('No se pudo leer Fecha de Licitación:',err);
    }
  }

  function meaningfulInvestment(text){
    const s=String(text||'').replace(/\s+/g,' ').trim();
    if(!s || s==='—' || s==='-' || /^\$?\s*-$/i.test(s)) return false;
    const digits=s.replace(/[^0-9]/g,'');
    return digits && Number(digits)!==0;
  }

  function enhanceHeader(table){
    const tr=table?.querySelector('thead tr');
    if(!tr) return;
    const ths=[...tr.children];
    if(ths.some(th=>th.dataset.planV2==='investment')) return;
    if(ths.length<10) return;
    ths[6].textContent='Inversión';
    ths[6].dataset.planV2='investment';
    ths[6].classList.add('numeric');
    ths[7].remove();
    ths[8].remove();
    const lic=document.createElement('th');
    lic.textContent='Fecha de Licitación';
    lic.dataset.planV2='licitacion';
    tr.appendChild(lic);
  }

  function enhanceRow(tr){
    if(!tr || tr.dataset.planV2Done==='1') return;
    const cells=[...tr.children];
    if(cells.length<10) return;

    const localidad=cells[0].textContent;
    const nombre=cells[1].textContent;
    const expediente=cells[9].textContent;
    const investments=[
      {year:'2027',text:cells[6].textContent},
      {year:'2028',text:cells[7].textContent},
      {year:'2029',text:cells[8].textContent}
    ].filter(x=>meaningfulInvestment(x.text));

    const invCell=cells[6];
    invCell.innerHTML='';
    invCell.classList.add('numeric','plan-investment-cell');
    if(investments.length){
      investments.forEach((x,idx)=>{
        const span=document.createElement('span');
        span.className='plan-investment-value';
        span.textContent=String(x.text||'').trim();
        span.title=`Inversión ${x.year}`;
        span.setAttribute('aria-label',`Inversión ${x.year}: ${String(x.text||'').trim()}`);
        invCell.appendChild(span);
        if(idx<investments.length-1) invCell.appendChild(document.createElement('br'));
      });
    }else{
      invCell.textContent='—';
    }

    cells[7].remove();
    cells[8].remove();

    const lic=document.createElement('td');
    const value=dateByKey.get(rowKey(localidad,nombre,expediente)) || '—';
    lic.textContent=value;
    lic.className='plan-licitacion-cell';
    tr.appendChild(lic);
    tr.dataset.planV2Done='1';
  }

  function enhancePlanTable(){
    const body=document.getElementById('planDetailBody');
    if(!body) return;
    const table=body.closest('table');
    enhanceHeader(table);
    [...body.querySelectorAll('tr')].forEach(enhanceRow);
  }


  function currentPlanMode(){
    try{
      if(typeof state!=='undefined' && state.planTableMode) return state.planTableMode;
    }catch(e){}
    const active=document.querySelector('.plan-data-tab.active');
    return active?.dataset?.planTable || 'OBRA';
  }

  function syncPdfButton(){
    const btn=document.getElementById('exportPlanPdf');
    if(!btn) return;
    btn.style.display=currentPlanMode()==='OBRA'?'inline-flex':'none';
  }

  function ensurePdfButton(){
    const toolbar=document.querySelector('.plan-table-toolbar');
    if(!toolbar || document.getElementById('exportPlanPdf')) return;

    const oldPrint=document.getElementById('printPlanWorks');
    if(oldPrint) oldPrint.remove();

    const exportBtn=document.getElementById('exportPlanCsv');
    const btn=document.createElement('button');
    btn.id='exportPlanPdf';
    btn.className='button secondary';
    btn.type='button';
    btn.innerHTML='▣ Exportar PDF';
    btn.title='Generar PDF del listado visible de Obras a contratar';
    btn.addEventListener('click',exportVisibleWorksPdf);
    if(exportBtn) exportBtn.insertAdjacentElement('beforebegin',btn); else toolbar.appendChild(btn);
    syncPdfButton();
  }

  function loadScriptOnce(src,test){
    return new Promise((resolve,reject)=>{
      if(test()) return resolve();
      const existing=[...document.scripts].find(x=>x.src===src);
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const el=document.createElement('script');
      el.src=src;el.onload=resolve;el.onerror=()=>reject(new Error('No se pudo cargar '+src));
      document.head.appendChild(el);
    });
  }

  async function ensurePdfLibs(){
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',()=>!!window.jspdf?.jsPDF);
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',()=>!!window.jspdf?.jsPDF?.API?.autoTable);
  }

  function visiblePlanRowsForPdf(){
    const table=document.querySelector('.plan-table');
    if(!table) return {headers:[],rows:[]};
    const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.replace(/\s+/g,' ').trim());
    const rows=[...table.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.replace(/\s+/g,' ').trim()));
    return {headers,rows};
  }

  async function exportVisibleWorksPdf(){
    if(currentPlanMode()!=='OBRA') return;
    const btn=document.getElementById('exportPlanPdf');
    const old=btn?.innerHTML;
    try{
      if(btn){btn.disabled=true;btn.innerHTML='Generando PDF…';}
      await ensurePdfLibs();
      const {jsPDF}=window.jspdf;
      const {headers,rows}=visiblePlanRowsForPdf();
      if(!rows.length) return;

      const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true});
      const pageW=doc.internal.pageSize.getWidth();
      const pageH=doc.internal.pageSize.getHeight();

      const navy=[11,47,87], blue=[23,111,155], cyan=[52,169,201], line=[218,228,235];
      const city=document.getElementById('planCityFilter')?.selectedOptions?.[0]?.textContent?.trim()||'Todas';
      const system=document.getElementById('planSystemFilter')?.selectedOptions?.[0]?.textContent?.trim()||'Todos';
      const year=document.getElementById('planYearFilter')?.selectedOptions?.[0]?.textContent?.trim()||'Todos';
      const exp=document.getElementById('planExpFilter')?.selectedOptions?.[0]?.textContent?.trim()||'Todos';
      const search=document.getElementById('planSearch')?.value?.trim()||'—';
      const generated=new Date().toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
      const logo=document.querySelector('.brand-logo-real')?.src||'';

      function drawHeader(data){
        doc.setFillColor(...navy);
        doc.rect(0,0,pageW,24,'F');
        if(logo && /^data:image\//.test(logo)){
          try{doc.addImage(logo,'PNG',10,4.2,40,15.5,undefined,'FAST');}catch(e){}
        }
        doc.setTextColor(255,255,255);
        doc.setFont('helvetica','bold');doc.setFontSize(16);
        doc.text('Obras a contratar',58,10.5);
        doc.setFont('helvetica','normal');doc.setFontSize(9.5);
        doc.text('EPAS · Planificación de infraestructura',58,16.5);

        doc.setTextColor(45,70,90);
        doc.setFillColor(244,248,251);
        doc.roundedRect(10,29,pageW-20,17,2,2,'F');
        doc.setFontSize(8.5);
        const filters=[
          ['Localidad',city],['Sistema',system],['Año',year],['Expediente',exp],['Buscar',search]
        ];
        let x=14;
        filters.forEach(([k,v])=>{
          doc.setFont('helvetica','bold');doc.text(k+':',x,36);
          doc.setFont('helvetica','normal');
          const val=String(v||'—');
          doc.text(val.substring(0,34),x,41);
          x+=78;
        });
        doc.setFontSize(8);
        doc.setTextColor(100,120,135);
        doc.text('Generado: '+generated,pageW-12,10,{align:'right'});
        doc.text('Registros: '+rows.length,pageW-12,16,{align:'right'});
      }

      const colWidths=[26,92,22,31,21,31,34,72,28];
      doc.autoTable({
        head:[headers],
        body:rows,
        startY:51,
        margin:{top:51,left:10,right:10,bottom:14},
        styles:{
          font:'helvetica',fontSize:7.8,textColor:[31,55,73],
          cellPadding:{top:2.8,right:2.5,bottom:2.8,left:2.5},
          lineColor:line,lineWidth:.18,valign:'middle',overflow:'linebreak'
        },
        headStyles:{
          fillColor:[234,242,248],textColor:[41,75,99],
          fontStyle:'bold',fontSize:7.5,lineColor:[205,220,230],lineWidth:.25
        },
        alternateRowStyles:{fillColor:[249,251,253]},
        columnStyles:{
          0:{cellWidth:colWidths[0],fontStyle:'bold'},
          1:{cellWidth:colWidths[1]},
          2:{cellWidth:colWidths[2]},
          3:{cellWidth:colWidths[3],halign:'right'},
          4:{cellWidth:colWidths[4]},
          5:{cellWidth:colWidths[5]},
          6:{cellWidth:colWidths[6],halign:'right'},
          7:{cellWidth:colWidths[7],fontSize:7.2},
          8:{cellWidth:colWidths[8],halign:'center'}
        },
        didDrawPage:(data)=>{
          drawHeader(data);
          const page=doc.internal.getNumberOfPages();
          doc.setDrawColor(...line);doc.line(10,pageH-10,pageW-10,pageH-10);
          doc.setFontSize(7.5);doc.setTextColor(110,130,145);
          doc.text('EPAS · Tablero de gestión',10,pageH-5.5);
          doc.text('Página '+page,pageW-10,pageH-5.5,{align:'right'});
        }
      });

      const filename='EPAS_Obras_a_contratar_'+new Date().toISOString().slice(0,10)+'.pdf';
      doc.save(filename);
    }catch(err){
      console.error('PDF Obras a contratar:',err);
      alert('No se pudo generar el PDF. Probá nuevamente.');
    }finally{
      if(btn){btn.disabled=false;btn.innerHTML=old||'▣ Exportar PDF';}
    }
  }

  document.addEventListener('click',function(ev){
    if(ev.target.closest('.plan-data-tab')||ev.target.closest('.works-mode-tab')) setTimeout(syncPdfButton,30);
  });

  function observe(){
    const body=document.getElementById('planDetailBody');
    if(!body) return setTimeout(observe,250);
    const obs=new MutationObserver(()=>requestAnimationFrame(enhancePlanTable));
    obs.observe(body,{childList:true,subtree:false});
    enhancePlanTable();
    ensurePdfButton();
    syncPdfButton();
  }

  document.addEventListener('click',function(ev){
    if(ev.target.closest('.plan-data-tab')||ev.target.closest('.works-mode-tab')) setTimeout(syncPrintButton,30);
  });

  const style=document.createElement('style');
  style.textContent=`
    .plan-investment-value{cursor:help;text-decoration:underline dotted rgba(39,68,90,.45);text-underline-offset:3px;white-space:nowrap}
    .plan-investment-cell{line-height:1.55}
    .plan-licitacion-cell{white-space:nowrap;color:#27445a}
  `;
  document.head.appendChild(style);

  observe();
  ensurePdfButton();
  syncPdfButton();
  loadDates();
})();
