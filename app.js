// EPAS hotfix loader 2026-10-15.
// Carga la versión funcional anterior y corrige el proveedor de mapas y las etiquetas de gráficos.
(function(){
  const BASE_APP='https://cdn.jsdelivr.net/gh/jmlopezosornio/epas-dashboard@5f4419057b40987ad44a6f95c1c48388ee63f701/app.js';

  // Evita el error “API KEY REQUIRED” del proveedor de mapas anterior.
  if(window.L && L.tileLayer){
    const originalTileLayer=L.tileLayer;
    L.tileLayer=function(url,options){
      if(typeof url==='string' && url.includes('basemaps.cartocdn.com')){
        url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        options=Object.assign({},options||{},{maxZoom:18,attribution:'© OpenStreetMap'});
      }
      return originalTileLayer.call(L,url,options);
    };
  }

  const script=document.createElement('script');
  script.src=BASE_APP;
  script.async=false;
  script.onload=function(){
    // Asegura que los gráficos horizontales muestren nombres de localidades, no índices 0,1,2…
    try{
      createBar=function(name,canvasId,labels,data,horizontal=false){
        if(state.charts[name]){state.charts[name].destroy();state.charts[name]=null;}
        const scales=horizontal
          ? {x:{grid:{display:true},ticks:{callback:v=>fmtCompactMoney(v)}},y:{grid:{display:false},ticks:{callback:function(v){return this.getLabelForValue(v);}}}}
          : {x:{grid:{display:false}},y:{grid:{display:true},ticks:{callback:v=>fmtCompactMoney(v)}}};
        state.charts[name]=new Chart(document.getElementById(canvasId),{
          type:'bar',
          data:{labels,datasets:[{data,borderRadius:7,maxBarThickness:52}]},
          options:{responsive:true,maintainAspectRatio:false,indexAxis:horizontal?'y':'x',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtMoney(c.raw)}}},scales}
        });
      };
    }catch(e){console.warn('No se pudo aplicar la corrección de gráficos:',e);}

    // Si los datos ya terminaron de cargar, fuerza un repintado con la corrección aplicada.
    setTimeout(function(){
      try{ if(typeof renderPlan==='function' && typeof state!=='undefined' && (state.works?.length || state.projects?.length)) renderPlan(); }catch(e){}
    },700);
  };
  script.onerror=function(){console.error('No se pudo cargar la base funcional del dashboard.');};
  document.head.appendChild(script);
})();
