(function(){
  'use strict';

  var BOOK_ID = '1t1gopI3Iy6tB5DC-2wJEjrLJeDUFKmxG9azBHlYbhGM';
  var BILLING_GID = '1160462473';
  var MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var CITIES = [
    'Neuquén','Chos Malal','Caviahue','Copahue','Taquimilán','Andacollo',
    'Junín de los Andes','Senillosa','Villa Chocón','Villa La Angostura',
    'Municipio de Cutral Co (PIPH)','Municipio de Plaza Huincul (PIPH)',
    'Municipio de Centenario y B° Nueva España','Aerocoop Ltda.',
    'Planta Metanol (PIPH)','B° Verde Limay - Plottier'
  ];

  var state = { months:[], pending:[], cities:[], totals:{facturado:0,cobrado:0}, charts:{} };

  function num(v){
    if(typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).trim();
    if(!s) return 0;
    s = s.replace(/\$/g,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.');
    var n = Number(s);
    return isFinite(n) ? n : 0;
  }

  function moneyM(v){
    return '$ ' + (v/1e6).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1}) + ' M';
  }

  function pct(v){
    return (v || 0).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1}) + ' %';
  }

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }

  function rateClass(v){
    if(v >= 80) return 'good';
    if(v >= 60) return 'mid';
    if(v >= 40) return 'warn';
    return 'bad';
  }

  function destroyChart(key){
    try{
      if(state.charts[key]) state.charts[key].destroy();
    }catch(e){}
    state.charts[key] = null;
  }

  function loadSheet(){
    return new Promise(function(resolve,reject){
      var cb = '__epasBilling_' + Date.now() + '_' + Math.floor(Math.random()*1000000);
      var script = document.createElement('script');
      var timer = setTimeout(function(){
        cleanup();
        reject(new Error('Tiempo de espera agotado al consultar Google Sheets'));
      },15000);

      function cleanup(){
        clearTimeout(timer);
        try{ delete window[cb]; }catch(e){ window[cb] = undefined; }
        if(script.parentNode) script.parentNode.removeChild(script);
      }

      window[cb] = function(payload){
        try{
          if(!payload || payload.status === 'error' || !payload.table){
            throw new Error('Google Sheets devolvió una respuesta inválida');
          }

          var cols = (payload.table.cols || []).length;
          var matrix = (payload.table.rows || []).map(function(r){
            return Array.from({length:cols},function(_,i){
              var c = r.c && r.c[i];
              if(!c) return '';
              if(c.v !== null && c.v !== undefined) return c.v;
              if(c.f !== null && c.f !== undefined) return c.f;
              return '';
            });
          });

          cleanup();
          resolve(matrix);
        }catch(err){
          cleanup();
          reject(err);
        }
      };

      script.onerror = function(){
        cleanup();
        reject(new Error('No se pudo conectar con Google Sheets'));
      };

      script.src =
        'https://docs.google.com/spreadsheets/d/' + BOOK_ID +
        '/gviz/tq?gid=' + encodeURIComponent(BILLING_GID) +
        '&headers=0&tqx=responseHandler:' + encodeURIComponent(cb) +
        '&_=' + Date.now();

      document.head.appendChild(script);
    });
  }

  function parse(matrix){
    if(!Array.isArray(matrix) || !matrix.length){
      throw new Error('La hoja Facturación no devolvió filas');
    }

    var rows = matrix.filter(function(row){
      var name = String((row || [])[0] || '').trim();
      return MONTHS.indexOf(name) >= 0 || /^totales$/i.test(name);
    });

    if(!rows.length){
      throw new Error('No se encontraron los meses de Facturación');
    }

    var months = [];
    var pending = [];

    rows.forEach(function(row){
      var name = String(row[0] || '').trim();
      if(/^totales$/i.test(name)) return;
      if(MONTHS.indexOf(name) < 0) return;

      var fact = num(row[33]);
      var cob = num(row[34]);

      if(fact === 0 && cob === 0){
        pending.push(name);
      }else{
        months.push({month:name,facturado:fact,cobrado:cob,row:row});
      }
    });

    if(!months.length){
      throw new Error('Se encontraron los meses, pero todos los importes llegaron vacíos');
    }

    var totalFact = months.reduce(function(s,x){ return s + x.facturado; },0);
    var totalCob = months.reduce(function(s,x){ return s + x.cobrado; },0);

    var cities = CITIES.map(function(name,index){
      var fcol = 1 + (index*2);
      var ccol = fcol + 1;
      var fact = 0;
      var cob = 0;

      months.forEach(function(m){
        fact += num(m.row[fcol]);
        cob += num(m.row[ccol]);
      });

      return {
        name:name,
        facturado:fact,
        cobrado:cob,
        pct:fact ? (cob/fact*100) : 0,
        diferencia:fact-cob,
        participacion:totalFact ? (fact/totalFact*100) : 0
      };
    }).filter(function(x){
      return x.facturado > 0 || x.cobrado > 0;
    });

    return {
      months:months,
      pending:pending,
      cities:cities,
      totals:{facturado:totalFact,cobrado:totalCob}
    };
  }

  function renderCharts(){
    if(typeof Chart === 'undefined') return;

    destroyChart('monthly');
    destroyChart('rank');

    var monthlyCanvas = document.getElementById('billingMonthlyChart');
    if(monthlyCanvas){
      state.charts.monthly = new Chart(monthlyCanvas,{
        type:'line',
        data:{
          labels:state.months.map(function(x){ return x.month; }),
          datasets:[
            {
              label:'Facturado',
              data:state.months.map(function(x){ return x.facturado/1e9; }),
              borderColor:'#1769aa',
              backgroundColor:'#1769aa',
              borderWidth:3,
              tension:0.18,
              pointRadius:4,
              pointHoverRadius:6,
              fill:false
            },
            {
              label:'Ingresado',
              data:state.months.map(function(x){ return x.cobrado/1e9; }),
              borderColor:'#2bb673',
              backgroundColor:'#2bb673',
              borderWidth:3,
              tension:0.18,
              pointRadius:4,
              pointHoverRadius:6,
              fill:false
            }
          ]
        },
        options:{
          responsive:true,
          maintainAspectRatio:false,
          plugins:{
            legend:{position:'top',align:'end',labels:{usePointStyle:true,boxWidth:10}},
            tooltip:{
              callbacks:{
                label:function(ctx){
                  return ctx.dataset.label + ': $ ' +
                    Number(ctx.raw).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}) +
                    ' mil M';
                }
              }
            }
          },
          scales:{
            y:{
              ticks:{
                callback:function(v){
                  return '$ ' + Number(v).toLocaleString('es-AR',{maximumFractionDigits:1}) + ' mil M';
                }
              }
            },
            x:{grid:{display:false}}
          }
        }
      });
    }

    var ranked = state.cities.slice().sort(function(a,b){
      return b.facturado-a.facturado;
    }).slice(0,7).reverse();

    var rankCanvas = document.getElementById('billingRankChart');
    if(rankCanvas){
      state.charts.rank = new Chart(rankCanvas,{
        type:'bar',
        data:{
          labels:ranked.map(function(x){ return x.name; }),
          datasets:[
            {
              label:'Facturado',
              data:ranked.map(function(x){ return x.facturado/1e6; }),
              backgroundColor:'#3f9fda',
              borderRadius:5
            },
            {
              label:'Ingresado',
              data:ranked.map(function(x){ return x.cobrado/1e6; }),
              backgroundColor:'#52b95d',
              borderRadius:5
            }
          ]
        },
        options:{
          indexAxis:'y',
          responsive:true,
          maintainAspectRatio:false,
          plugins:{
            legend:{position:'top',align:'end',labels:{usePointStyle:true,boxWidth:10}}
          },
          scales:{
            x:{
              ticks:{
                callback:function(v){
                  return '$ ' + Number(v).toLocaleString('es-AR',{maximumFractionDigits:0}) + ' M';
                }
              }
            },
            y:{grid:{display:false}}
          }
        }
      });
    }
  }

  function render(){
    var t = state.totals;
    var ratio = t.facturado ? (t.cobrado/t.facturado*100) : 0;

    document.getElementById('billKpiFact').textContent = moneyM(t.facturado);
    document.getElementById('billKpiCob').textContent = moneyM(t.cobrado);
    document.getElementById('billKpiPct').textContent = pct(ratio);
    document.getElementById('billKpiDiff').textContent = moneyM(t.facturado-t.cobrado);

    var neu = state.cities.find(function(x){
      return x.name === 'Neuquén';
    }) || state.cities[0];

    if(neu){
      document.getElementById('billFocusCityName').textContent = neu.name;
      document.getElementById('billFocusCityShare').textContent = pct(neu.participacion);
    }

    var period = state.months.length
      ? 'Acumulado ' + state.months[0].month.toLowerCase() + '–' +
        state.months[state.months.length-1].month.toLowerCase() + ' 2026'
      : 'Sin período';

    if(state.pending.length){
      period += ' · ' + state.pending.map(function(x){ return x.toLowerCase(); }).join(' y ') + ' pendientes';
    }
    document.getElementById('billingPeriod').textContent = period;

    var rateRows = state.cities.slice().sort(function(a,b){ return b.pct-a.pct; });
    document.getElementById('billingRateList').innerHTML = rateRows.map(function(c){
      return '<div class="billing-rate-row">' +
        '<span class="billing-rate-name">' + esc(c.name) + '</span>' +
        '<div class="billing-rate-track"><span class="billing-rate-fill ' + rateClass(c.pct) +
        '" style="width:' + Math.max(2,Math.min(100,c.pct)) + '%"></span></div>' +
        '<strong>' + pct(c.pct) + '</strong></div>';
    }).join('');

    var rows = state.cities.slice().sort(function(a,b){ return b.facturado-a.facturado; });

    document.getElementById('billingDetailBody').innerHTML = rows.map(function(c){
      return '<tr>' +
        '<td><strong>' + esc(c.name) + '</strong></td>' +
        '<td class="numeric">' + moneyM(c.facturado) + '</td>' +
        '<td class="numeric">' + moneyM(c.cobrado) + '</td>' +
        '<td class="numeric"><span class="billing-pct-pill ' + rateClass(c.pct) + '">' + pct(c.pct) + '</span></td>' +
        '<td class="numeric">' + moneyM(c.diferencia) + '</td>' +
        '<td class="numeric">' + pct(c.participacion) + '</td>' +
        '</tr>';
    }).join('');

    document.getElementById('billingDetailFoot').innerHTML =
      '<tr>' +
      '<td><strong>Total</strong></td>' +
      '<td class="numeric"><strong>' + moneyM(t.facturado) + '</strong></td>' +
      '<td class="numeric"><strong>' + moneyM(t.cobrado) + '</strong></td>' +
      '<td class="numeric"><strong>' + pct(ratio) + '</strong></td>' +
      '<td class="numeric"><strong>' + moneyM(t.facturado-t.cobrado) + '</strong></td>' +
      '<td class="numeric"><strong>100,0 %</strong></td>' +
      '</tr>';

    renderCharts();
  }

  function exportCsv(){
    var rows = [['Localidad','Facturado acumulado','Ingresado acumulado','% Cobranza','Diferencia','Participación']];
    state.cities.slice().sort(function(a,b){ return b.facturado-a.facturado; }).forEach(function(c){
      rows.push([c.name,c.facturado,c.cobrado,c.pct,c.diferencia,c.participacion]);
    });

    function q(v){
      return '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"';
    }

    var csv = '\ufeff' + rows.map(function(r){
      return r.map(q).join(';');
    }).join('\n');

    var blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'EPAS_facturacion_cobranza_2026.csv';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); },500);
  }

  function load(){
    var status = document.getElementById('billingStatus');
    if(status) status.textContent = 'Cargando datos desde Google Sheets…';

    loadSheet().then(function(matrix){
      var parsed = parse(matrix);
      state.months = parsed.months;
      state.pending = parsed.pending;
      state.cities = parsed.cities;
      state.totals = parsed.totals;

      render();

      if(status){
        status.textContent = 'Google Sheets conectado · ' +
          state.months.length + ' meses con datos · ' +
          state.cities.length + ' localidades/segmentos';
      }

      var updated = document.getElementById('billingUpdated');
      if(updated){
        updated.textContent = 'Actualizado ' + new Date().toLocaleString('es-AR');
      }
    }).catch(function(err){
      console.error('Facturación:',err);
      if(status) status.textContent = 'Error al leer Facturación: ' + err.message;
    });
  }

  function init(){
    var reload = document.getElementById('reloadBillingAnnual');
    var csv = document.getElementById('exportBillingCsv');

    if(reload) reload.addEventListener('click',load);
    if(csv) csv.addEventListener('click',exportCsv);

    load();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded',init);
  }else{
    init();
  }
})();