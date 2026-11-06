(function(){
  function loadOnce(src,test){
    return new Promise((resolve,reject)=>{
      if(test()) return resolve();
      const existing=[...document.scripts].find(s=>s.src===src);
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>reject(new Error('No se pudo cargar '+src));document.head.appendChild(el);
    });
  }
  async function ensureLibs(){
    await loadOnce('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',()=>!!window.jspdf?.jsPDF);
    await loadOnce('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',()=>!!window.jspdf?.jsPDF?.API?.autoTable);
  }
  function tableData(selector){
    const table=document.querySelector(selector);
    if(!table) return {headers:[],rows:[]};
    const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.replace(/\s+/g,' ').trim());
    const rows=[...table.querySelectorAll('tbody tr')].filter(tr=>!tr.querySelector('.empty-row')).map(tr=>[...tr.children].map(td=>td.textContent.replace(/\s+/g,' ').trim()));
    return {headers,rows};
  }
  function txt(id,fallback='—'){const el=document.getElementById(id);return el?.selectedOptions?.[0]?.textContent?.trim()||el?.value?.trim()||fallback;}
  function query(id){return document.getElementById(id)?.value?.trim()||'—';}
  async function makePdf(kind){
    const isProcess=kind==='process';
    const btn=document.getElementById(isProcess?'exportProcessPdf':'exportContractsPdf');
    const old=btn?.innerHTML;
    try{
      const data=tableData(isProcess?'.process-table':'.contracts-table');
      if(!data.rows.length) return;
      if(btn){btn.disabled=true;btn.innerHTML='Generando PDF…';}
      await ensureLibs();
      const {jsPDF}=window.jspdf;
      const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true});
      const pageW=doc.internal.pageSize.getWidth(), pageH=doc.internal.pageSize.getHeight();
      const navy=[11,47,87], line=[218,228,235];
      const generated=new Date().toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
      const logo=document.querySelector('.brand-logo-real')?.src||'';
      const title=isProcess?'Contratos y servicios · En proceso':'Contratos y servicios · Vigentes';
      const subtitle=isProcess?'Tramitaciones y contrataciones en proceso':'Contratos vigentes de cuadrillas y servicios';

      const filters=isProcess
        ? [['Localidad',txt('processCityFilter','Todas')],['Buscar',query('processSearch')]]
        : [['Localidad',txt('contractCityFilter','Todas')],['Estado',txt('contractStatusFilter','Todos')],['Buscar',query('contractSearch')]];

      function drawHeader(){
        doc.setFillColor(...navy);doc.rect(0,0,pageW,24,'F');
        if(logo && /^data:image\//.test(logo)){try{doc.addImage(logo,'PNG',10,4.2,40,15.5,undefined,'FAST');}catch(e){}}
        doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text(title,58,10.5);
        doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text(subtitle,58,16.5);
        doc.setTextColor(45,70,90);doc.setFillColor(244,248,251);doc.roundedRect(10,29,pageW-20,17,2,2,'F');
        doc.setFontSize(8.5);let x=14;
        filters.forEach(([k,v],idx)=>{doc.setFont('helvetica','bold');doc.text(k+':',x,36);doc.setFont('helvetica','normal');doc.text(String(v||'—').substring(0,55),x,41);x+=idx===0?115:135;});
        doc.setFontSize(8);doc.setTextColor(100,120,135);doc.text('Registros: '+data.rows.length,pageW-12,13,{align:'right'});
      }

      doc.autoTable({
        head:[data.headers],
        body:data.rows,
        startY:51,
        margin:{top:51,left:10,right:10,bottom:14},
        styles:{font:'helvetica',fontSize:isProcess?7.2:7.1,textColor:[31,55,73],cellPadding:{top:2.6,right:2.2,bottom:2.6,left:2.2},lineColor:line,lineWidth:.18,valign:'middle',overflow:'linebreak'},
        headStyles:{fillColor:[234,242,248],textColor:[41,75,99],fontStyle:'bold',fontSize:7,lineColor:[205,220,230],lineWidth:.25},
        alternateRowStyles:{fillColor:[249,251,253]},
        didDrawPage:()=>{
          drawHeader();
          const p=doc.internal.getNumberOfPages();
          doc.setDrawColor(...line);doc.line(10,pageH-10,pageW-10,pageH-10);
          doc.setFontSize(7.5);doc.setTextColor(110,130,145);doc.text('EPAS · Tablero de gestión',10,pageH-5.5);doc.text('Página '+p,pageW-10,pageH-5.5,{align:'right'});
        }
      });

      let finalY=(doc.lastAutoTable&&doc.lastAutoTable.finalY)||51;
      if(finalY>pageH-20){doc.addPage();finalY=18;}
      doc.setDrawColor(...line);doc.line(10,finalY+4,pageW-10,finalY+4);
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(85,105,120);
      doc.text('Fecha y hora de impresión: '+generated,10,finalY+10);

      const slug=isProcess?'Contratos_en_proceso':'Contratos_vigentes';
      doc.save('EPAS_'+slug+'_'+new Date().toISOString().slice(0,10)+'.pdf');
    }catch(err){
      console.error('PDF contratos:',err);
      alert('No se pudo generar el PDF. Probá nuevamente.');
    }finally{
      if(btn){btn.disabled=false;btn.innerHTML=old||'▣ Exportar PDF';}
    }
  }
  function init(){
    document.getElementById('exportContractsPdf')?.addEventListener('click',()=>makePdf('active'));
    document.getElementById('exportProcessPdf')?.addEventListener('click',()=>makePdf('process'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();