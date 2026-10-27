(function(){
  function formatObservationTooltip(cell){
    if(!cell || cell.dataset.timelineFormatted==='1') return;
    const raw=(cell.getAttribute('data-tip')||'').trim();
    if(!raw) return;
    const parts=raw.split(';').map(s=>s.trim()).filter(Boolean);
    if(parts.length>1){
      cell.setAttribute('data-tip',parts.map(p=>'• '+p).join('\n'));
    }
    cell.dataset.timelineFormatted='1';
  }

  function apply(){
    document.querySelectorAll('#execBody .execution-progress-cell.exec-tooltip').forEach(formatObservationTooltip);
  }

  function start(){
    apply();
    const body=document.getElementById('execBody');
    if(!body){setTimeout(start,250);return;}
    const observer=new MutationObserver(()=>requestAnimationFrame(apply));
    observer.observe(body,{childList:true,subtree:true,attributes:false});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
  else start();
})();
