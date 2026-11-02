(function(){
  function buildQuickLinks(){
    if(document.getElementById('epasQuickLinks')) return;

    var css=document.querySelector('link[data-quick-links]');
    if(!css){
      css=document.createElement('link');
      css.rel='stylesheet';
      css.href='quick-links.css?v=20261102-1';
      css.dataset.quickLinks='1';
      document.head.appendChild(css);
    }

    var wrap=document.createElement('aside');
    wrap.id='epasQuickLinks';
    wrap.className='epas-quicklinks';
    wrap.setAttribute('aria-label','Links importantes');
    wrap.innerHTML=`
      <div class="epas-quicklinks-panel" id="epasQuickLinksPanel">
        <div class="epas-quicklinks-panel-head">
          <strong>Links importantes</strong>
          <button class="epas-quicklinks-close" id="epasQuickLinksClose" type="button" aria-label="Cerrar">×</button>
        </div>
        <div class="epas-quicklinks-list">
          <a class="epas-quicklink" href="https://www.google.com/maps/d/u/0/edit?mid=1mRK8e0ugOTRpZe0kDLJVW02mrCvMHZw&usp=sharing" target="_blank" rel="noopener noreferrer">
            <span class="epas-quicklink-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>
            </span>
            <span class="epas-quicklink-copy">
              <strong>BARRIOS - LOTEOS - ASENTAMIENTOS IMUH</strong>
              <small>Abrir mapa en Google My Maps</small>
            </span>
          </a>
        </div>
      </div>
      <button class="epas-quicklinks-toggle" id="epasQuickLinksToggle" type="button" aria-expanded="false" aria-controls="epasQuickLinksPanel">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>
        <span>Links importantes</span>
      </button>`;

    document.body.appendChild(wrap);

    var toggle=document.getElementById('epasQuickLinksToggle');
    var close=document.getElementById('epasQuickLinksClose');
    function setOpen(open){
      wrap.classList.toggle('open',open);
      toggle.setAttribute('aria-expanded',open?'true':'false');
    }
    toggle.addEventListener('click',function(){setOpen(!wrap.classList.contains('open'));});
    close.addEventListener('click',function(){setOpen(false);});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')setOpen(false);});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',buildQuickLinks);
  else buildQuickLinks();
})();
