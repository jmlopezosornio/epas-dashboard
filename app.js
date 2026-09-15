const COBRANZA_FILE = 'data/Para_Tablero_EPAS.xlsx';
const WORKS_FILE = 'data/Control_GDE_obras_a_licitar.xlsx';

const ARS = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 });
const NUM = new Intl.NumberFormat('es-AR', { maximumFractionDigits:0 });
const PCT = new Intl.NumberFormat('es-AR', { minimumFractionDigits:1, maximumFractionDigits:1 });
const DATE_FMT = new Intl.DateTimeFormat('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' });

const state = {
  collection: { period:'—', rows:[], cities:[] },
  works: [],
  charts: {}
};

function cleanText(v){ return String(v ?? '').replace(/\s+/g,' ').trim(); }
function numeric(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function escapeHtml(s){ return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function fmtMoney(v){ return ARS.format(numeric(v)); }
function fmtCompactMoney(v){
  const n = numeric(v), a=Math.abs(n);
  if(a>=1e9) return `$ ${PCT.format(n/1e9)} mil M`;
  if(a>=1e6) return `$ ${PCT.format(n/1e6)} M`;
  return fmtMoney(n);
}
function fmtDate(d){ return d instanceof Date && !isNaN(d) ? DATE_FMT.format(d) : '—'; }
function updateTimestamp(el){ el.textContent = `Actualizado ${new Date().toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'})}`; }

// Tabs
for (const btn of document.querySelectorAll('.tab-button')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    setTimeout(() => Object.values(state.charts).forEach(c => c?.resize()), 50);
  });
}

// ---------- Cobranza ----------
async function loadArrayBuffer(url){
  const response = await fetch(url, { cache:'no-store' });
  if(!response.ok) throw new Error(`No se pudo cargar ${url}`);
  return response.arrayBuffer();
}

function parseCollection(buffer){
  const wb = XLSX.read(buffer, { type:'array', cellDates:true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:true });
  if(!matrix.length) throw new Error('El Excel de cobranza está vacío.');
  const header = matrix[0].map(cleanText);
  const agentIdx = header.findIndex(h => h.toLowerCase() === 'agente de cobro');
  const totalIdx = header.findIndex(h => h.toLowerCase() === 'total general');
  if(agentIdx < 0 || totalIdx < 0 || totalIdx <= agentIdx) throw new Error('No encuentro las columnas “Agente de cobro” y “Total General”.');
  const period = cleanText(matrix[0][0]) || '—';
  const cities = header.slice(agentIdx+1, totalIdx).filter(Boolean);
  const rows=[];
  for(let r=1;r<matrix.length;r++){
    const agent=cleanText(matrix[r][agentIdx]);
    if(!agent || /^total/i.test(agent)) continue;
    cities.forEach((city,i)=>{
      const amount=numeric(matrix[r][agentIdx+1+i]);
      if(amount!==0) rows.push({agent, city, amount});
    });
  }
  return { period, cities, rows };
}

function populateCollectionFilters(){
  const citySel=document.getElementById('cityFilter'), channelSel=document.getElementById('channelFilter');
  const currentCity=citySel.value, currentChannel=channelSel.value;
  citySel.innerHTML='<option value="ALL">Todas</option>'+state.collection.cities.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
  const agents=[...new Set(state.collection.rows.map(r=>r.agent))].sort((a,b)=>a.localeCompare(b,'es'));
  channelSel.innerHTML='<option value="ALL">Todos</option>'+agents.map(a=>`<option>${escapeHtml(a)}</option>`).join('');
  if([...citySel.options].some(o=>o.value===currentCity)) citySel.value=currentCity;
  if([...channelSel.options].some(o=>o.value===currentChannel)) channelSel.value=currentChannel;
}

function aggregate(rows,key){
  const m=new Map(); rows.forEach(r=>m.set(r[key],(m.get(r[key])||0)+r.amount));
  return [...m.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
}
function destroyChart(name){ if(state.charts[name]){ state.charts[name].destroy(); state.charts[name]=null; } }
function createBar(name, canvasId, labels, data, horizontal=false){
  destroyChart(name);
  state.charts[name]=new Chart(document.getElementById(canvasId), {type:'bar',data:{labels,datasets:[{data,borderRadius:7,maxBarThickness:52}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:horizontal?'y':'x',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtMoney(c.raw)}}},scales:{x:{grid:{display:!horizontal},ticks:{callback:horizontal?v=>fmtCompactMoney(v):undefined}},y:{grid:{display:horizontal?false:true},ticks:{callback:horizontal?undefined:v=>fmtCompactMoney(v)}}}}});
}
function createDoughnut(name, canvasId, labels, data){
  destroyChart(name);
  state.charts[name]=new Chart(document.getElementById(canvasId), {type:'doughnut',data:{labels,datasets:[{data,borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${fmtMoney(c.raw)}`}}}}});
}

function renderCollection(){
  const city=document.getElementById('cityFilter').value, agent=document.getElementById('channelFilter').value;
  const rows=state.collection.rows.filter(r=>(city==='ALL'||r.city===city)&&(agent==='ALL'||r.agent===agent));
  const total=rows.reduce((s,r)=>s+r.amount,0), byCity=aggregate(rows,'city'), byAgent=aggregate(rows,'agent');
  document.getElementById('periodTitle').textContent=`Período ${state.collection.period}`;
  document.getElementById('periodFilter').textContent=state.collection.period;
  document.getElementById('kpiCollected').textContent=fmtCompactMoney(total);
  document.getElementById('kpiTopChannel').textContent=byAgent[0]?.name||'—';
  document.getElementById('kpiTopChannelShare').textContent=byAgent[0]&&total?`${PCT.format(byAgent[0].value/total*100)} % del total`:'—';
  document.getElementById('kpiTopCity').textContent=byCity[0]?.name||'—';
  document.getElementById('kpiTopCityAmount').textContent=byCity[0]?fmtCompactMoney(byCity[0].value):'—';
  document.getElementById('kpiCities').textContent=NUM.format(byCity.filter(x=>x.value>0).length);
  document.getElementById('tableTotal').textContent=`Total: ${fmtMoney(total)}`;
  createBar('cityChart','cityChart',byCity.map(x=>x.name),byCity.map(x=>x.value),byCity.length>=6);
  createBar('channelChart','channelChart',byAgent.slice(0,10).map(x=>x.name),byAgent.slice(0,10).map(x=>x.value),true);
  createDoughnut('cityShareChart','cityShareChart',byCity.map(x=>x.name),byCity.map(x=>x.value));
  const body=document.getElementById('detailBody');
  const sorted=[...rows].sort((a,b)=>b.amount-a.amount);
  body.innerHTML=sorted.length?sorted.map(r=>`<tr><td>${escapeHtml(r.agent)}</td><td>${escapeHtml(r.city)}</td><td class="numeric">${fmtMoney(r.amount)}</td><td class="numeric">${total?PCT.format(r.amount/total*100):'0,0'} %</td></tr>`).join(''):'<tr><td class="empty-row" colspan="4">Sin datos para los filtros seleccionados.</td></tr>';
}

async function loadDefaultCollection(){
  const status=document.getElementById('fileStatus'); status.textContent='Cargando archivo base…';
  try{ const b=await loadArrayBuffer(COBRANZA_FILE); state.collection=parseCollection(b); populateCollectionFilters(); renderCollection(); status.textContent='Archivo base de cobranza cargado'; updateTimestamp(document.getElementById('lastUpdate')); }
  catch(e){ status.textContent=`Error: ${e.message}`; console.error(e); }
}

document.getElementById('reloadDefault').addEventListener('click',loadDefaultCollection);
document.getElementById('cityFilter').addEventListener('change',renderCollection);
document.getElementById('channelFilter').addEventListener('change',renderCollection);

// ---------- Obras ----------
function excelDateToJS(v){
  if(v instanceof Date) return new Date(v.getFullYear(),v.getMonth(),v.getDate());
  if(typeof v==='number'){
    const p=XLSX.SSF.parse_date_code(v); if(p) return new Date(p.y,p.m-1,p.d);
  }
  if(typeof v==='string' && v.trim()){
    const s=v.trim(); const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if(m){ const y=+m[3]<100?2000+(+m[3]):+m[3]; return new Date(y,+m[2]-1,+m[1]); }
    const d=new Date(s); if(!isNaN(d)) return d;
  }
  return null;
}
function parseWorks(buffer){
  const wb=XLSX.read(buffer,{type:'array',cellDates:true});
  const ws=wb.Sheets['Exptes'] || wb.Sheets[wb.SheetNames[0]];
  const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});
  let hi=matrix.findIndex(row=>row.some(v=>cleanText(v).toLowerCase().includes('expediente')) && row.some(v=>cleanText(v).toLowerCase().includes('nombre de la obra')));
  if(hi<0) throw new Error('No encuentro los encabezados de la hoja de obras.');
  const h=matrix[hi].map(v=>cleanText(v).toLowerCase());
  const idx=(needle)=>h.findIndex(x=>x.includes(needle));
  const e=idx('expediente'), n=idx('nombre de la obra'), l=idx('localidad'), f=idx('fecha apertura'), p=idx('presupuesto oficial'), a=idx('adjudicado');
  if([e,n,l,p].some(i=>i<0)) throw new Error('Faltan columnas obligatorias en el Excel de obras.');
  const out=[];
  for(let r=hi+1;r<matrix.length;r++){
    const exp=cleanText(matrix[r][e]), name=cleanText(matrix[r][n]);
    if(!exp && !name) continue;
    out.push({expediente:exp, obra:name, localidad:cleanText(matrix[r][l])||'Sin localidad', apertura:f>=0?excelDateToJS(matrix[r][f]):null, presupuesto:numeric(matrix[r][p]), adjudicado:a>=0?numeric(matrix[r][a]):0});
  }
  return out;
}
function startOfToday(){ const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
function workStatus(w){
  if(w.adjudicado) return {code:'ADJUDICADA',label:'Adjudicada',cls:'adjudicada'};
  if(!w.apertura) return {code:'SIN_FECHA',label:'Sin fecha definida',cls:'sin-fecha'};
  const days=Math.ceil((w.apertura-startOfToday())/86400000);
  if(days<0) return {code:'VENCIDA',label:'Apertura vencida',cls:'vencida'};
  if(days<=7) return {code:'PROXIMA',label:days===0?'Apertura hoy':`Apertura en ${days} día${days===1?'':'s'}`,cls:'proxima'};
  return {code:'PROGRAMADA',label:'Apertura programada',cls:'programada'};
}
function populateWorksFilters(){
  const sel=document.getElementById('worksCityFilter'), cur=sel.value;
  const cities=[...new Set(state.works.map(w=>w.localidad))].sort((a,b)=>a.localeCompare(b,'es'));
  sel.innerHTML='<option value="ALL">Todas</option>'+cities.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
  if([...sel.options].some(o=>o.value===cur)) sel.value=cur;
}
function filteredWorks(){
  const city=document.getElementById('worksCityFilter').value, status=document.getElementById('worksStatusFilter').value, q=cleanText(document.getElementById('worksSearch').value).toLowerCase();
  return state.works.filter(w=>{const st=workStatus(w); return (city==='ALL'||w.localidad===city)&&(status==='ALL'||st.code===status)&&(!q||`${w.expediente} ${w.obra}`.toLowerCase().includes(q));});
}
function renderWorksStatusSummary(rows){
  const defs=[['ADJUDICADA','Adjudicadas','adjudicada'],['VENCIDA','Aperturas vencidas','vencida'],['PROXIMA','Aperturas próximas (≤ 7 días)','proxima'],['PROGRAMADA','Aperturas programadas','programada'],['SIN_FECHA','Sin fecha definida','sin-fecha']];
  const counts=Object.fromEntries(defs.map(([c])=>[c,0])); rows.forEach(w=>counts[workStatus(w).code]++);
  document.getElementById('worksStatusCards').innerHTML=defs.map(([c,label,cls])=>`<div class="status-row"><div class="left"><span class="dot ${cls}"></span><strong>${label}</strong></div><span class="count">${counts[c]}</span></div>`).join('');
}
function renderWorks(){
  const rows=filteredWorks(), budget=rows.reduce((s,w)=>s+w.presupuesto,0), withOpen=rows.filter(w=>w.apertura), awarded=rows.filter(w=>workStatus(w).code==='ADJUDICADA');
  document.getElementById('kpiWorks').textContent=NUM.format(rows.length);
  document.getElementById('kpiBudget').textContent=fmtCompactMoney(budget);
  document.getElementById('kpiOpenings').textContent=NUM.format(withOpen.length);
  const future=withOpen.filter(w=>w.apertura>=startOfToday()).sort((a,b)=>a.apertura-b.apertura);
  document.getElementById('kpiNextOpening').textContent=future[0]?`Próxima: ${fmtDate(future[0].apertura)}`:'Próxima: —';
  document.getElementById('kpiAwarded').textContent=NUM.format(awarded.length);
  document.getElementById('kpiAwardedShare').textContent=`${rows.length?PCT.format(awarded.length/rows.length*100):'0,0'} % del total`;
  document.getElementById('worksTableTotal').textContent=`${rows.length} obra${rows.length===1?'':'s'} · ${fmtCompactMoney(budget)}`;
  renderWorksStatusSummary(rows);
  const byCity=new Map(); rows.forEach(w=>byCity.set(w.localidad,(byCity.get(w.localidad)||0)+w.presupuesto)); const cityData=[...byCity.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  createBar('worksCityChart','worksCityChart',cityData.map(x=>x.name),cityData.map(x=>x.value),cityData.length>=6);
  const body=document.getElementById('worksBody');
  const sorted=[...rows].sort((a,b)=>{ if(a.apertura&&b.apertura)return a.apertura-b.apertura; if(a.apertura)return -1;if(b.apertura)return 1;return b.presupuesto-a.presupuesto; });
  body.innerHTML=sorted.length?sorted.map(w=>{const st=workStatus(w);return `<tr><td class="exp-cell">${escapeHtml(w.expediente)}</td><td class="work-name">${escapeHtml(w.obra)}</td><td>${escapeHtml(w.localidad)}</td><td>${fmtDate(w.apertura)}</td><td class="numeric">${fmtMoney(w.presupuesto)}</td><td><span class="status-pill ${st.cls}">${escapeHtml(st.label)}</span></td><td class="numeric">${w.adjudicado>0?fmtMoney(w.adjudicado):'—'}</td></tr>`;}).join(''):'<tr><td class="empty-row" colspan="7">Sin obras para los filtros seleccionados.</td></tr>';
}
async function loadDefaultWorks(){
  const status=document.getElementById('worksFileStatus'); status.textContent='Cargando archivo de obras…';
  try{const b=await loadArrayBuffer(WORKS_FILE);state.works=parseWorks(b);populateWorksFilters();renderWorks();status.textContent='Archivo base de obras cargado';document.getElementById('worksBadge').textContent=state.works.length;updateTimestamp(document.getElementById('worksLastUpdate'));}
  catch(e){status.textContent=`Error: ${e.message}`;console.error(e);}
}
document.getElementById('reloadWorksDefault').addEventListener('click',loadDefaultWorks);
document.getElementById('worksCityFilter').addEventListener('change',renderWorks);
document.getElementById('worksStatusFilter').addEventListener('change',renderWorks);
document.getElementById('worksSearch').addEventListener('input',renderWorks);

Promise.all([loadDefaultCollection(),loadDefaultWorks()]);
