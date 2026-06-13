(function () {
  'use strict';

  const SIZES = { sm: 20, md: 32, lg: 48 };
  const VALID_W = [20, 40, 80, 160, 320, 640, 1280, 2560];
  function snapW(w) { return VALID_W.find(vw => vw >= w) || 2560; }

  let _codes = {
    "Algeria":"dz","Argentina":"ar","Australia":"au","Austria":"at",
    "Belgium":"be","Bosnia and Herzegovina":"ba","Brazil":"br","Canada":"ca",
    "Cape Verde":"cv","Colombia":"co","Croatia":"hr","Curaçao":"cw",
    "Czechia":"cz","DR Congo":"cd","Ecuador":"ec","Egypt":"eg",
    "England":"gb-eng","France":"fr","Germany":"de","Ghana":"gh",
    "Haiti":"ht","Iran":"ir","Iraq":"iq","Ivory Coast":"ci",
    "Japan":"jp","Jordan":"jo","Mexico":"mx","Morocco":"ma",
    "Netherlands":"nl","New Zealand":"nz","Norway":"no","Panama":"pa",
    "Paraguay":"py","Portugal":"pt","Qatar":"qa","Saudi Arabia":"sa",
    "Scotland":"gb-sct","Senegal":"sn","South Africa":"za","South Korea":"kr",
    "Spain":"es","Sweden":"se","Switzerland":"ch","Tunisia":"tn",
    "Turkey":"tr","United States":"us","Uruguay":"uy","Uzbekistan":"uz"
  };

  function ensureReady() {
    return Promise.resolve();
  }

  function init(teams) {
    if (!Array.isArray(teams)) return;
    teams.forEach(t => {
      if (t.name && t.flag_code) _codes[t.name] = t.flag_code;
    });
  }

  function codeFor(name) {
    if (!name) return 'un';
    return _codes[name] || 'un';
  }

  function urlFor(name, px) {
    const width = snapW(px || 40);
    return `https://flagcdn.com/w${width}/${codeFor(name)}.png`;
  }

  function renderHtml(name, size) {
    if (!name) return '';
    const sz = size || 'sm';
    const px = SIZES[sz] || 20;
    const srcW = snapW(px * 2);
    const h = Math.round(px * 0.75);
    const src = urlFor(name, srcW);
    const fallback = `https://flagcdn.com/w${srcW}/un.png`;
    return `<img class="flag-icon flag-icon--${sz}" src="${src}" alt="" width="${px}" height="${h}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}';">`;
  }

  function setElement(el, name, size) {
    if (!el) return;
    el.innerHTML = name ? renderHtml(name, size || 'lg') : '';
  }

  function clearElement(el) {
    if (el) el.innerHTML = '';
  }

  window.Flags = {
    ensureReady,
    init,
    codeFor,
    urlFor,
    renderHtml,
    setElement,
    clearElement,
  };
}());
