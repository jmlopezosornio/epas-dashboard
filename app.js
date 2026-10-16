const COBRANZA_FILE = 'data/Para_Tablero_EPAS.xlsx';
const WORKS_FILE = 'data/Base_para_DASBOARD_EPAS.xlsx'; // respaldo local del nuevo plan
const CONTRACTS_FILE = 'data/Contratos_vigentes_cuadrillas_servicios.xlsx'; // respaldo local

const SHEETS_ID = '1ofq-ks49qWistGB6b2cN7NzuC8mj5kOZ1XTkwkF41d8';
const PLAN_SHEETS_ID = '1t1gopI3Iy6tB5DC-2wJEjrLJeDUFKmxG9azBHlYbhGM';
const PLAN_GID = '0';
const planSheetCsvUrl = () => `https://docs.google.com/spreadsheets/d/${PLAN_SHEETS_ID}/gviz/tq?tqx=out:csv&gid=${PLAN_GID}&_=${Date.now()}`;
const SHEETS = {
  works: { name:'OBRAS', gid:'0' },
  contracts: { name:'CONTRATOS', gid:'208468695' },
  process: { name:'EN PROCESO', gid:'852070695' }
};
const sheetCsvUrl = gid => `https://docs.google.com/spreadsheets/d/${SHEETS_ID}/gviz/tq?tqx=out:csv&gid=${gid}&_=${Date.now()}`;

const ARS = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 });
const NUM = new Intl.NumberFormat('es-AR', { maximumFractionDigits:0 });
const PCT = new Intl.NumberFormat('es-AR', { minimumFractionDigits:1, maximumFractionDigits:1 });
const DATE_FMT = new Intl.DateTimeFormat('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' });

const state = { collection:{period:'—',rows:[],cities:[]}, works:[], projects:[], planTableMode:'OBRA', planMap:null, planLayer:null, contracts:[], processContracts:[], charts:{} };

function cleanText(v){ return String(v ?? '').replace(/\s+/g,' ').trim(); }
function toSmartTitleCase(value){
  const raw = cleanText(value);
  if(!raw) return '';
  const lowerWords = new Set(['de','del','la','las','el','los','y','e','en','a','al','por','para','con','sin']);
  return raw.split(/(\s+|\/|-|\(|\))/).map((part, idx)=>{
    if(!part || /^(\s+|\/|-|\(|\))$/.test(part)) return part;
    if(/[0-9]/.test(part)) return part.toUpperCase();
    const clean = part.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(/^[A-ZÁÉÍÓÚÜÑ]{2,}$/.test(part) && clean.length <= 5) return part.toUpperCase();
    const word = part.toLowerCase();
    if(idx !== 0 && lowerWords.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join('');
}
function numeric(v){ if(typeof v==='string'){ const n=Number(v.replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'')); return Number.isFinite(n)?n:0; } const n=Number(v); return Number.isFinite(n)?n:0; }
function escapeHtml(s){ return String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function fmtMoney(v){ return ARS.format(numeric(v)); }
function fmtCompactMoney(v){ const n=numeric(v),a=Math.abs(n); if(a>=1e9)return `$ ${PCT.format(n/1e9)} mil M`; if(a>=1e6)return `$ ${PCT.format(n/1e6)} M`; return fmtMoney(n); }
function fmtDate(d){ return d instanceof Date&&!isNaN(d)?DATE_FMT.format(d):'—'; }
function updateTimestamp(el){ el.textContent=`Actualizado ${new Date().toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'})}`; }
function startOfToday(){ const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
function daysBetween(a,b){ return Math.ceil((b-a)/86400000); }
function staffNumber(v){ const s=cleanText(v); if(!s)return 0; const nums=[...s.matchAll(/\d+/g)].map(m=>Number(m[0])); return nums.reduce((a,b)=>a+b,0); }

for(const btn of document.querySelectorAll('.tab-button')) btn.addEventListener('click',()=>{document.querySelectorAll('.tab-button').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(s=>s.classList.remove('active'));btn.classList.add('active');document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');setTimeout(()=>Object.values(state.charts).forEach(c=>c?.resize()),50);});
for(const btn of document.querySelectorAll('.subtab-button[data-contract-view]')) btn.addEventListener('click',()=>{document.querySelectorAll('.subtab-button[data-contract-view]').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.contract-view').forEach(s=>s.classList.remove('active'));btn.classList.add('active');document.getElementById(`contract-view-${btn.dataset.contractView}`).classList.add('active');setTimeout(()=>Object.values(state.charts).forEach(c=>c?.resize()),50);});

async function loadArrayBuffer(url){ const response=await fetch(url,{cache:'no-store'}); if(!response.ok)throw new Error(`No se pudo cargar ${url}`); return response.arrayBuffer(); }
async function loadText(url){ const response=await fetch(url,{cache:'no-store'}); if(!response.ok)throw new Error(`No se pudo consultar Google Sheets (${response.status})`); return response.text(); }
async function loadGvizJsonp(spreadsheetId,gid){
  return new Promise((resolve,reject)=>{
    const cb=`__epasGviz_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script=document.createElement('script');
    const timer=setTimeout(()=>{cleanup();reject(new Error('Tiempo de espera agotado al consultar Google Sheets'));},12000);
    function cleanup(){clearTimeout(timer);delete window[cb];script.remove();}
    window[cb]=(payload)=>{try{
      if(!payload||payload.status==='error'||!payload.table)throw new Error('Respuesta inválida de Google Sheets');
      const cols=(payload.table.cols||[]).length;
      const matrix=(payload.table.rows||[]).map(r=>Array.from({length:cols},(_,i)=>{
        const c=r.c?.[i];
        if(!c)return '';
        if(c.f!=null&&c.f!=='')return c.f;
        return c.v==null?'':c.v;
      }));
      cleanup();resolve(matrix);
    }catch(e){cleanup();reject(e);}};
    script.onerror=()=>{cleanup();reject(new Error('No se pudo cargar Google Sheets'));};
    script.src=`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?gid=${encodeURIComponent(gid)}&tqx=responseHandler:${cb}&headers=0&_=${Date.now()}`;
    document.head.appendChild(script);
  });
}
function parseCSV(text){ const rows=[]; let row=[],cell='',quoted=false; for(let i=0;i<text.length;i++){ const c=text[i]; if(quoted){ if(c==='\"'&&text[i+1]==='\"'){cell+='\"';i++;} else if(c==='\"')quoted=false; else cell+=c; } else { if(c==='\"')quoted=true; else if(c===','){row.push(cell);cell='';} else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell='';} else if(c!=='\r')cell+=c; } } row.push(cell); if(row.some(v=>v!==''))rows.push(row); return rows; }
function normalizeLocality(v){ const s=cleanText(v); const k=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(); const map={'NQN':'Neuquén','NEUQUEN':'Neuquén','TAQUIMILAN':'Taquimilán','JUNIN DE LOS ANDES':'Junín de los Andes','VILLA LA ANGOSTURA':'Villa La Angostura','CHOS MALAL':'Chos Malal','EL ALAMITO':'El Alamito','EL CHOLAR':'El Cholar','LAS OVEJAS':'Las Ovejas','PICUN LEUFU':'Picún Leufú','SAN MARTIN DE LOS ANDES':'San Martín de los Andes','TRICAO MALAL':'Tricao Malal','PLOTTIER':'Plottier','ANELO':'Añelo','VARVARCO':'Varvarco'}; return map[k]||toSmartTitleCase(s)||'Sin localidad'; }
function excelDateToJS(v){ if(v instanceof Date)return new Date(v.getFullYear(),v.getMonth(),v.getDate()); if(typeof v==='number'){const p=XLSX.SSF.parse_date_code(v);if(p)return new Date(p.y,p.m-1,p.d);} if(typeof v==='string'&&v.trim()){const s=v.trim();const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);if(m){const y=+m[3]<100?2000+(+m[3]):+m[3];return new Date(y,+m[2]-1,+m[1]);}const d=new Date(s);if(!isNaN(d))return d;} return null; }
function parseDateFromText(v){ const s=cleanText(v); const m=s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); return m?new Date(+m[3],+m[2]-1,+m[1]):null; }
function destroyChart(name){if(state.charts[name]){state.charts[name].destroy();state.charts[name]=null;}}
function createBar(name,canvasId,labels,data,horizontal=false){destroyChart(name);const scales=horizontal?{x:{grid:{display:true},ticks:{callback:v=>fmtCompactMoney(v)}},y:{grid:{display:false},ticks:{callback:function(v){return this.getLabelForValue(v);}}}}:{x:{grid:{display:false}},y:{grid:{display:true},ticks:{callback:v=>fmtCompactMoney(v)}}};state.charts[name]=new Chart(document.getElementById(canvasId),{type:'bar',data:{labels,datasets:[{data,borderRadius:7,maxBarThickness:52}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:horizontal?'y':'x',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtMoney(c.raw)}}},scales}});}
function createDoughnut(name,canvasId,labels,data){destroyChart(name);state.charts[name]=new Chart(document.getElementById(canvasId),{type:'doughnut',data:{labels,datasets:[{data,borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${fmtMoney(c.raw)}`}}}}});}

// Cobranza
function parseCollection(buffer){const wb=XLSX.read(buffer,{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]],matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});if(!matrix.length)throw new Error('El Excel de cobranza está vacío.');const header=matrix[0].map(cleanText),agentIdx=header.findIndex(h=>h.toLowerCase()==='agente de cobro'),totalIdx=header.findIndex(h=>h.toLowerCase()==='total general');if(agentIdx<0||totalIdx<0||totalIdx<=agentIdx)throw new Error('No encuentro las columnas “Agente de cobro” y “Total General”.');const period=cleanText(matrix[0][0])||'—',cities=header.slice(agentIdx+1,totalIdx).filter(Boolean),rows=[];for(let r=1;r<matrix.length;r++){const agent=cleanText(matrix[r][agentIdx]);if(!agent||/^total/i.test(agent))continue;cities.forEach((city,i)=>{const amount=numeric(matrix[r][agentIdx+1+i]);if(amount!==0)rows.push({agent,city,amount});});}return{period,cities,rows};}
function populateCollectionFilters(){const citySel=document.getElementById('cityFilter'),channelSel=document.getElementById('channelFilter'),currentCity=citySel.value,currentChannel=channelSel.value;citySel.innerHTML='<option value="ALL">Todas</option>'+state.collection.cities.map(c=>`<option>${escapeHtml(c)}</option>`).join('');const agents=[...new Set(state.collection.rows.map(r=>r.agent))].sort((a,b)=>a.localeCompare(b,'es'));channelSel.innerHTML='<option value="ALL">Todos</option>'+agents.map(a=>`<option>${escapeHtml(a)}</option>`).join('');if([...citySel.options].some(o=>o.value===currentCity))citySel.value=currentCity;if([...channelSel.options].some(o=>o.value===currentChannel))channelSel.value=currentChannel;}
function aggregate(rows,key){const m=new Map();rows.forEach(r=>m.set(r[key],(m.get(r[key])||0)+r.amount));return[...m.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);}
function renderCollection(){const city=document.getElementById('cityFilter').value,agent=document.getElementById('channelFilter').value,rows=state.collection.rows.filter(r=>(city==='ALL'||r.city===city)&&(agent==='ALL'||r.agent===agent)),total=rows.reduce((s,r)=>s+r.amount,0),byCity=aggregate(rows,'city'),byAgent=aggregate(rows,'agent');document.getElementById('periodTitle').textContent=`Período ${state.collection.period}`;document.getElementById('periodFilter').textContent=state.collection.period;document.getElementById('kpiCollected').textContent=fmtCompactMoney(total);document.getElementById('kpiTopChannel').textContent=byAgent[0]?.name||'—';document.getElementById('kpiTopChannelShare').textContent=byAgent[0]&&total?`${PCT.format(byAgent[0].value/total*100)} % del total`:'—';document.getElementById('kpiTopCity').textContent=byCity[0]?.name||'—';document.getElementById('kpiTopCityAmount').textContent=byCity[0]?fmtCompactMoney(byCity[0].value):'—';document.getElementById('kpiCities').textContent=NUM.format(byCity.filter(x=>x.value>0).length);document.getElementById('tableTotal').textContent=`Total: ${fmtMoney(total)}`;createBar('cityChart','cityChart',byCity.map(x=>x.name),byCity.map(x=>x.value),byCity.length>=6);createBar('channelChart','channelChart',byAgent.slice(0,10).map(x=>x.name),byAgent.slice(0,10).map(x=>x.value),true);createDoughnut('cityShareChart','cityShareChart',byCity.map(x=>x.name),byCity.map(x=>x.value));const body=document.getElementById('detailBody'),sorted=[...rows].sort((a,b)=>b.amount-a.amount);body.innerHTML=sorted.length?sorted.map(r=>`<tr><td>${escapeHtml(r.agent)}</td><td>${escapeHtml(r.city)}</td><td class="numeric">${fmtMoney(r.amount)}</td><td class="numeric">${total?PCT.format(r.amount/total*100):'0,0'} %</td></tr>`).join(''):'<tr><td class="empty-row" colspan="4">Sin datos para los filtros seleccionados.</td></tr>';}
async function loadDefaultCollection(){const status=document.getElementById('fileStatus');status.textContent='Cargando archivo base…';try{const b=await loadArrayBuffer(COBRANZA_FILE);state.collection=parseCollection(b);populateCollectionFilters();renderCollection();status.textContent='Archivo base de cobranza cargado';updateTimestamp(document.getElementById('lastUpdate'));}catch(e){status.textContent=`Error: ${e.message}`;console.error(e);}}

// Plan de Obras y Proyectos
function normalizePlanSystem(v){const s=cleanText(v);if(!s)return'—';const k=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(); const map={'CLOACA':'Cloaca','CLOACAL':'Cloaca','SANEAMIENTO':'Cloaca','DESAGUES CLOACALES':'Cloaca','AGUA':'Agua','AGUA POTABLE':'Agua','OTROS':'Otros','OTRO':'Otros','MIXTO':'Mixto'}; return map[k] || toSmartTitleCase(s);}
function parsePlanRow(row,type){const localidad=normalizeLocality(row[0]),denominacion=toSmartTitleCase(row[1]),sistema=normalizePlanSystem(row[2]);if(!localidad||localidad==='Sin localidad'||!denominacion)return null;return{type,localidad,denominacion,sistema,presupuesto:numeric(row[3]),plazo:cleanText(row[4])||'—',anio:cleanText(row[5])||'—',inv2027:numeric(row[6]),inv2028:numeric(row[7]),inv2029:numeric(row[8]),expediente:cleanText(row[9])||'Sin expediente'};}
function parsePlanMatrix(matrix){const works=[],projects=[];let mode=null;for(let r=0;r<matrix.length;r++){const first=cleanText(matrix[r]?.[0]).toUpperCase();if(first==='OBRAS A EJECUTAR'){mode='WAIT_WORK_HEADER';continue;}if(first==='PROYECTOS A CONTRATAR'){mode='WAIT_PROJECT_HEADER';continue;}if(mode==='WAIT_WORK_HEADER'){if(first==='LOCALIDAD')mode='WORKS';continue;}if(mode==='WAIT_PROJECT_HEADER'){if(first==='LOCALIDAD')mode='PROJECTS';continue;}if(mode==='WORKS'){if(!first||first.includes('TOTAL'))continue;const item=parsePlanRow(matrix[r],'OBRA');if(item)works.push(item);}else if(mode==='PROJECTS'){if(!first||first.startsWith('SUBTOTALES')||first.startsWith('TOTALES'))continue;const item=parsePlanRow(matrix[r],'PROYECTO');if(item)projects.push(item);}}return{works,projects};}
function parsePlanCSV(text){return parsePlanMatrix(parseCSV(text));}
function parsePlanXlsx(buffer){const wb=XLSX.read(buffer,{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]],matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});return parsePlanMatrix(matrix);}
function hasExpediente(x){return /^EX-/i.test(cleanText(x.expediente));}
function planAll(){return [...state.works,...state.projects];}
function populatePlanFilters(){const rows=planAll(),city=document.getElementById('planCityFilter'),sys=document.getElementById('planSystemFilter'),curCity=city.value,curSys=sys.value;const cities=[...new Set(rows.map(x=>x.localidad))].sort((a,b)=>a.localeCompare(b,'es'));const systems=[...new Set(rows.map(x=>x.sistema).filter(x=>x&&x!=='—'))].sort((a,b)=>a.localeCompare(b,'es'));city.innerHTML='<option value="ALL">Todas</option>'+cities.map(x=>`<option>${escapeHtml(x)}</option>`).join('');sys.innerHTML='<option value="ALL">Todos</option>'+systems.map(x=>`<option>${escapeHtml(x)}</option>`).join('');if([...city.options].some(o=>o.value===curCity))city.value=curCity;if([...sys.options].some(o=>o.value===curSys))sys.value=curSys;}
function filteredPlanRows(){const city=document.getElementById('planCityFilter').value,type=document.getElementById('planTypeFilter').value,sys=document.getElementById('planSystemFilter').value,year=document.getElementById('planYearFilter').value,exp=document.getElementById('planExpFilter').value,q=cleanText(document.getElementById('planSearch').value).toLowerCase();return planAll().filter(x=>(city==='ALL'||x.localidad===city)&&(type==='ALL'||x.type===type)&&(sys==='ALL'||x.sistema===sys)&&(year==='ALL'||x.anio.includes(year))&&(exp==='ALL'||(exp==='CON'?hasExpediente(x):!hasExpediente(x)))&&(!q||`${x.localidad} ${x.denominacion} ${x.expediente}`.toLowerCase().includes(q)));}
function aggregatePlan(rows,key,valueKey='presupuesto'){const m=new Map();rows.forEach(x=>m.set(x[key],(m.get(x[key])||0)+numeric(x[valueKey])));return[...m.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);}
function createPlanDoughnut(name,canvasId,labels,data){destroyChart(name);const el=document.getElementById(canvasId);if(!el)return;state.charts[name]=new Chart(el,{type:'doughnut',data:{labels,datasets:[{data,borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right',labels:{boxWidth:10,usePointStyle:true,font:{size:10}}}}}});}
function renderPlanCharts(rows){const byCity=aggregatePlan(rows,'localidad').slice(0,6);createBar('planCityBudgetChart','planCityBudgetChart',byCity.map(x=>x.name),byCity.map(x=>x.value),true);destroyChart('planInvestmentChart');state.charts.planInvestmentChart=new Chart(document.getElementById('planInvestmentChart'),{type:'bar',data:{labels:['2027','2028','2029'],datasets:[{data:[rows.reduce((s,x)=>s+x.inv2027,0),rows.reduce((s,x)=>s+x.inv2028,0),rows.reduce((s,x)=>s+x.inv2029,0)],borderRadius:7,maxBarThickness:58}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtMoney(c.raw)}}},scales:{y:{ticks:{callback:v=>fmtCompactMoney(v)}}}}});const works=rows.filter(x=>x.type==='OBRA'),projects=rows.filter(x=>x.type==='PROYECTO');createPlanDoughnut('planTypeChart','planTypeChart',['Obras','Proyectos a contratar'],[works.length,projects.length]);const sysCount=new Map();works.forEach(x=>sysCount.set(x.sistema,(sysCount.get(x.sistema)||0)+1));createPlanDoughnut('planSystemChart','planSystemChart',[...sysCount.keys()],[...sysCount.values()]);const con=works.filter(hasExpediente).length,sin=works.length-con;document.getElementById('planExpSummary').innerHTML=`<div class="exp-box good"><strong>${con}</strong><span>Con expediente</span><small>${works.length?PCT.format(con/works.length*100):'0,0'} % de obras</small></div><div class="exp-box pending"><strong>${sin}</strong><span>Sin expediente</span><small>${works.length?PCT.format(sin/works.length*100):'0,0'} % de obras</small></div>`;}
const PLAN_COORDS={
'NEUQUEN':[-38.9516,-68.0591],'PICUN LEUFU':[-39.5238,-69.2797],'PLOTTIER':[-38.9667,-68.2333],'TRICAO MALAL':[-37.0455,-70.3350],'VARVARCO':[-36.8568,-70.6806],'CHOS MALAL':[-37.3781,-70.2709],'LAS OVEJAS':[-36.9895,-70.7498],'VILLA LA ANGOSTURA':[-40.7618,-71.6463],'SAN MARTIN DE LOS ANDES':[-40.1572,-71.3524],'ANELO':[-38.3546,-68.7884],'JUNIN DE LOS ANDES':[-39.9504,-71.0694],'EL ALAMITO':[-37.2465,-70.3930],'EL CHOLAR':[-37.4428,-70.6436],'OCTAVIO PICO':[-37.5865,-68.2686],'TAQUIMILAN':[-37.5175,-70.2488],'LOS MENUCOS':[-37.13388,-70.40535],'VILLA TRAFUL':[-40.6550,-71.4078],'EL CHOCON':[-39.2594,-68.7795]};
function mapKey(v){return cleanText(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\./g,'').replace(/\s+/g,' ').trim();}
function initPlanMap(){ /* mapa SVG local: no requiere proveedor externo */ }
function projectPlanCoords(coords){
  const lat=coords[0],lon=coords[1];
  const latMax=-35.85,latMin=-41.28,lonMin=-71.95,lonMax=-67.45;
  const x=6 + ((lon-lonMin)/(lonMax-lonMin))*88;
  const y=5 + ((latMax-lat)/(latMax-latMin))*90;
  return {x:Math.max(3,Math.min(97,x)),y:Math.max(3,Math.min(97,y))};
}
function renderPlanMap(rows){
  const groups=new Map();
  rows.forEach(x=>{const key=mapKey(x.localidad),coords=PLAN_COORDS[key];if(!coords)return;if(!groups.has(key))groups.set(key,{key,name:x.localidad,coords,works:0,projects:0});const g=groups.get(key);x.type==='OBRA'?g.works++:g.projects++;});
  const data=[...groups.values()].sort((a,b)=>(b.works+b.projects)-(a.works+a.projects)||a.name.localeCompare(b.name,'es'));
  const list=document.getElementById('planLocationList');
  list.innerHTML=data.length?data.map(g=>`<button class="plan-location-item" data-plan-locality="${escapeHtml(g.key)}"><span>${escapeHtml(g.name)}</span><strong>${g.works+g.projects}</strong></button>`).join(''):'<div class="map-empty">Sin localidades georreferenciadas.</div>';
  const layer=document.getElementById('planMarkerLayer');if(!layer)return;
  layer.innerHTML=data.map(g=>{const total=g.works+g.projects,cls=g.works&&g.projects?'both':g.projects?'project':'work',p=projectPlanCoords(g.coords);return `<button class="static-map-marker ${cls}" style="left:${p.x}%;top:${p.y}%" data-plan-locality="${escapeHtml(g.key)}" aria-label="${escapeHtml(g.name)}"><span>${total}</span><span class="map-tip">${escapeHtml(g.name)} · ${g.works} obras · ${g.projects} proyectos</span></button>`;}).join('');
  const focus=(key)=>{const g=groups.get(key);if(!g)return;document.getElementById('planCityFilter').value=g.name;renderPlan();};
  list.querySelectorAll('[data-plan-locality]').forEach(btn=>btn.addEventListener('click',()=>focus(btn.dataset.planLocality)));
  layer.querySelectorAll('[data-plan-locality]').forEach(btn=>btn.addEventListener('click',()=>focus(btn.dataset.planLocality)));
}
function renderPlanTable(rows){const tableRows=rows.filter(x=>x.type===state.planTableMode),body=document.getElementById('planDetailBody');document.getElementById('planWorksTabCount').textContent=`(${rows.filter(x=>x.type==='OBRA').length})`;document.getElementById('planProjectsTabCount').textContent=`(${rows.filter(x=>x.type==='PROYECTO').length})`;body.innerHTML=tableRows.length?tableRows.map(x=>`<tr><td>${escapeHtml(x.localidad)}</td><td class="work-name">${escapeHtml(x.denominacion)}</td><td><span class="system-pill">${escapeHtml(x.sistema)}</span></td><td class="numeric">${fmtMoney(x.presupuesto)}</td><td>${escapeHtml(x.plazo)}</td><td>${escapeHtml(x.anio)}</td><td class="numeric">${x.inv2027?fmtMoney(x.inv2027):'—'}</td><td class="numeric">${x.inv2028?fmtMoney(x.inv2028):'—'}</td><td class="numeric">${x.inv2029?fmtMoney(x.inv2029):'—'}</td><td class="exp-cell ${hasExpediente(x)?'':'no-exp'}">${hasExpediente(x)?escapeHtml(x.expediente):'Sin expediente'}</td></tr>`).join(''):'<tr><td class="empty-row" colspan="10">Sin registros para los filtros seleccionados.</td></tr>';}
function renderPlan(){const rows=filteredPlanRows(),works=rows.filter(x=>x.type==='OBRA'),projects=rows.filter(x=>x.type==='PROYECTO'),cities=new Set(rows.map(x=>x.localidad));document.getElementById('kpiPlanWorks').textContent=NUM.format(works.length);document.getElementById('kpiPlanProjects').textContent=NUM.format(projects.length);document.getElementById('kpiPlanCities').textContent=NUM.format(cities.size);document.getElementById('kpiPlanBudget').textContent=fmtCompactMoney(rows.reduce((s,x)=>s+x.presupuesto,0));document.getElementById('kpiPlan2027').textContent=fmtCompactMoney(rows.reduce((s,x)=>s+x.inv2027,0));document.getElementById('worksBadge').textContent=works.length+projects.length;renderPlanCharts(rows);renderPlanMap(rows);renderPlanTable(rows);}
async function loadDefaultWorks(){
  const status=document.getElementById('worksFileStatus');
  if(status)status.textContent='Actualizando plan desde Google Sheets…';
  try{
    const matrix=await loadGvizJsonp(PLAN_SHEETS_ID,PLAN_GID);
    const data=parsePlanMatrix(matrix);
    if(!data.works.length&&!data.projects.length)throw new Error('La hoja no devolvió registros');
    state.works=data.works;state.projects=data.projects;populatePlanFilters();renderPlan();
    if(status)status.textContent=`Google Sheets conectado · ${data.works.length} obras · ${data.projects.length} proyectos`;
    {const el=document.getElementById('worksLastUpdate');if(el)updateTimestamp(el);}
  }catch(jsonpError){
    console.warn('GViz JSONP no disponible:',jsonpError);
    try{
      const text=await loadText(planSheetCsvUrl());
      const data=parsePlanCSV(text);
      if(!data.works.length&&!data.projects.length)throw new Error('La hoja CSV no devolvió registros');
      state.works=data.works;state.projects=data.projects;populatePlanFilters();renderPlan();
      if(status)status.textContent=`Google Sheets conectado · ${data.works.length} obras · ${data.projects.length} proyectos`;
      {const el=document.getElementById('worksLastUpdate');if(el)updateTimestamp(el);}
    }catch(csvError){
      console.warn('CSV de Google Sheets no disponible:',csvError);
      try{
        const b=await loadArrayBuffer(WORKS_FILE);const data=parsePlanXlsx(b);
        state.works=data.works;state.projects=data.projects;populatePlanFilters();renderPlan();
        if(status)status.textContent='Google Sheets no disponible · usando respaldo local';
        {const el=document.getElementById('worksLastUpdate');if(el)updateTimestamp(el);}
      }catch(localError){if(status)status.textContent=`Error al cargar datos: ${jsonpError.message}`;console.error(jsonpError,csvError,localError);}
    }
  }
}
function exportPlanCsv(){const rows=filteredPlanRows().filter(x=>x.type===state.planTableMode),header=['Localidad','Denominación','Sistema','Presupuesto','Plazo','Año de ejecución','Inv. 2027','Inv. 2028','Inv. 2029','Expediente'];const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;const csv='\ufeff'+[header,...rows.map(x=>[x.localidad,x.denominacion,x.sistema,x.presupuesto,x.plazo,x.anio,x.inv2027,x.inv2028,x.inv2029,x.expediente])].map(r=>r.map(esc).join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=state.planTableMode==='OBRA'?'obras_epas.csv':'proyectos_a_contratar_epas.csv';a.click();URL.revokeObjectURL(a.href);}

// Contratos y servicios
function parseContracts(buffer){
  const wb=XLSX.read(buffer,{type:'array',cellDates:true});
  const ws=wb.Sheets['Contratos']||wb.Sheets[wb.SheetNames[0]];
  const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});
  const out=[]; let last=null;
  for(let r=2;r<matrix.length;r++){
    const row=matrix[r],localidad=cleanText(row[0]),contrato=cleanText(row[1]),expediente=cleanText(row[2]);
    const inicio=excelDateToJS(row[6]),fin=excelDateToJS(row[7]);
    if(!localidad&&!contrato&&!expediente){
      if(last&&(inicio||fin)){ if(inicio)last.extensionStart=inicio; if(fin){last.extensionEnd=fin;last.finalEfectiva=fin;} }
      continue;
    }
    if(!contrato&&!expediente)continue;
    const note=cleanText(row[8]),textEnd=parseDateFromText(note);
    const item={localidad:normalizeLocality(localidad||'Sin localidad'),contrato:toSmartTitleCase(contrato),expediente,adjudicado:numeric(row[3]),empresa:cleanText(row[4])||'—',plazo:numeric(row[5]),inicio,final:fin,finalEfectiva:textEnd||fin,nuevaTramitacion:note,extensionStart:null,extensionEnd:null};
    out.push(item);last=item;
  }
  return out;
}
function parseProcessContracts(buffer){
  const wb=XLSX.read(buffer,{type:'array',cellDates:true}),ws=wb.Sheets['En proceso'];if(!ws)return[];
  const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true}),out=[];
  for(let r=2;r<matrix.length;r++){
    const row=matrix[r],contrato=cleanText(row[1]),expediente=cleanText(row[2]);if(!contrato&&!expediente)continue;
    out.push({localidad:normalizeLocality(cleanText(row[0])||'Sin localidad'),contrato:toSmartTitleCase(contrato),expediente,presupuesto:numeric(row[3]),adjudicado:numeric(row[4]),empresa:cleanText(row[6]),plazo:numeric(row[7]),inicio:excelDateToJS(row[11]),final:excelDateToJS(row[12])});
  }
  return out;
}

function parseContractsCSV(text){const matrix=parseCSV(text),out=[];let last=null;for(let r=1;r<matrix.length;r++){const row=matrix[r],localidad=cleanText(row[0]),contrato=cleanText(row[1]),expediente=cleanText(row[2]),inicio=excelDateToJS(row[6]),fin=excelDateToJS(row[7]);if(!localidad&&!contrato&&!expediente){if(last&&(inicio||fin)){if(inicio)last.extensionStart=inicio;if(fin){last.extensionEnd=fin;last.finalEfectiva=fin;}}continue;}if(!contrato&&!expediente)continue;const note=cleanText(row[8]),textEnd=parseDateFromText(note);const item={localidad:normalizeLocality(localidad),contrato:toSmartTitleCase(contrato),expediente,adjudicado:numeric(row[3]),empresa:cleanText(row[4])||'—',plazo:numeric(row[5]),inicio,final:fin,finalEfectiva:textEnd||fin,nuevaTramitacion:note,extensionStart:null,extensionEnd:null};out.push(item);last=item;}return out;}
function parseProcessContractsCSV(text){const matrix=parseCSV(text),out=[];for(let r=1;r<matrix.length;r++){const row=matrix[r],contrato=cleanText(row[1]),expediente=cleanText(row[2]);if(!contrato&&!expediente)continue;out.push({localidad:normalizeLocality(row[0]),contrato:toSmartTitleCase(contrato),expediente,presupuesto:numeric(row[3]),adjudicado:numeric(row[4]),empresa:cleanText(row[6]),plazo:numeric(row[7]),inicio:excelDateToJS(row[11]),final:excelDateToJS(row[12])});}return out;}
function renewalDaysText(c){
  const end=c.finalEfectiva;if(!end)return'—';
  const days=daysBetween(startOfToday(),end);
  if(days<0)return`Vencido hace ${Math.abs(days)} día${Math.abs(days)===1?'':'s'}`;
  if(days===0)return'Vence hoy';
  return`${days} día${days===1?'':'s'}`;
}
function contractStatus(c){
  const today=startOfToday(),end=c.finalEfectiva;
  if(c.nuevaTramitacion&&/^EX-/i.test(c.nuevaTramitacion)){
    let label='En renovación'; if(end){const d=daysBetween(today,end);label=d>=0?`En renovación · ${d} día${d===1?'':'s'}`:'En renovación';}
    return{code:'RENOVACION',label,cls:'renovacion'};
  }
  if(!end)return{code:'SIN_FECHA',label:'Sin fecha definida',cls:'sin-fecha'};
  const days=daysBetween(today,end);
  if(days<0)return{code:'VENCIDO',label:`Vencido hace ${Math.abs(days)} día${Math.abs(days)===1?'':'s'}`,cls:'vencido'};
  if(days<=30)return{code:'CRITICO',label:days===0?'Vence hoy':`Vence en ${days} día${days===1?'':'s'}`,cls:'critico'};
  if(days<=90)return{code:'PROXIMO',label:`Vence en ${days} días`,cls:'proximo'};
  return{code:'VIGENTE',label:'Vigente',cls:'vigente'};
}
function populateContractFilters(){
  const setOptions=(id,values)=>{const el=document.getElementById(id),cur=el.value;el.innerHTML='<option value="ALL">Todas</option>'+values.map(v=>`<option>${escapeHtml(v)}</option>`).join('');if([...el.options].some(o=>o.value===cur))el.value=cur;};
  setOptions('contractCityFilter',[...new Set(state.contracts.map(c=>c.localidad))].sort((a,b)=>a.localeCompare(b,'es')));
  setOptions('processCityFilter',[...new Set(state.processContracts.map(c=>c.localidad))].sort((a,b)=>a.localeCompare(b,'es')));
}
function filteredContracts(){const city=document.getElementById('contractCityFilter').value,status=document.getElementById('contractStatusFilter').value,q=cleanText(document.getElementById('contractSearch').value).toLowerCase();return state.contracts.filter(c=>{const st=contractStatus(c);return(city==='ALL'||c.localidad===city)&&(status==='ALL'||st.code===status)&&(!q||`${c.contrato} ${c.empresa} ${c.expediente} ${c.nuevaTramitacion}`.toLowerCase().includes(q));});}
function renderContractStatusSummary(rows){const defs=[['VIGENTE','Vigentes','vigente'],['PROXIMO','Próximos a vencer (31–90 días)','proximo'],['CRITICO','Vencimiento crítico (≤ 30 días)','critico'],['RENOVACION','En renovación','renovacion'],['VENCIDO','Vencidos','vencido'],['SIN_FECHA','Sin fecha definida','sin-fecha']],counts=Object.fromEntries(defs.map(([c])=>[c,0]));rows.forEach(c=>counts[contractStatus(c).code]++);document.getElementById('contractStatusCards').innerHTML=defs.map(([c,label,cls])=>`<div class="status-row"><div class="left"><span class="dot ${cls}"></span><strong>${label}</strong></div><span class="count">${counts[c]}</span></div>`).join('');}
function renderContracts(){
  const rows=filteredContracts(),amount=rows.reduce((s,c)=>s+c.adjudicado,0),expiring=rows.filter(c=>['PROXIMO','CRITICO'].includes(contractStatus(c).code)),renewal=rows.filter(c=>contractStatus(c).code==='RENOVACION');
  document.getElementById('kpiContracts').textContent=NUM.format(rows.length);document.getElementById('kpiContractsAmount').textContent=fmtCompactMoney(amount);document.getElementById('kpiContractsExpiring').textContent=NUM.format(expiring.length);document.getElementById('kpiContractsRenewal').textContent=NUM.format(renewal.length);
  const future=rows.filter(c=>c.finalEfectiva&&c.finalEfectiva>=startOfToday()).sort((a,b)=>a.finalEfectiva-b.finalEfectiva);document.getElementById('kpiNextContractEnd').textContent=future[0]?`Próximo vencimiento: ${fmtDate(future[0].finalEfectiva)}`:'Próximo vencimiento: —';document.getElementById('contractsTableTotal').textContent=`${rows.length} contrato${rows.length===1?'':'s'} · ${fmtCompactMoney(amount)}`;renderContractStatusSummary(rows);
  const byCompany=new Map();rows.forEach(c=>byCompany.set(c.empresa,(byCompany.get(c.empresa)||0)+c.adjudicado));const companyData=[...byCompany.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);createBar('contractsCompanyChart','contractsCompanyChart',companyData.map(x=>x.name),companyData.map(x=>x.value),true);
  const sorted=[...rows].sort((a,b)=>{if(a.finalEfectiva&&b.finalEfectiva)return a.finalEfectiva-b.finalEfectiva;if(a.finalEfectiva)return-1;if(b.finalEfectiva)return 1;return a.contrato.localeCompare(b.contrato,'es');});
  document.getElementById('contractsBody').innerHTML=sorted.length?sorted.map(c=>{const st=contractStatus(c),renewal=/^EX-/i.test(c.nuevaTramitacion)?c.nuevaTramitacion:(c.nuevaTramitacion||'—');const extension=c.extensionEnd?`<span class="renewal-text">Prórroga detectada desde ${fmtDate(c.extensionStart)} hasta ${fmtDate(c.extensionEnd)}</span>`:'';return`<tr><td>${escapeHtml(c.localidad)}</td><td class="contract-name">${escapeHtml(c.contrato)}${extension}</td><td class="exp-cell">${escapeHtml(c.expediente)}</td><td class="numeric">${c.adjudicado?fmtMoney(c.adjudicado):'—'}</td><td class="company-cell">${escapeHtml(c.empresa)}</td><td>${c.plazo?`${NUM.format(c.plazo)} días`:'—'}</td><td>${fmtDate(c.inicio)}</td><td>${fmtDate(c.finalEfectiva)}</td><td><strong>${escapeHtml(renewalDaysText(c))}</strong></td><td><span class="status-pill ${st.cls}">${escapeHtml(st.label)}</span></td><td class="exp-cell">${escapeHtml(renewal)}</td></tr>`;}).join(''):'<tr><td class="empty-row" colspan="11">Sin contratos para los filtros seleccionados.</td></tr>';
}
function filteredProcessContracts(){const city=document.getElementById('processCityFilter').value,q=cleanText(document.getElementById('processSearch').value).toLowerCase();return state.processContracts.filter(c=>(city==='ALL'||c.localidad===city)&&(!q||`${c.contrato} ${c.expediente} ${c.empresa}`.toLowerCase().includes(q)));}
function renderProcessContracts(){const rows=filteredProcessContracts(),budget=rows.reduce((s,c)=>s+c.presupuesto,0),awarded=rows.reduce((s,c)=>s+c.adjudicado,0),cities=new Set(rows.map(c=>c.localidad));document.getElementById('kpiProcess').textContent=NUM.format(rows.length);document.getElementById('kpiProcessBudget').textContent=fmtCompactMoney(budget);document.getElementById('kpiProcessAwarded').textContent=fmtCompactMoney(awarded);document.getElementById('kpiProcessCities').textContent=NUM.format(cities.size);document.getElementById('processTableTotal').textContent=`${rows.length} trámite${rows.length===1?'':'s'}`;document.getElementById('processBody').innerHTML=rows.length?rows.map(c=>`<tr><td>${escapeHtml(c.localidad)}</td><td class="contract-name">${escapeHtml(c.contrato)}</td><td class="exp-cell">${escapeHtml(c.expediente)}</td><td class="numeric">${c.presupuesto?fmtMoney(c.presupuesto):'—'}</td><td class="numeric">${c.adjudicado?fmtMoney(c.adjudicado):'—'}</td><td>${escapeHtml(c.empresa)||'—'}</td><td>${c.plazo?`${NUM.format(c.plazo)} días`:'—'}</td><td>${fmtDate(c.inicio)}</td><td>${fmtDate(c.final)}</td></tr>`).join(''):'<tr><td class="empty-row" colspan="9">Sin tramitaciones para los filtros seleccionados.</td></tr>';}
async function loadDefaultContracts(){const status=document.getElementById('contractsFileStatus');status.textContent='Actualizando contratos desde Google Sheets…';try{const [contractsText,processText]=await Promise.all([loadText(sheetCsvUrl(SHEETS.contracts.gid)),loadText(sheetCsvUrl(SHEETS.process.gid))]);state.contracts=parseContractsCSV(contractsText);state.processContracts=parseProcessContractsCSV(processText);populateContractFilters();renderContracts();renderProcessContracts();document.getElementById('contractsBadge').textContent=state.contracts.length;document.getElementById('activeContractsCount').textContent=`(${state.contracts.length})`;document.getElementById('processContractsCount').textContent=`(${state.processContracts.length})`;status.textContent='Contratos actualizados desde Google Sheets';updateTimestamp(document.getElementById('contractsLastUpdate'));}catch(remoteError){console.warn('Google Sheets no disponible, se usa respaldo local:',remoteError);try{const b=await loadArrayBuffer(CONTRACTS_FILE);state.contracts=parseContracts(b).map(c=>({...c,localidad:normalizeLocality(c.localidad)}));state.processContracts=parseProcessContracts(b).map(c=>({...c,localidad:normalizeLocality(c.localidad)}));populateContractFilters();renderContracts();renderProcessContracts();document.getElementById('contractsBadge').textContent=state.contracts.length;document.getElementById('activeContractsCount').textContent=`(${state.contracts.length})`;document.getElementById('processContractsCount').textContent=`(${state.processContracts.length})`;if(status)status.textContent='Google Sheets no disponible · usando respaldo local';updateTimestamp(document.getElementById('contractsLastUpdate'));}catch(localError){status.textContent=`Error: ${remoteError.message}`;console.error(remoteError,localError);}}}


// Eventos
document.getElementById('reloadDefault').addEventListener('click',loadDefaultCollection);document.getElementById('cityFilter').addEventListener('change',renderCollection);document.getElementById('channelFilter').addEventListener('change',renderCollection);
['planCityFilter','planTypeFilter','planSystemFilter','planYearFilter','planExpFilter'].forEach(id=>document.getElementById(id).addEventListener('change',renderPlan));document.getElementById('planSearch').addEventListener('input',renderPlan);document.getElementById('reloadWorksDefault').addEventListener('click',loadDefaultWorks);document.querySelectorAll('.plan-data-tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.plan-data-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.planTableMode=btn.dataset.planTable;renderPlanTable(filteredPlanRows());}));document.getElementById('exportPlanCsv').addEventListener('click',exportPlanCsv);
document.getElementById('reloadContractsDefault').addEventListener('click',loadDefaultContracts);document.getElementById('contractCityFilter').addEventListener('change',renderContracts);document.getElementById('contractStatusFilter').addEventListener('change',renderContracts);document.getElementById('contractSearch').addEventListener('input',renderContracts);document.getElementById('processCityFilter').addEventListener('change',renderProcessContracts);document.getElementById('processSearch').addEventListener('input',renderProcessContracts);

Promise.all([loadDefaultCollection(),loadDefaultWorks(),loadDefaultContracts()]);
