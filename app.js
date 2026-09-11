const DEFAULT_FILE = 'data/Para_Tablero_EPAS.xlsx';
let rawRows = [];
let currentPeriod = '—';
let charts = {};

const money = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
const percent = new Intl.NumberFormat('es-AR',{style:'percent',maximumFractionDigits:1});
const $ = id => document.getElementById(id);

function normalize(v){ return String(v ?? '').trim(); }
function num(v){
  if(typeof v === 'number' && Number.isFinite(v)) return v;
  if(v === null || v === undefined || v === '') return 0;
  const s=String(v).trim().replace(/\s/g,'');
  if(!s) return 0;
  const normalized = s.includes(',') ? s.replace(/\./g,'').replace(',','.') : s;
  const n=Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function setStatus(msg,error=false){$('fileStatus').textContent=msg;document.querySelector('.status-dot').style.background=error?'#d75a5a':'#2fba73';}

async function loadDefault(){
  try{
    setStatus('Cargando archivo base…');
    const r=await fetch(DEFAULT_FILE,{cache:'no-store'});
    if(!r.ok) throw new Error('No se encontró el archivo base');
    const buf=await r.arrayBuffer();
    parseWorkbook(XLSX.read(buf,{type:'array'}),'Para_Tablero_EPAS.xlsx');
  }catch(e){ setStatus('Cargá un archivo Excel para comenzar',true); console.error(e); }
}

function findDataSheet(wb){
  for(const name of wb.SheetNames){
    const data=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null,raw:true});
    if(!data.length) continue;
    const header=data[0].map(x=>normalize(x).toLowerCase());
    if(header.includes('agente de cobro')) return {name,data};
  }
  throw new Error('No encontré una hoja cuya primera fila contenga “Agente de cobro”.');
}

function parseWorkbook(wb,fileName){
  const {data}=findDataSheet(wb);
  const parsed=parseMatrix(data);
  rawRows=parsed.rows;
  currentPeriod=parsed.period;
  $('periodTitle').textContent=`Período ${currentPeriod}`;
  $('periodFilter').textContent=currentPeriod;
  populateFilters();
  render();
  setStatus(`Archivo activo: ${fileName}`);
  $('lastUpdate').textContent=`Cargado: ${new Date().toLocaleString('es-AR')}`;
}

function parseMatrix(data){
  const header=data[0].map(normalize);
  const lower=header.map(h=>h.toLowerCase());
  const agentCol=lower.indexOf('agente de cobro');
  const totalCol=lower.indexOf('total general');
  const pctCol=lower.indexOf('porcentaje');
  if(agentCol<0) throw new Error('Falta la columna “Agente de cobro”.');

  const end = totalCol>agentCol ? totalCol : (pctCol>agentCol ? pctCol : header.length);
  const cityCols=[];
  for(let i=agentCol+1;i<end;i++) if(header[i]) cityCols.push({i,name:header[i]});
  if(!cityCols.length) throw new Error('No encontré columnas de localidades.');

  const period=normalize(data[0][0]) || '—';
  const rows=[];
  for(let r=1;r<data.length;r++){
    const agent=normalize(data[r][agentCol]);
    if(!agent) continue; // excluye automáticamente la fila total final
    for(const city of cityCols){
      const amount=num(data[r][city.i]);
      if(amount>0) rows.push({channel:agent,city:city.name,amount});
    }
  }
  return {period,rows};
}

function fillSelect(id,values){
  const s=$(id), current=s.value;
  s.innerHTML='<option value="ALL">Todos</option>'+values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if(values.includes(current)) s.value=current;
}
function populateFilters(){
  fillSelect('cityFilter',[...new Set(rawRows.map(r=>r.city))].sort((a,b)=>a.localeCompare(b,'es')));
  fillSelect('channelFilter',[...new Set(rawRows.map(r=>r.channel))].sort((a,b)=>a.localeCompare(b,'es')));
}
function filteredRows(){
  const city=$('cityFilter').value, channel=$('channelFilter').value;
  return rawRows.filter(r=>(city==='ALL'||r.city===city)&&(channel==='ALL'||r.channel===channel));
}
function groupSum(rows,key){ const m=new Map(); rows.forEach(r=>m.set(r[key],(m.get(r[key])||0)+r.amount)); return m; }
function destroy(name){ if(charts[name]) charts[name].destroy(); }
function compactMoney(v){
  const a=Math.abs(v);
  if(a>=1e9) return `$ ${(v/1e9).toLocaleString('es-AR',{maximumFractionDigits:2})} mil M`;
  if(a>=1e6) return `$ ${(v/1e6).toLocaleString('es-AR',{maximumFractionDigits:1})} M`;
  return money.format(v);
}

function render(){
  const rows=filteredRows();
  const total=rows.reduce((s,r)=>s+r.amount,0);
  const byChannel=groupSum(rows,'channel');
  const byCity=groupSum(rows,'city');
  const topChannel=[...byChannel.entries()].sort((a,b)=>b[1]-a[1])[0];
  const topCity=[...byCity.entries()].sort((a,b)=>b[1]-a[1])[0];

  $('kpiCollected').textContent=money.format(total);
  $('kpiTopChannel').textContent=topChannel?.[0] ?? '—';
  $('kpiTopChannelShare').textContent=topChannel&&total?`${percent.format(topChannel[1]/total)} del total`:'—';
  $('kpiTopCity').textContent=topCity?.[0] ?? '—';
  $('kpiTopCityAmount').textContent=topCity?money.format(topCity[1]):'—';
  $('kpiCities').textContent=[...byCity.values()].filter(v=>v>0).length;
  $('tableTotal').textContent=`Total: ${money.format(total)}`;
  renderCityChart(byCity);
  renderChannelChart(byChannel);
  renderCityShareChart(byCity);
  renderTable(rows,total);
}

function moneyAxisOptions(){
  return {responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>money.format(c.raw)}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>compactMoney(v)}},x:{grid:{display:false}}}};
}
function renderCityChart(map){
  destroy('city');
  const sorted=[...map.entries()].sort((a,b)=>b[1]-a[1]);
  charts.city=new Chart($('cityChart'),{type:'bar',data:{labels:sorted.map(x=>x[0]),datasets:[{label:'Cobranza',data:sorted.map(x=>x[1]),borderRadius:7}]},options:moneyAxisOptions()});
}
function renderChannelChart(map){
  destroy('channel');
  const sorted=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  charts.channel=new Chart($('channelChart'),{type:'bar',data:{labels:sorted.map(x=>x[0]),datasets:[{label:'Cobranza',data:sorted.map(x=>x[1]),borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>money.format(c.raw)}}},scales:{x:{beginAtZero:true,ticks:{callback:v=>compactMoney(v)}},y:{grid:{display:false}}}}});
}
function renderCityShareChart(map){
  destroy('cityShare');
  const sorted=[...map.entries()].sort((a,b)=>b[1]-a[1]);
  charts.cityShare=new Chart($('cityShareChart'),{type:'doughnut',data:{labels:sorted.map(x=>x[0]),datasets:[{data:sorted.map(x=>x[1])}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:12}},tooltip:{callbacks:{label:c=>`${c.label}: ${money.format(c.raw)}`}}}}});
}
function renderTable(rows,total){
  const sorted=[...rows].sort((a,b)=>b.amount-a.amount);
  $('detailBody').innerHTML=sorted.length?sorted.map(r=>`<tr><td>${escapeHtml(r.channel)}</td><td>${escapeHtml(r.city)}</td><td class="numeric">${money.format(r.amount)}</td><td class="numeric">${total?percent.format(r.amount/total):'—'}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No hay datos para los filtros seleccionados.</td></tr>';
}

$('excelFile').addEventListener('change',async e=>{
  const file=e.target.files[0]; if(!file) return;
  try{ setStatus(`Leyendo ${file.name}…`); const buf=await file.arrayBuffer(); parseWorkbook(XLSX.read(buf,{type:'array'}),file.name); }
  catch(err){ setStatus(err.message,true); console.error(err); }
});
$('reloadDefault').addEventListener('click',loadDefault);
$('cityFilter').addEventListener('change',render);
$('channelFilter').addEventListener('change',render);
loadDefault();
