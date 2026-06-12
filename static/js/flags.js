(function () {
  'use strict';

  const SIZES = { sm: 20, md: 32, lg: 48 };
  let _codes = {};
  let _ready = null;

  function ensureReady() {
    if (!_ready) {
      _ready = fetch('/static/data/flag-codes.json')
        .then(r => (r.ok ? r.json() : {}))
        .then(c => { _codes = { ..._codes, ...c }; })
        .catch(() => {});
    }
    return _ready;
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
    const width = px || 40;
    return `https://flagcdn.com/w${width}/${codeFor(name)}.png`;
  }

  function renderHtml(name, size) {
    if (!name) return '';
    const sz = size || 'sm';
    const px = SIZES[sz] || 20;
    const srcW = px * 2;
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
