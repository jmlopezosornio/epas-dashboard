(function(){
  const CONTRACTS_BOOK_ID='1t1gopI3Iy6tB5DC-2wJEjrLJeDUFKmxG9azBHlYbhGM';
  const CONTRACTS_GID='1158551642';
  const PROCESS_GID='441942381';

  function parseActiveMatrix(matrix){
    const out=[];
    for(let r=2;r<(matrix||[]).length;r++){
      const row=matrix[r]||[];
      const localidad=cleanText(row[0]);
      const contrato=cleanText(row[1]);
      const expediente=cleanText(row[2]);
      if(!localidad&&!contrato&&!expediente) continue;
      if(!contrato&&!expediente) continue;
      const inicio=excelDateToJS(row[6]);
      const fin=excelDateToJS(row[7]);
      const note=cleanText(row[8]);
      const textEnd=parseDateFromText(note);
      out.push({
        localidad:normalizeLocality(localidad||'Sin localidad'),
        contrato:toSmartTitleCase(contrato),
        expediente,
        adjudicado:numeric(row[3]),
        empresa:cleanText(row[4])||'—',
        plazo:numeric(row[5]),
        inicio,
        final:fin,
        finalEfectiva:textEnd||fin,
        nuevaTramitacion:note,
        extensionStart:null,
        extensionEnd:null
      });
    }
    return out;
  }

  function parseProcessMatrix(matrix){
    const out=[];
    for(let r=2;r<(matrix||[]).length;r++){
      const row=matrix[r]||[];
      const contrato=cleanText(row[1]);
      const expediente=cleanText(row[2]);
      if(!contrato&&!expediente) continue;
      out.push({
        localidad:normalizeLocality(row[0]),
        contrato:toSmartTitleCase(contrato),
        expediente,
        presupuesto:numeric(row[3]),
        adjudicado:numeric(row[4]),
        empresa:cleanText(row[6]),
        plazo:numeric(row[7]),
        fechaLicitacion:excelDateToJS(row[13]),
        inicio:excelDateToJS(row[11]),
        final:excelDateToJS(row[12])
      });
    }
    return out;
  }

  function ensureProcessDateHeader(){
    const body=document.getElementById('processBody');
    const table=body?.closest('table');
    const row=table?.querySelector('thead tr');
    if(!row) return;
    const headers=[...row.querySelectorAll('th')];
    if(headers.some(th=>cleanText(th.textContent).toLowerCase()==='fecha de licitación')) return;
    const plazo=headers.find(th=>cleanText(th.textContent).toLowerCase()==='plazo');
    if(!plazo) return;
    const th=document.createElement('th');
    th.textContent='Fecha de licitación';
    plazo.insertAdjacentElement('afterend',th);
  }

  function renderProcessContractsV3(){
    ensureProcessDateHeader();
    const rows=filteredProcessContracts();
    const budget=rows.reduce((s,c)=>s+c.presupuesto,0);
    const awarded=rows.reduce((s,c)=>s+c.adjudicado,0);
    const cities=new Set(rows.map(c=>c.localidad));
    document.getElementById('kpiProcess').textContent=NUM.format(rows.length);
    document.getElementById('kpiProcessBudget').textContent=fmtCompactMoney(budget);
    document.getElementById('kpiProcessAwarded').textContent=fmtCompactMoney(awarded);
    document.getElementById('kpiProcessCities').textContent=NUM.format(cities.size);
    document.getElementById('processTableTotal').textContent=`${rows.length} trámite${rows.length===1?'':'s'}`;
    document.getElementById('processBody').innerHTML=rows.length?rows.map(c=>`<tr><td>${escapeHtml(c.localidad)}</td><td class="contract-name">${escapeHtml(c.contrato)}</td><td class="exp-cell">${escapeHtml(c.expediente)}</td><td class="numeric">${c.presupuesto?fmtMoney(c.presupuesto):'—'}</td><td class="numeric">${c.adjudicado?fmtMoney(c.adjudicado):'—'}</td><td>${escapeHtml(c.empresa)||'—'}</td><td>${c.plazo?`${NUM.format(c.plazo)} días`:'—'}</td><td>${fmtDate(c.fechaLicitacion)}</td><td>${fmtDate(c.inicio)}</td><td>${fmtDate(c.final)}</td></tr>`).join(''):'<tr><td class="empty-row" colspan="10">Sin tramitaciones para los filtros seleccionados.</td></tr>';
  }

  window.renderProcessContracts=renderProcessContractsV3;

  async function loadContractsV2(){
    const status=document.getElementById('contractsFileStatus');
    if(status) status.textContent='Actualizando contratos desde Base para DASBOARD EPAS…';
    try{
      const [activeMatrix,processMatrix]=await Promise.all([
        loadGvizJsonp(CONTRACTS_BOOK_ID,CONTRACTS_GID),
        loadGvizJsonp(CONTRACTS_BOOK_ID,PROCESS_GID)
      ]);
      state.contracts=parseActiveMatrix(activeMatrix);
      state.processContracts=parseProcessMatrix(processMatrix);
      populateContractFilters();
      renderContracts();
      renderProcessContractsV3();
      const badge=document.getElementById('contractsBadge');
      const activeCount=document.getElementById('activeContractsCount');
      const processCount=document.getElementById('processContractsCount');
      if(badge) badge.textContent=state.contracts.length;
      if(activeCount) activeCount.textContent=`(${state.contracts.length})`;
      if(processCount) processCount.textContent=`(${state.processContracts.length})`;
      if(status) status.textContent=`Base para DASBOARD EPAS · ${state.contracts.length} vigentes · ${state.processContracts.length} en proceso`;
      const stamp=document.getElementById('contractsLastUpdate');
      if(stamp) updateTimestamp(stamp);
    }catch(err){
      console.error('Contratos v2:',err);
      if(status) status.textContent=`Error al leer la base unificada: ${err.message}`;
    }
  }

  window.loadContractsV2=loadContractsV2;

  const reload=document.getElementById('reloadContractsDefault');
  if(reload){
    reload.addEventListener('click',function(ev){
      ev.preventDefault();
      ev.stopImmediatePropagation();
      loadContractsV2();
    },true);
  }

  document.querySelectorAll('.tab-button[data-tab="contratos"]').forEach(btn=>{
    btn.addEventListener('click',()=>setTimeout(loadContractsV2,80));
  });

  document.querySelectorAll('.subtab-button[data-contract-view="proceso"]').forEach(btn=>{
    btn.addEventListener('click',()=>setTimeout(renderProcessContractsV3,80));
  });

  setTimeout(loadContractsV2,700);
  setTimeout(loadContractsV2,1800);
})();
