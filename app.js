(function(){
  setTimeout(function(){
    var core=document.createElement('script');
    core.src='app-core.js?v=20261016-2';
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
        try{
          Chart.unregister(Chart.registry.plugins.get('epasDoughnutColors'));
        }catch(e){}
        Chart.register({
          id:'epasDoughnutColors',
          beforeUpdate:function(chart){
            if(chart.config.type!=='doughnut') return;
            var ds=chart.data&&chart.data.datasets&&chart.data.datasets[0];
            var labels=chart.data&&chart.data.labels?chart.data.labels:[];
            if(!ds) return;
            ds.backgroundColor=labels.map(function(label,i){return named[label]||palette[i%palette.length];});
            ds.hoverBackgroundColor=ds.backgroundColor;
            ds.borderColor='#ffffff';
            ds.borderWidth=3;
          }
        });
      }
      try{
        if(typeof renderPlan==='function') renderPlan();
        setTimeout(function(){
          if(typeof refreshPlanMapView==='function') refreshPlanMapView();
        },180);
      }catch(e){console.warn('EPAS post-load refresh:',e);}
    };
    core.onerror=function(){console.error('No se pudo cargar app-core.js');};
    document.body.appendChild(core);
  },0);
})();
