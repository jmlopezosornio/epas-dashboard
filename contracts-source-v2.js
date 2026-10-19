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
        inicio:excelDateToJS(row[11]),
        final:excelDateToJS(row[12])
      });
    }
    return out;
  }

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
      renderProcessContracts();
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

  setTimeout(loadContractsV2,700);
  setTimeout(loadContractsV2,1800);
})();
