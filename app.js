(function(){
  setTimeout(function(){
    var core=document.createElement('script');
    core.src='app-core.js?v=20261016-3';
    core.onload=function(){
      if(typeof Chart!=='undefined'){
        var palette=['#1688f0','#26b576','#f5a623','#7b61ff','#47b8c4','#9aa9b5'];
        var named={
          'Obras':'#1688f0',
          'Proyectos a contratar':'#26b576',
          'Cloaca':'#1688f0',
          'Agua':'#26b576',
          'Otros':'#9aa9b5',
          'Mixto':'#7b61ff'
        };
        try{Chart.unregister(Chart.registry.plugins.get('epasDoughnutColors'));}catch(e){}
        try{Chart.unregister(Chart.registry.plugins.get('epasExecutionCenter'));}catch(e){}
        Chart.register({
          id:'epasDoughnutColors',
          beforeUpdate:function(chart){
            if(chart.config.type!=='doughnut') return;
            var ds=chart.data&&chart.data.datasets&&chart.data.datasets[0];
            var labels=chart.data&&chart.data.labels?chart.data.labels:[];
            if(!ds) return;
            if(!Array.isArray(ds.backgroundColor) || !ds.backgroundColor.length){
              ds.backgroundColor=labels.map(function(label,i){return named[label]||palette[i%palette.length];});
            }
            ds.hoverBackgroundColor=ds.backgroundColor;
            ds.borderColor='#ffffff';
            ds.borderWidth=3;
          }
        });
        Chart.register({
          id:'epasExecutionCenter',
          afterDatasetsDraw:function(chart){
            if(!chart.canvas || chart.canvas.id!=='execStatusChart' || chart.config.type!=='doughnut') return;
            var meta=chart.getDatasetMeta(0);
            if(!meta || !meta.data || !meta.data.length) return;
            var total=(chart.data.datasets[0].data||[]).reduce(function(a,b){return a+(Number(b)||0);},0);
            var p=meta.data[0];
            var ctx=chart.ctx;
            ctx.save();
            ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillStyle='#0d2b48';ctx.font='700 20px Arial';ctx.fillText(String(total),p.x,p.y-5);
            ctx.fillStyle='#5f788a';ctx.font='600 10px Arial';ctx.fillText(total===1?'obra':'obras',p.x,p.y+13);
            ctx.restore();
          }
        });
      }
      try{
        if(typeof renderPlan==='function') renderPlan();
        setTimeout(function(){if(typeof refreshPlanMapView==='function') refreshPlanMapView();},180);
      }catch(e){console.warn('EPAS post-load refresh:',e);}

      var execution=document.createElement('script');
      execution.src='execution.js?v=20261016-3';
      execution.onload=function(){
        setTimeout(function(){
          var css=document.querySelector('link[data-execution-css]');
          if(css) css.href='execution.css?v=20261016-2';
        },50);
      };
      execution.onerror=function(){console.error('No se pudo cargar execution.js');};
      document.body.appendChild(execution);
    };
    core.onerror=function(){console.error('No se pudo cargar app-core.js');};
    document.body.appendChild(core);
  },0);
})();
