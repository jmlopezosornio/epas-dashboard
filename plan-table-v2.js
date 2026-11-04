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

  function syncPrintButton(){
    const btn=document.getElementById('printPlanWorks');
    if(!btn) return;
    btn.style.display=currentPlanMode()==='OBRA'?'inline-flex':'none';
  }

  function ensurePrintButton(){
    const toolbar=document.querySelector('.plan-table-toolbar');
    if(!toolbar || document.getElementById('printPlanWorks')) return;
    const exportBtn=document.getElementById('exportPlanCsv');
    const btn=document.createElement('button');
    btn.id='printPlanWorks';
    btn.className='button secondary';
    btn.type='button';
    btn.innerHTML='🖨 Imprimir';
    btn.title='Imprimir el listado visible de Obras a contratar';
    btn.addEventListener('click',printVisibleWorks);
    if(exportBtn) exportBtn.insertAdjacentElement('beforebegin',btn); else toolbar.appendChild(btn);
    syncPrintButton();
  }

  function printVisibleWorks(){
    if(currentPlanMode()!=='OBRA') return;
    const table=document.querySelector('.plan-table');
    if(!table) return;
    const clone=table.cloneNode(true);
    clone.querySelectorAll('[title]').forEach(el=>el.removeAttribute('title'));

    const city=document.getElementById('planCityFilter')?.selectedOptions?.[0]?.textContent?.trim()||'Todas';
    const system=document.getElementById('planSystemFilter')?.selectedOptions?.[0]?.textContent?.trim()||'Todos';
    const year=document.getElementById('planYearFilter')?.selectedOptions?.[0]?.textContent?.trim()||'Todos';
    const exp=document.getElementById('planExpFilter')?.selectedOptions?.[0]?.textContent?.trim()||'Todos';
    const search=document.getElementById('planSearch')?.value?.trim()||'—';
    const count=document.getElementById('planWorksTabCount')?.textContent?.replace(/[()]/g,'').trim()||'';

    const w=window.open('','_blank','width=1400,height=900');
    if(!w) return;
    const generated=new Date().toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>EPAS - Obras a contratar</title>
      <style>
        @page{size:A4 landscape;margin:10mm}
        *{box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#17384f;margin:0}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0b4f85;padding-bottom:8px;margin-bottom:10px}
        h1{font-size:20px;margin:0;color:#0d2b48}
        .sub{font-size:11px;color:#61798b;margin-top:3px}
        .meta{font-size:10px;color:#526b7d;text-align:right}
        .filters{display:flex;gap:12px;flex-wrap:wrap;font-size:10px;margin:0 0 10px;padding:7px 9px;background:#f2f6f9;border:1px solid #d9e4ec;border-radius:6px}
        .filters b{color:#0d2b48}
        table{width:100%;border-collapse:collapse;font-size:9px;table-layout:auto}
        thead{display:table-header-group}
        th{background:#eaf2f8;color:#284a63;text-align:left;padding:6px 7px;border:1px solid #cfdde7;font-size:8px;text-transform:uppercase}
        td{padding:6px 7px;border:1px solid #dde6ed;vertical-align:top}
        tr{page-break-inside:avoid}
        .numeric{text-align:right;white-space:nowrap}
        .plan-investment-value{white-space:nowrap;text-decoration:none}
        .plan-licitacion-cell{white-space:nowrap}
        .foot{margin-top:8px;font-size:9px;color:#7a8c99;text-align:right}
      </style></head><body>
      <div class="head"><div><h1>EPAS · Obras a contratar</h1><div class="sub">Listado según filtros aplicados</div></div><div class="meta">Registros: ${count||clone.tBodies[0]?.rows.length||0}<br>Generado: ${generated}</div></div>
      <div class="filters"><span><b>Localidad:</b> ${city}</span><span><b>Sistema:</b> ${system}</span><span><b>Año:</b> ${year}</span><span><b>Expediente:</b> ${exp}</span><span><b>Buscar:</b> ${search}</span></div>
      ${clone.outerHTML}
      <div class="foot">EPAS · Tablero de gestión</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},250)}<\/script>
      </body></html>`);
    w.document.close();
  }

  function observe(){
    const body=document.getElementById('planDetailBody');
    if(!body) return setTimeout(observe,250);
    const obs=new MutationObserver(()=>requestAnimationFrame(enhancePlanTable));
    obs.observe(body,{childList:true,subtree:false});
    enhancePlanTable();
    ensurePrintButton();
    syncPrintButton();
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
  ensurePrintButton();
  syncPrintButton();
  loadDates();
})();
