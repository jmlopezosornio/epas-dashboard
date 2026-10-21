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

  function observe(){
    const body=document.getElementById('planDetailBody');
    if(!body) return setTimeout(observe,250);
    const obs=new MutationObserver(()=>requestAnimationFrame(enhancePlanTable));
    obs.observe(body,{childList:true,subtree:false});
    enhancePlanTable();
  }

  const style=document.createElement('style');
  style.textContent=`
    .plan-investment-value{cursor:help;text-decoration:underline dotted rgba(39,68,90,.45);text-underline-offset:3px;white-space:nowrap}
    .plan-investment-cell{line-height:1.55}
    .plan-licitacion-cell{white-space:nowrap;color:#27445a}
  `;
  document.head.appendChild(style);

  observe();
  loadDates();
})();
