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
      }
      try{
        if(typeof renderPlan==='function') renderPlan();
        setTimeout(function(){if(typeof refreshPlanMapView==='function') refreshPlanMapView();},180);
      }catch(e){console.warn('EPAS post-load refresh:',e);}

      var planV2=document.createElement('script');
      planV2.src='plan-table-v2.js?v=20261021-1';
      planV2.onerror=function(){console.error('No se pudo cargar plan-table-v2.js');};
      document.body.appendChild(planV2);

      var contracts=document.createElement('script');
      contracts.src='contracts-source-v2.js?v=20261023-1';
      contracts.onerror=function(){console.error('No se pudo cargar contracts-source-v2.js');};
      document.body.appendChild(contracts);

      var purchases=document.createElement('script');
      purchases.src='purchases.js?v=20261022-1';
      purchases.onerror=function(){console.error('No se pudo cargar purchases.js');};
      document.body.appendChild(purchases);

      var execution=document.createElement('script');
      execution.src='execution.js?v=20261016-4';
      execution.onload=function(){
        setTimeout(function(){
          var css=document.querySelector('link[data-execution-css]');
          if(css) css.href='execution.css?v=20261016-3';

          var layout=document.querySelector('link[data-execution-layout]');
          if(!layout){
            layout=document.createElement('link');
            layout.rel='stylesheet';
            layout.href='execution-layout-v4.css?v=20261016-1';
            layout.dataset.executionLayout='1';
            document.head.appendChild(layout);
          }

          var compact=document.querySelector('link[data-execution-compact]');
          if(!compact){
            compact=document.createElement('link');
            compact.rel='stylesheet';
            compact.href='execution-compact.css?v=20261027-1';
            compact.dataset.executionCompact='1';
            document.head.appendChild(compact);
          }else{
            compact.href='execution-compact.css?v=20261027-1';
          }
        },50);
      };
      execution.onerror=function(){console.error('No se pudo cargar execution.js');};
      document.body.appendChild(execution);
    };
    core.onerror=function(){console.error('No se pudo cargar app-core.js');};
    document.body.appendChild(core);
  },0);
})();
