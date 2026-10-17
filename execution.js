(function(){
  const EXEC_GID='1972762052';
  const EXEC_SHEET_ID='1t1gopI3Iy6tB5DC-2wJEjrLJeDUFKmxG9azBHlYbhGM';
  const execState={rows:[],loaded:false,mode:'execution'};

  function norm(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();}
  function firstPercent(v){const m=String(v??'').replace(/\s+/g,' ').match(/(100(?:[.,]0{1,2})?|\d{1,2}(?:[.,]\d{1,2})?)/);if(!m)return null;const n=Number(m[1].replace(',','.'));return Number.isFinite(n)?Math.max(0,Math.min(100,n)):null;}
  function fmtPct(v){return v==null?'—':new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v)+' %';}
  function headerIndex(headers,tests){return headers.findIndex(h=>tests.some(t=>t(norm(h))));}
  function statusClass(v){const s=norm(v);if(!s)return'neutral';if(s.includes('RESCIND')||s.includes('PARALIZ')||s.includes('SIN ADJUDICAR')||s.includes('SIN TRABAJOS'))return'danger';if(s.includes('FINALIZ'))return'good';if(s.includes('NORMAL')||s.includes('EN EJECUCION'))return'good';if(s.includes('REINICIO')||s.includes('DEBAJO')||s.includes('ADICIONAL')||s.includes('FALTA'))return'warn';return'neutral';}
  function progressClass(v){if(v==null)return'';if(v<25)return'low';if(v<60)return'warn';return'';}
  function isCritical(v){const s=norm(v);return s.includes('RESCIND')||s.includes('PARALIZ')||s.includes('SIN ADJUDICAR')||s.includes('SIN TRABAJOS');}
  function money(v){try{return typeof fmtMoney==='function'?fmtMoney(v):String(v??'—');}catch(e){return String(v??'—');}}
  function compactMoney(v){try{return typeof fmtCompactMoney==='function'?fmtCompactMoney(v):money(v);}catch(e){return money(v);}}
  function esc(v){try{return typeof escapeHtml==='function'?escapeHtml(v):String(v??'');}catch(e){return String(v??'');}}
  function title(v){try{return typeof toSmartTitleCase==='function'?toSmartTitleCase(v):String(v??'');}catch(e){return String(v??'');}}
  function locality(v){try{return typeof normalizeLocality==='function'?normalizeLocality(v):title(v);}catch(e){return title(v);}}

  function parseMatrix(matrix){
    if(!Array.isArray(matrix)||!matrix.length)return[];
    let headerRow=-1;
    for(let i=0;i<Math.min(matrix.length,20);i++){
      const row=(matrix[i]||[]).map(norm);
      if(row.some(x=>x.includes('NOMBRE'))&&row.some(x=>x.includes('CONTRATISTA'))&&row.some(x=>x.includes('AVANCE'))){headerRow=i;break;}
    }
    if(headerRow<0)return[];
    const headers=(matrix[headerRow]||[]).map(v=>String(v??''));
    const idx={
      nombre:headerIndex(headers,[h=>h==='NOMBRE'||h.includes('NOMBRE')]),
      localidad:headerIndex(headers,[h=>h.includes('LOCALIDAD')]),
      contratista:headerIndex(headers,[h=>h.includes('CONTRATISTA')]),
      monto:headerIndex(headers,[h=>h.includes('MONTO CONTRATO')&&!h.includes('ADIC')]),
      adicional:headerIndex(headers,[h=>h.includes('MONTO')&&h.includes('ADIC')]),
      plazo:headerIndex(headers,[h=>h.includes('PLAZO DE OBRA')&&h.includes('TOTAL')]),
      ampliacion:headerIndex(headers,[h=>h.includes('AMPLIACION')&&h.includes('PLAZO')]),
      avance:headerIndex(headers,[h=>h.includes('AVANCE')&&h.includes('ACTUAL')]),
      estado:headerIndex(headers,[h=>h.includes('ESTADO ACTUAL')]),
      obs:headerIndex(headers,[h=>h==='OBS'||h.startsWith('OBS ')||h.includes('OBSERV')])
    };
    const rows=[];
    for(let r=headerRow+1;r<matrix.length;r++){
      const row=matrix[r]||[];
      const nombre=idx.nombre>=0?String(row[idx.nombre]??'').trim():'';
      if(!nombre)continue;
      const montoRaw=idx.monto>=0?row[idx.monto]:'';
      const addRaw=idx.adicional>=0?row[idx.adicional]:'';
      const avanceRaw=idx.avance>=0?row[idx.avance]:'';
      const item={
        nombre:title(nombre),
        localidad:locality(idx.localidad>=0?row[idx.localidad]:''),
        contratista:title(idx.contratista>=0?row[idx.contratista]:''),
        monto:typeof numeric==='function'?numeric(montoRaw):Number(montoRaw)||0,
        montoRaw:String(montoRaw??'').trim(),
        adicional:typeof numeric==='function'?numeric(addRaw):Number(addRaw)||0,
        adicionalRaw:String(addRaw??'').trim(),
        plazo:idx.plazo>=0?String(row[idx.plazo]??'').trim():'',
        ampliacion:idx.ampliacion>=0?String(row[idx.ampliacion]??'').trim():'',
        avance:firstPercent(avanceRaw),
        avanceRaw:String(avanceRaw??'').trim(),
        estado:idx.estado>=0?String(row[idx.estado]??'').replace(/\s+/g,' ').trim():'',
        obs:idx.obs>=0?String(row[idx.obs]??'').replace(/\s+/g,' ').trim():''
      };
      rows.push(item);
    }
    return rows;
  }

  function addCss(){if(document.querySelector('link[data-execution-css]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='execution.css?v=20261016-1';l.dataset.executionCss='1';document.head.appendChild(l);}

  function buildUI(){
    const tab=document.getElementById('tab-obras');if(!tab||document.getElementById('worksModeTabs'))return;
    const heading=tab.querySelector('.section-heading.plan-heading');
    const tabs=document.createElement('div');tabs.className='works-mode-tabs';tabs.id='worksModeTabs';tabs.innerHTML=`
      <button class="works-mode-tab active" data-works-mode="execution">Obras en ejecución <span class="mode-count" id="execTabCount"></span></button>
      <button class="works-mode-tab" data-works-mode="works">Obras a contratar <span class="mode-count" id="worksPlanCount"></span></button>
      <button class="works-mode-tab" data-works-mode="projects">Proyectos a contratar <span class="mode-count" id="projectsPlanCount"></span></button>`;
    heading.insertAdjacentElement('afterend',tabs);

    const view=document.createElement('section');view.id='executionView';view.className='execution-view';view.innerHTML=`
      <section class="panel execution-filters">
        <div class="execution-filter"><label for="execCity">Localidad</label><select id="execCity"><option value="ALL">Todas</option></select></div>
        <div class="execution-filter"><label for="execStatus">Estado actual</label><select id="execStatus"><option value="ALL">Todos</option></select></div>
        <div class="execution-filter"><label for="execContractor">Contratista</label><select id="execContractor"><option value="ALL">Todos</option></select></div>
        <div class="execution-filter"><label for="execSearch">Buscar</label><input id="execSearch" type="search" placeholder="Buscar obra, localidad o contratista…"></div>
      </section>
      <section class="execution-kpis">
        <article class="kpi-card execution-kpi"><span class="execution-kpi-label">Obras relevadas</span><strong id="execKpiCount">0</strong><small>En ejecución</small></article>
        <article class="kpi-card execution-kpi"><span class="execution-kpi-label">Monto contratado</span><strong id="execKpiAmount">$ 0</strong><small>Según filtros aplicados</small></article>
        <article class="kpi-card execution-kpi progress-kpi"><span class="execution-kpi-label">Avance promedio</span><strong id="execKpiProgress">0,00 %</strong><small>Promedio de avance actual</small></article>
        <article class="kpi-card execution-kpi"><span class="execution-kpi-label">Contratistas</span><strong id="execKpiContractors">0</strong><small>Empresas registradas</small></article>
        <article class="kpi-card execution-kpi critical-kpi"><span class="execution-kpi-label">Estados críticos</span><strong id="execKpiCritical">0</strong><small>Paralizadas, rescindidas o sin adjudicar</small></article>
      </section>
      <section class="execution-main">
        <article class="panel execution-table-panel">
          <div class="panel-title execution-table-title"><div><h3>Detalle de obras en ejecución</h3><p>Información principal de seguimiento</p></div><small id="execTableCount"></small></div>
          <div class="execution-table-wrap"><table class="execution-table"><thead><tr><th>Nombre</th><th>Localidad</th><th>Contratista</th><th>Monto contratado</th><th>Plazo</th><th>Avance actual</th><th>Estado actual</th></tr></thead><tbody id="execBody"></tbody></table></div>
        </article>
        <div class="execution-side">
          <article class="panel"><div class="panel-title"><div><h3>Estado actual</h3><p>Distribución de obras por estado</p></div></div><div class="execution-chart-wrap"><canvas id="execStatusChart"></canvas></div></article>
          <article class="panel"><div class="panel-title"><div><h3>Avance por obra</h3><p>Principales obras por mayor avance actual</p></div></div><div class="execution-chart-wrap tall"><canvas id="execAdvanceChart"></canvas></div></article>
          <article class="panel"><div class="panel-title"><div><h3>Obras destacadas</h3><p>Mayores avances registrados</p></div></div><div id="execHighlights" class="execution-highlight-list"></div></article>
        </div>
      </section>`;
    tabs.insertAdjacentElement('afterend',view);

    const typeFilter=document.getElementById('planTypeFilter');if(typeFilter&&typeFilter.closest('.filter-group'))typeFilter.closest('.filter-group').style.display='none';
    tabs.querySelectorAll('[data-works-mode]').forEach(btn=>btn.addEventListener('click',()=>switchMode(btn.dataset.worksMode)));
    ['execCity','execStatus','execContractor'].forEach(id=>document.getElementById(id).addEventListener('change',renderExecution));
    document.getElementById('execSearch').addEventListener('input',renderExecution);
  }

  function planSections(){const tab=document.getElementById('tab-obras');return [tab.querySelector('.plan-filters'),tab.querySelector('.plan-kpis'),tab.querySelector('.plan-main-grid'),tab.querySelector('.plan-table-panel')].filter(Boolean);}
  function switchMode(mode){
    execState.mode=mode;
    document.querySelectorAll('.works-mode-tab').forEach(b=>b.classList.toggle('active',b.dataset.worksMode===mode));
    const exec=document.getElementById('executionView');
    const plan=planSections();
    const h=document.querySelector('#tab-obras .plan-heading h2');const p=document.querySelector('#tab-obras .plan-heading p');
    if(mode==='execution'){
      exec.hidden=false;plan.forEach(x=>x.classList.add('works-plan-hidden'));
      if(h)h.textContent='Obras en ejecución';if(p)p.textContent='Seguimiento de obras EPAS · estado de ejecución y avance actualizado';
      if(!execState.loaded)loadExecution();else renderExecution();
    }else{
      exec.hidden=true;plan.forEach(x=>x.classList.remove('works-plan-hidden'));
      const type=document.getElementById('planTypeFilter');
      if(type){type.value=mode==='works'?'OBRA':'PROYECTO';}
      if(typeof state!=='undefined')state.planTableMode=mode==='works'?'OBRA':'PROYECTO';
      if(h)h.textContent=mode==='works'?'Obras a contratar':'Proyectos a contratar';
      if(p)p.textContent=mode==='works'?'Cartera de obras EPAS · programación de inversión 2026–2029':'Cartera de proyectos EPAS · programación de contratación 2026–2029';
      try{if(typeof renderPlan==='function')renderPlan();setTimeout(()=>{if(typeof refreshPlanMapView==='function')refreshPlanMapView();},120);}catch(e){console.warn(e);}
    }
  }

  function fillFilters(){
    const rows=execState.rows;
    const city=[...new Set(rows.map(x=>x.localidad).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    const contractor=[...new Set(rows.map(x=>x.contratista).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    const status=[...new Set(rows.map(x=>x.estado).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    document.getElementById('execCity').innerHTML='<option value="ALL">Todas</option>'+city.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    document.getElementById('execContractor').innerHTML='<option value="ALL">Todos</option>'+contractor.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    document.getElementById('execStatus').innerHTML='<option value="ALL">Todos</option>'+status.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  }
  function filtered(){
    const c=document.getElementById('execCity').value,s=document.getElementById('execStatus').value,k=document.getElementById('execContractor').value,q=norm(document.getElementById('execSearch').value);
    return execState.rows.filter(x=>(c==='ALL'||x.localidad===c)&&(s==='ALL'||x.estado===s)&&(k==='ALL'||x.contratista===k)&&(!q||norm(`${x.nombre} ${x.localidad} ${x.contratista} ${x.estado}`).includes(q)));
  }
  function destroy(name){try{if(typeof state!=='undefined'&&state.charts&&state.charts[name]){state.charts[name].destroy();state.charts[name]=null;}}catch(e){}}
  function renderCharts(rows){
    if(typeof Chart==='undefined'||typeof state==='undefined')return;
    const groups=new Map();rows.forEach(x=>{const key=x.estado||'Sin estado';groups.set(key,(groups.get(key)||0)+1);});
    const statusData=[...groups.entries()].sort((a,b)=>b[1]-a[1]).slice(0,7);
    destroy('execStatusChart');
    const sctx=document.getElementById('execStatusChart');if(sctx)state.charts.execStatusChart=new Chart(sctx,{type:'doughnut',data:{labels:statusData.map(x=>x[0]),datasets:[{data:statusData.map(x=>x[1]),backgroundColor:['#1688f0','#f5a623','#26b576','#e74c3c','#9aa9b5','#7b61ff','#47b8c4'],borderColor:'#fff',borderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right',labels:{boxWidth:10,usePointStyle:true,font:{size:10}}}}}});
    const top=[...rows].filter(x=>x.avance!=null).sort((a,b)=>b.avance-a.avance).slice(0,8);
    destroy('execAdvanceChart');const actx=document.getElementById('execAdvanceChart');if(actx)state.charts.execAdvanceChart=new Chart(actx,{type:'bar',data:{labels:top.map(x=>`${x.localidad} · ${x.nombre}`),datasets:[{data:top.map(x=>x.avance),backgroundColor:'#61afe5',borderRadius:6,maxBarThickness:24}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtPct(c.raw)}}},scales:{x:{min:0,max:100,ticks:{callback:v=>v+' %'},grid:{display:true}},y:{grid:{display:false},ticks:{font:{size:9},callback:function(v){const l=this.getLabelForValue(v);return l.length>38?l.slice(0,38)+'…':l;}}}}}});
  }
  function renderExecution(){
    if(!document.getElementById('executionView'))return;
    const rows=filtered();const amount=rows.reduce((s,x)=>s+x.monto,0);const progresses=rows.map(x=>x.avance).filter(v=>v!=null);const avg=progresses.length?progresses.reduce((a,b)=>a+b,0)/progresses.length:0;const contractors=new Set(rows.map(x=>x.contratista).filter(Boolean));
    document.getElementById('execKpiCount').textContent=rows.length;
    document.getElementById('execKpiAmount').textContent=compactMoney(amount);
    document.getElementById('execKpiProgress').textContent=fmtPct(avg);
    document.getElementById('execKpiContractors').textContent=contractors.size;
    document.getElementById('execKpiCritical').textContent=rows.filter(x=>isCritical(x.estado)).length;
    document.getElementById('execTableCount').textContent=`${rows.length} obra${rows.length===1?'':'s'}`;
    const body=document.getElementById('execBody');
    if(!rows.length){body.innerHTML='<tr><td colspan="7"><div class="execution-empty">La hoja “Obras en ejecución” todavía no tiene registros disponibles en Google Sheets.</div></td></tr>';renderCharts([]);document.getElementById('execHighlights').innerHTML='<div class="execution-empty">Sin datos para mostrar.</div>';return;}
    body.innerHTML=rows.map(x=>{
      const obraTip=[x.ampliacion?`Ampliación de plazo: ${x.ampliacion} días`:'',x.adicionalRaw?`Monto adicional: ${x.adicional?money(x.adicional):esc(x.adicionalRaw)}`:''].filter(Boolean).join(' · ')||'Sin ampliación de plazo ni monto adicional informado';
      const obsTip=x.obs||'Sin observaciones informadas';
      const pct=x.avance==null?0:x.avance;
      return `<tr><td class="exec-name exec-tooltip" data-tip="${esc(obraTip)}">${esc(x.nombre)}</td><td>${esc(x.localidad)}</td><td>${esc(x.contratista||'—')}</td><td class="exec-money">${x.monto?money(x.monto):'—'}</td><td class="exec-plazo">${esc(x.plazo||'—')}${x.plazo&&!/DIA|MES/i.test(x.plazo)?' días':''}</td><td class="execution-progress-cell exec-tooltip" data-tip="${esc(obsTip)}"><div class="execution-progress-line"><div class="execution-progress-track"><div class="execution-progress-fill ${progressClass(pct)}" style="width:${pct}%"></div></div><span class="execution-progress-value">${fmtPct(x.avance)}</span></div></td><td><span class="execution-status ${statusClass(x.estado)}">${esc(x.estado||'Sin estado')}</span></td></tr>`;
    }).join('');
    renderCharts(rows);
    const hi=[...rows].filter(x=>x.avance!=null).sort((a,b)=>b.avance-a.avance).slice(0,5);document.getElementById('execHighlights').innerHTML=hi.map((x,i)=>`<div class="execution-highlight"><span class="rank">${i+1}</span><div class="work"><strong>${esc(x.nombre)}</strong><small>${esc(x.localidad)} · ${esc(x.contratista||'—')}</small></div><div><div class="mini-bar"><span style="width:${x.avance}%"></span></div><small>${fmtPct(x.avance)}</small></div></div>`).join('')||'<div class="execution-empty">Sin avances registrados.</div>';
  }

  async function loadExecution(){
    try{
      const matrix=typeof loadGvizJsonp==='function'?await loadGvizJsonp(EXEC_SHEET_ID,EXEC_GID):[];
      execState.rows=parseMatrix(matrix);execState.loaded=true;fillFilters();renderExecution();document.getElementById('execTabCount').textContent=`(${execState.rows.length})`;
    }catch(err){console.error('Obras en ejecución:',err);execState.rows=[];execState.loaded=true;fillFilters();renderExecution();}
  }
  function syncPlanCounts(){try{document.getElementById('worksPlanCount').textContent=`(${state.works.length})`;document.getElementById('projectsPlanCount').textContent=`(${state.projects.length})`;}catch(e){}}

  function init(){addCss();buildUI();syncPlanCounts();switchMode('execution');setTimeout(syncPlanCounts,1200);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
