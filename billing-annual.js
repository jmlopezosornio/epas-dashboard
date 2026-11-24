
(function(){
  var BOOK_ID='1t1gopI3Iy6tB5DC-2wJEjrLJeDUFKmxG9azBHlYbhGM';
  var BILLING_GID='1160462473';
  var S={months:[],cities:[],pending:[],totals:{facturado:0,cobrado:0},charts:{}};

  function n(v){
    if(typeof v==='number') return isFinite(v)?v:0;
    var s=String(v==null?'':v).trim();
    if(!s) return 0;
    var x=s.replace(/\$/g,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.');
    var z=Number(x); return isFinite(z)?z:0;
  }
  function m(v){return '$ '+(v/1e6).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})+' M';}
  function p(v){return (v||0).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})+' %';}
  function e(v){return String(v==null?'':v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
  function d(k){try{if(S.charts[k])S.charts[k].destroy();}catch(x){} S.charts[k]=null;}

  function loadSheet(){
    return new Promise(function(resolve,reject){
      var cb='__epasBilling_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      var script=document.createElement('script');
      var timer=setTimeout(function(){
        cleanup();
        reject(new Error('Tiempo de espera agotado al consultar Google Sheets'));
      },15000);

      function cleanup(){
        clearTimeout(timer);
        try{delete window[cb];}catch(e){window[cb]=undefined;}
        if(script&&script.parentNode)script.parentNode.removeChild(script);
      }

      window[cb]=function(payload){
        try{
          if(!payload||payload.status==='error'||!payload.table){
            throw new Error('Respuesta inválida de Google Sheets');
          }
          var cols=(payload.table.cols||[]).length;
          var matrix=(payload.table.rows||[]).map(function(r){
            return Array.from({length:cols},function(_,i){
              var c=r.c&&r.c[i];
              if(!c) return '';
              if(c.f!==null&&c.f!==undefined&&c.f!=='') return c.f;
              return c.v===null||c.v===undefined?'':c.v;
            });
          });
          cleanup();
          resolve(matrix);
        }catch(err){
          cleanup();
          reject(err);
        }
      };

      script.onerror=function(){
        cleanup();
        reject(new Error('No se pudo cargar Google Sheets'));
      };
      script.src='https://docs.google.com/spreadsheets/d/'+BOOK_ID+
        '/gviz/tq?gid='+encodeURIComponent(BILLING_GID)+
        '&tqx=responseHandler:'+encodeURIComponent(cb)+
        '&headers=0&_='+Date.now();
      document.head.appendChild(script);
    });
  }

  function parse(mx){
    var defs=[];
    var localityRow=-1, monthHeaderRow=-1;
    for(var rr=0;rr<mx.length;rr++){
      var first=String((mx[rr]||[])[0]||'').trim().toLowerCase();
      if(first==='localidad') localityRow=rr;
      if(first==='mes') {monthHeaderRow=rr;break;}
    }
    if(localityRow<0||monthHeaderRow<0) throw new Error('No se reconoció la estructura de la hoja Facturación');
    var h=mx[localityRow]||[];
    for(var c=1;c<h.length-1;c+=2){
      var name=String(h[c]||'').trim();
      if(!name||/^totales$/i.test(name))break;
      defs.push({name:name,f:c,i:c+1});
    }
    var months=[],pending=[];
    for(var r=monthHeaderRow+1;r<mx.length;r++){
      var name=String((mx[r]||[])[0]||'').trim();
      if(!name)continue;
      if(/^totales$/i.test(name))break;
      var f=n((mx[r]||[])[33]),i=n((mx[r]||[])[34]);
      if(f===0&&i===0)pending.push(name);
      else months.push({month:name,facturado:f,cobrado:i,row:mx[r]||[]});
    }
    var tf=months.reduce(function(s,x){return s+x.facturado;},0);
    var ti=months.reduce(function(s,x){return s+x.cobrado;},0);
    var cities=defs.map(function(q){
      var f=0,i=0;
      months.forEach(function(mm){f+=n(mm.row[q.f]);i+=n(mm.row[q.i]);});
      return {name:q.name,facturado:f,cobrado:i,pct:f?i/f*100:0,diferencia:f-i,participacion:tf?f/tf*100:0};
    }).filter(function(x){return x.facturado>0||x.cobrado>0;});
    return {months:months,pending:pending,cities:cities,totals:{facturado:tf,cobrado:ti}};
  }

  function shell(){
    var tab=document.getElementById('tab-cobranza'); if(!tab)return;
    if(tab.querySelector('.billing-annual')) return;
    tab.innerHTML=
      '<div class="billing-annual">'+
      '<div class="section-heading billing-heading"><div><div class="section-kicker">Gestión comercial</div><h2>Facturación y Cobranza · Resumen anual</h2><p id="billingPeriod">Acumulado anual</p></div>'+
      '<div class="file-actions billing-actions"><button id="reloadBillingAnnual" class="button secondary">↻ Actualizar datos</button><button id="exportBillingPdf" class="button secondary">▣ Exportar PDF</button><button id="exportBillingCsv" class="button secondary">⇩ Exportar CSV</button></div></div>'+
      '<section class="status-card billing-status"><div><span class="status-dot"></span><strong id="billingStatus">Cargando datos desde Google Sheets…</strong></div><span id="billingUpdated">—</span></section>'+
      '<section class="billing-kpis">'+
      '<article class="kpi-card billing-kpi"><span>Facturado acumulado</span><strong id="billKpiFact">$ 0</strong><small>Período con datos</small></article>'+
      '<article class="kpi-card billing-kpi"><span>Ingresado acumulado</span><strong id="billKpiCob">$ 0</strong><small>Cobranza registrada</small></article>'+
      '<article class="kpi-card billing-kpi accent"><span>Índice de cobranza</span><strong id="billKpiPct">0,0 %</strong><small>Ingresado / Facturado</small></article>'+
      '<article class="kpi-card billing-kpi danger"><span>Diferencia facturado - ingresado</span><strong id="billKpiDiff">$ 0</strong><small>Brecha acumulada</small></article>'+
      '<article class="kpi-card billing-kpi"><span id="billFocusCityName">Neuquén</span><strong id="billFocusCityShare">0,0 %</strong><small>de la facturación total</small></article>'+
      '</section>'+
      '<section class="billing-main-grid">'+
      '<article class="panel billing-line-panel"><div class="panel-title"><div><h3>Evolución mensual · Facturado vs. Ingresado</h3><p>En miles de millones de $</p></div></div><div class="billing-line-wrap"><canvas id="billingMonthlyChart"></canvas></div></article>'+
      '<article class="panel billing-rank-panel"><div class="panel-title"><div><h3>Ranking por facturación (acumulado)</h3><p>Principales localidades / segmentos</p></div></div><div class="billing-rank-wrap"><canvas id="billingRankChart"></canvas></div></article>'+
      '<article class="panel billing-rate-panel"><div class="panel-title"><div><h3>Índice de cobranza por localidad</h3><p>Ingresado sobre facturado</p></div></div><div id="billingRateList" class="billing-rate-list"></div></article>'+
      '</section>'+
      '<section class="billing-bottom-grid"><div class="billing-alerts">'+
      '<article class="billing-alert-card info"><span>Mayor brecha nominal</span><strong id="billingGapCity">—</strong><small id="billingGapDetail">—</small></article>'+
      '<article class="billing-alert-card danger"><span>Menor índice de cobranza</span><strong id="billingLowCity">—</strong><small id="billingLowDetail">—</small></article>'+
      '</div><article class="panel billing-table-panel"><div class="panel-title"><div><h3>Detalle acumulado por localidad</h3><p>Facturación, ingresos y eficiencia de cobranza</p></div></div>'+
      '<div class="table-scroll"><table class="billing-table"><thead><tr><th>Localidad</th><th class="numeric">Facturado acumulado</th><th class="numeric">Ingresado acumulado</th><th class="numeric">% Cobranza</th><th class="numeric">Diferencia</th><th class="numeric">Participación s/ facturación total</th></tr></thead><tbody id="billingDetailBody"></tbody><tfoot id="billingDetailFoot"></tfoot></table></div></article></section>'+
      '</div>';
  }

  function rate(pct){if(pct>=80)return'good';if(pct>=60)return'mid';if(pct>=40)return'warn';return'bad';}

  function charts(){
    d('monthly'); d('rank');
    var a=document.getElementById('billingMonthlyChart');
    if(a)S.charts.monthly=new Chart(a,{type:'line',data:{labels:S.months.map(function(x){return x.month;}),datasets:[
      {label:'Facturado',data:S.months.map(function(x){return x.facturado/1e9;}),borderColor:'#1769aa',backgroundColor:'#1769aa',borderWidth:3,tension:.18,pointRadius:4,pointHoverRadius:6,fill:false},
      {label:'Ingresado',data:S.months.map(function(x){return x.cobrado/1e9;}),borderColor:'#2bb673',backgroundColor:'#2bb673',borderWidth:3,tension:.18,pointRadius:4,pointHoverRadius:6,fill:false}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',align:'end',labels:{usePointStyle:true,boxWidth:10}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': $ '+Number(c.raw).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})+' mil M';}}}},scales:{y:{ticks:{callback:function(v){return '$ '+Number(v).toLocaleString('es-AR',{maximumFractionDigits:1})+' mil M';}},x:{grid:{display:false}}}}});

    var ranked=S.cities.slice().sort(function(x,y){return y.facturado-x.facturado;}).slice(0,7).reverse();
    var b=document.getElementById('billingRankChart');
    if(b)S.charts.rank=new Chart(b,{type:'bar',data:{labels:ranked.map(function(x){return x.name;}),datasets:[
      {label:'Facturado',data:ranked.map(function(x){return x.facturado/1e6;}),backgroundColor:'#3f9fda',borderRadius:5},
      {label:'Ingresado',data:ranked.map(function(x){return x.cobrado/1e6;}),backgroundColor:'#52b95d',borderRadius:5}
    ]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',align:'end',labels:{usePointStyle:true,boxWidth:10}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': $ '+Number(c.raw).toLocaleString('es-AR',{maximumFractionDigits:1})+' M';}}}},scales:{x:{ticks:{callback:function(v){return '$ '+Number(v).toLocaleString('es-AR',{maximumFractionDigits:0})+' M';}},y:{grid:{display:false}}}}});
  }

  function render(){
    var t=S.totals,pct=t.facturado?t.cobrado/t.facturado*100:0;
    document.getElementById('billKpiFact').textContent=m(t.facturado);
    document.getElementById('billKpiCob').textContent=m(t.cobrado);
    document.getElementById('billKpiPct').textContent=p(pct);
    document.getElementById('billKpiDiff').textContent=m(t.facturado-t.cobrado);

    var neu=S.cities.find(function(x){return x.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()==='neuquen';})||S.cities[0];
    if(neu){document.getElementById('billFocusCityName').textContent=neu.name;document.getElementById('billFocusCityShare').textContent=p(neu.participacion);}

    var gap=S.cities.slice().sort(function(x,y){return y.diferencia-x.diferencia;})[0];
    var low=S.cities.filter(function(x){return x.facturado>0;}).sort(function(x,y){return x.pct-y.pct;})[0];
    if(gap){document.getElementById('billingGapCity').textContent=gap.name;document.getElementById('billingGapDetail').textContent='Diferencia: '+m(gap.diferencia)+' · '+p(gap.participacion)+' del total facturado';}
    if(low){document.getElementById('billingLowCity').textContent=low.name;document.getElementById('billingLowDetail').textContent=p(low.pct)+' de cobranza acumulada';}

    var period=S.months.length?'Acumulado '+S.months[0].month.toLowerCase()+'–'+S.months[S.months.length-1].month.toLowerCase()+' 2026':'Sin período';
    if(S.pending.length)period+=' · '+S.pending.map(function(x){return x.toLowerCase();}).join(' y ')+' pendientes';
    document.getElementById('billingPeriod').textContent=period;

    var rateRows=S.cities.slice().sort(function(x,y){return y.pct-x.pct;});
    document.getElementById('billingRateList').innerHTML=rateRows.map(function(c){return '<div class="billing-rate-row"><span class="billing-rate-name">'+e(c.name)+'</span><div class="billing-rate-track"><span class="billing-rate-fill '+rate(c.pct)+'" style="width:'+Math.max(2,Math.min(100,c.pct))+'%"></span></div><strong>'+p(c.pct)+'</strong></div>';}).join('');

    var rows=S.cities.slice().sort(function(x,y){return y.facturado-x.facturado;});
    document.getElementById('billingDetailBody').innerHTML=rows.map(function(c){return '<tr><td><strong>'+e(c.name)+'</strong></td><td class="numeric">'+m(c.facturado)+'</td><td class="numeric">'+m(c.cobrado)+'</td><td class="numeric"><span class="billing-pct-pill '+rate(c.pct)+'">'+p(c.pct)+'</span></td><td class="numeric">'+m(c.diferencia)+'</td><td class="numeric">'+p(c.participacion)+'</td></tr>';}).join('');
    document.getElementById('billingDetailFoot').innerHTML='<tr><td><strong>Total</strong></td><td class="numeric"><strong>'+m(t.facturado)+'</strong></td><td class="numeric"><strong>'+m(t.cobrado)+'</strong></td><td class="numeric"><strong>'+p(pct)+'</strong></td><td class="numeric"><strong>'+m(t.facturado-t.cobrado)+'</strong></td><td class="numeric"><strong>100,0 %</strong></td></tr>';

    charts();
  }

  function load(){
    var st=document.getElementById('billingStatus'); if(st)st.textContent='Actualizando desde Google Sheets…';
    loadSheet().then(function(mx){
      var q=parse(mx);
      if(!q.months.length || !q.cities.length) throw new Error('La hoja Facturación fue leída, pero no se encontraron filas de datos');
      S.months=q.months;S.pending=q.pending;S.cities=q.cities;S.totals=q.totals;render();
      if(st)st.textContent='Google Sheets conectado · '+q.months.length+' meses con datos · '+q.cities.length+' localidades/segmentos';
      var u=document.getElementById('billingUpdated');if(u)u.textContent='Actualizado '+new Date().toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
    }).catch(function(err){console.error(err);if(st)st.textContent='Error al leer la hoja Facturación: '+err.message;});
  }

  function csv(){
    var rows=S.cities.slice().sort(function(x,y){return y.facturado-x.facturado;});
    var data=[['Localidad','Facturado acumulado','Ingresado acumulado','% Cobranza','Diferencia','Participación']];
    rows.forEach(function(c){data.push([c.name,c.facturado,c.cobrado,c.pct,c.diferencia,c.participacion]);});
    data.push(['Total',S.totals.facturado,S.totals.cobrado,S.totals.facturado?S.totals.cobrado/S.totals.facturado*100:0,S.totals.facturado-S.totals.cobrado,100]);
    function q(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}
    var blob=new Blob(['\ufeff'+data.map(function(r){return r.map(q).join(';');}).join('\n')],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='EPAS_facturacion_cobranza_2026.csv';a.click();URL.revokeObjectURL(a.href);
  }

  function loadOnce(src,test){
    return new Promise(function(resolve,reject){
      if(test())return resolve();
      var ex=[].slice.call(document.scripts).find(function(x){return x.src===src;});
      if(ex){ex.addEventListener('load',resolve,{once:true});ex.addEventListener('error',reject,{once:true});return;}
      var el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=reject;document.head.appendChild(el);
    });
  }

  async function pdf(){
    try{
      await loadOnce('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',function(){return !!(window.jspdf&&window.jspdf.jsPDF);});
      await loadOnce('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',function(){return !!(window.jspdf&&window.jspdf.jsPDF&&window.jspdf.jsPDF.API&&window.jspdf.jsPDF.API.autoTable);});
      var jsPDF=window.jspdf.jsPDF;
      var doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true});
      var pageW=doc.internal.pageSize.getWidth();
      var navy=[11,47,87],line=[218,228,235];
      var gen=new Date().toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
      var t=S.totals,ratio=t.facturado?t.cobrado/t.facturado*100:0;

      doc.setFillColor.apply(doc,navy);doc.rect(0,0,pageW,24,'F');
      doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(16);
      doc.text('Facturación y Cobranza · Resumen anual',12,10);
      doc.setFont('helvetica','normal');doc.setFontSize(9);
      doc.text(document.getElementById('billingPeriod').textContent||'',12,16);

      doc.setTextColor(35,60,80);doc.setFont('helvetica','bold');doc.setFontSize(10);
      doc.text('Facturado: '+m(t.facturado)+'   Ingresado: '+m(t.cobrado)+'   Índice: '+p(ratio)+'   Diferencia: '+m(t.facturado-t.cobrado),12,33);

      var rows=S.cities.slice().sort(function(a,b){return b.facturado-a.facturado;}).map(function(c){
        return [c.name,m(c.facturado),m(c.cobrado),p(c.pct),m(c.diferencia),p(c.participacion)];
      });
      rows.push(['Total',m(t.facturado),m(t.cobrado),p(ratio),m(t.facturado-t.cobrado),'100,0 %']);

      doc.autoTable({
        head:[['Localidad','Facturado acumulado','Ingresado acumulado','% Cobranza','Diferencia','Participación']],
        body:rows,
        startY:40,
        margin:{left:12,right:12,bottom:16},
        styles:{font:'helvetica',fontSize:8,cellPadding:3,lineColor:line,lineWidth:.15,textColor:[31,55,73]},
        headStyles:{fillColor:[234,242,248],textColor:[41,75,99],fontStyle:'bold'},
        alternateRowStyles:{fillColor:[249,251,253]}
      });
      var y=(doc.lastAutoTable&&doc.lastAutoTable.finalY?doc.lastAutoTable.finalY:40)+8;
      var ph=doc.internal.pageSize.getHeight();
      if(y>ph-18){doc.addPage();y=18;}
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(90,110,125);
      doc.text('Fecha y hora de impresión: '+gen,12,y);
      doc.save('EPAS_Facturacion_y_Cobranza_2026.pdf');
    }catch(err){
      console.error('PDF Facturación:',err);
      alert('No se pudo generar el PDF. Probá nuevamente.');
    }
  }

  function init(){
    shell();
    document.getElementById('reloadBillingAnnual').addEventListener('click',load);
    document.getElementById('exportBillingCsv').addEventListener('click',csv);
    document.getElementById('exportBillingPdf').addEventListener('click',pdf);
    load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
