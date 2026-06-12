'use strict';

// ── Flag emoji lookup ─────────────────────────────────────────────────────────
const FLAG_MAP = {
  'Algeria': '🇩🇿', 'Argentina': '🇦🇷', 'Australia': '🇦🇺', 'Austria': '🇦🇹',
  'Belgium': '🇧🇪', 'Bolivia': '🇧🇴', 'Brazil': '🇧🇷', 'Cameroon': '🇨🇲',
  'Canada': '🇨🇦', 'Chile': '🇨🇱', 'Colombia': '🇨🇴', 'Costa Rica': '🇨🇷',
  'Croatia': '🇭🇷', 'Czech Republic': '🇨🇿', 'Denmark': '🇩🇰', 'Ecuador': '🇪🇨',
  'Egypt': '🇪🇬', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'France': '🇫🇷', 'Germany': '🇩🇪',
  'Ghana': '🇬🇭', 'Hungary': '🇭🇺', 'Indonesia': '🇮🇩', 'Iran': '🇮🇷',
  'Iraq': '🇮🇶', 'Italy': '🇮🇹', 'Ivory Coast': '🇨🇮', 'Jamaica': '🇯🇲',
  'Japan': '🇯🇵', 'Jordan': '🇯🇴', 'Kenya': '🇰🇪', 'Mali': '🇲🇱',
  'Mexico': '🇲🇽', 'Morocco': '🇲🇦', 'Netherlands': '🇳🇱', 'New Zealand': '🇳🇿',
  'Nigeria': '🇳🇬', 'Norway': '🇳🇴', 'Panama': '🇵🇦', 'Paraguay': '🇵🇾',
  'Peru': '🇵🇪', 'Poland': '🇵🇱', 'Portugal': '🇵🇹', 'Qatar': '🇶🇦',
  'Republic of Ireland': '🇮🇪', 'Romania': '🇷🇴', 'Saudi Arabia': '🇸🇦',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Senegal': '🇸🇳', 'Serbia': '🇷🇸', 'South Africa': '🇿🇦',
  'South Korea': '🇰🇷', 'Spain': '🇪🇸', 'Sweden': '🇸🇪', 'Switzerland': '🇨🇭',
  'Togo': '🇹🇬', 'Tunisia': '🇹🇳', 'Turkey': '🇹🇷', 'Ukraine': '🇺🇦',
  'United States': '🇺🇸', 'Uruguay': '🇺🇾', 'Venezuela': '🇻🇪', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Cuba': '🇨🇺', 'Guatemala': '🇬🇹', 'Honduras': '🇭🇳', 'El Salvador': '🇸🇻',
  'Paraguay': '🇵🇾', 'Uzbekistan': '🇺🇿', 'China': '🇨🇳', 'Philippines': '🇵🇭',
  // WC 2026 teams missing from original map
  'USA': '🇺🇸',
  'Bosnia & Herzegovina': '🇧🇦', 'Bosnia and Herzegovina': '🇧🇦',
  'Cape Verde': '🇨🇻',
  'Curaçao': '🇨🇼',
  'Czechia': '🇨🇿',
  'DR Congo': '🇨🇩', 'Democratic Republic of the Congo': '🇨🇩',
  'Haiti': '🇭🇹',
};

function getFlag(name) {
  return FLAG_MAP[name] || '🏳️';
}

// ── HTML escaping for any dynamic string injected via innerHTML ───────────────
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Show a visible error banner when core bootstrap data fails to load ────────
function showAppError(message) {
  let banner = document.getElementById('app-error');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'app-error';
    banner.setAttribute('role', 'alert');
    banner.style.cssText =
      'position:fixed;top:56px;left:0;right:0;z-index:2000;background:var(--red-card);' +
      'color:#fff;padding:10px 16px;font-family:var(--font-body);font-size:13px;text-align:center;';
    document.body.appendChild(banner);
  }
  banner.textContent = message;
}

// ── WC titles lookup ──────────────────────────────────────────────────────────
const WC_TITLES = {
  'Brazil': 5, 'Germany': 4, 'Italy': 4, 'Argentina': 3,
  'France': 2, 'Uruguay': 2, 'England': 1, 'Spain': 1,
};

// ── Confederation badge class ─────────────────────────────────────────────────
function confBadgeClass(conf) {
  const map = {
    'UEFA': 'badge-conf-UEFA', 'CONMEBOL': 'badge-conf-CONMEBOL',
    'CAF': 'badge-conf-CAF', 'AFC': 'badge-conf-AFC',
    'CONCACAF': 'badge-conf-CONCACAF',
  };
  return map[conf] || 'badge-green';
}

// ── Vega embed pipeline (race-safe, version-preflight) ───────────────────────
const chartLoadSeq = {};

function vegaLibrariesReady() {
  return typeof window.vega !== 'undefined'
    && typeof window.vegaLite !== 'undefined'
    && typeof window.vegaEmbed === 'function';
}

function finalizeVegaView(el) {
  if (el && el.__vegaView) {
    try { el.__vegaView.finalize(); } catch (_) { /* already torn down */ }
    el.__vegaView = null;
  }
}

function isValidChartSpec(spec) {
  if (!spec || typeof spec !== 'object') return false;
  if (spec.error) return false;
  return Boolean(spec.$schema || spec.mark || spec.layer || spec.hconcat || spec.vconcat || spec.concat);
}

function showChartError(el, message, detail) {
  if (!el) return;
  finalizeVegaView(el);
  const detailHtml = detail
    ? `<p style="font-size:11px;margin-top:8px">${detail}</p>`
    : '';
  el.innerHTML = `<p class="chart-error">Chart unavailable: ${escapeHtml(message)}</p>${detailHtml}`;
}

async function fetchChartSpec(endpoint, retries = 1) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const r = await fetch(endpoint);
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const spec = await r.json();
      if (spec.error) throw new Error(spec.error);
      if (!isValidChartSpec(spec)) throw new Error('Invalid chart spec');
      return spec;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  throw lastErr;
}

async function embedChart(el, spec, opts = {}) {
  if (!vegaLibrariesReady()) {
    throw new Error('Vega libraries failed to load — check your network connection and refresh');
  }
  finalizeVegaView(el);
  el.innerHTML = '';
  const result = await window.vegaEmbed(el, spec, {
    renderer: 'svg',
    actions: false,
    theme: 'none',
    ...opts,
  });
  el.__vegaView = result.view;
  return result;
}

async function loadChart(elementId, endpoint, opts = {}) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const seq = (chartLoadSeq[elementId] = (chartLoadSeq[elementId] || 0) + 1);
  const mySeq = seq;

  finalizeVegaView(el);
  el.innerHTML = '<div class="skeleton-shimmer"></div>';

  try {
    const spec = await fetchChartSpec(endpoint);
    if (mySeq !== chartLoadSeq[elementId]) return;
    await embedChart(el, spec, opts);
  } catch (err) {
    if (mySeq !== chartLoadSeq[elementId]) return;
    showChartError(el, err.message);
  }
}

// ── 1. Populate all dropdowns ─────────────────────────────────────────────────
async function populateDropdowns() {
  let teams;
  try {
    const r = await fetch('/api/teams');
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    teams = await r.json();
  } catch (err) {
    showAppError(`Could not load team data (${err.message}). Some sections may be empty — try refreshing.`);
    return [];
  }
  if (!Array.isArray(teams)) return [];

  teams.sort((a, b) => a.name.localeCompare(b.name));

  const ids = ['team-selector', 'h2h-team-a', 'h2h-team-b', 'elo-selector'];
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    teams.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.name;
      opt.textContent = `${getFlag(t.name)} ${t.name}`;
      sel.appendChild(opt);
    });
  });

  // Pre-select defaults in Elo multi-selector and load chart
  const eloSel = document.getElementById('elo-selector');
  if (eloSel) {
    const defaults = ['France', 'Spain', 'Brazil', 'Argentina', 'England'];
    Array.from(eloSel.options).forEach(o => {
      o.selected = defaults.includes(o.value);
    });
    const q = defaults.map(t => `teams=${encodeURIComponent(t)}`).join('&');
    loadChart('chart-elo', `/charts/elo?${q}`);
  }

  return teams;
}

// ── 2. Load static Altair charts on page load ─────────────────────────────────
function loadAllCharts() {
  loadChart('chart-heatmap', '/charts/heatmap');
  loadChart('chart-fbref', '/charts/fbref');
  loadChart('chart-performance', '/charts/performance');
}

// ── Top Scorers table ─────────────────────────────────────────────────────────
async function loadScorers() {
  try {
    const scorers = await fetch('/api/scorers').then(r => r.json());
    const container = document.getElementById('live-scorers');
    if (!container || !Array.isArray(scorers) || scorers.length === 0) return;
    const rows = scorers.slice(0, 10).map((s, i) => {
      const rowBg = (i % 2 === 1) ? 'background:rgba(255,255,255,0.07);' : 'background:transparent;';
      return `
      <tr style="${rowBg}">
        <td style="color:var(--muted);font-size:11px;background:transparent;">${i + 1}</td>
        <td style="font-weight:500;background:transparent;">${escapeHtml(s.player)}</td>
        <td style="font-size:12px;background:transparent;">${getFlag(s.team)} ${escapeHtml(s.team)}</td>
        <td style="font-family:var(--font-data);text-align:center;font-weight:700;color:var(--trophy-gold);background:transparent;">${escapeHtml(s.goals)}</td>
        <td style="font-family:var(--font-data);text-align:center;background:transparent;">—</td>
        <td style="font-family:var(--font-data);text-align:center;background:transparent;">—</td>
      </tr>`;
    }).join('');
    container.innerHTML = `
      <table class="data-table" style="color:rgba(255,255,255,0.9);background:transparent;">
        <thead><tr>
          <th style="color:rgba(255,255,255,0.5);background:transparent;">#</th>
          <th style="color:rgba(255,255,255,0.5);background:transparent;">Player</th>
          <th style="color:rgba(255,255,255,0.5);background:transparent;">Team</th>
          <th style="color:rgba(255,255,255,0.5);background:transparent;text-align:center;">G</th>
          <th style="color:rgba(255,255,255,0.5);background:transparent;text-align:center;">A</th>
          <th style="color:rgba(255,255,255,0.5);background:transparent;text-align:center;">xG</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch {}
}

// ── 3. Overview: standings + match stats ───────────────────────────────────────
async function loadOverview() {
  // Group standings
  try {
    const r = await fetch('/api/standings');
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    const groups = await r.json();
    const container = document.getElementById('groups-container');
    if (container && Array.isArray(groups) && groups.length > 0) {
      container.innerHTML = renderStandings(groups);
      const remaining = groups.reduce(
        (n, g) => n + (g.teams || []).filter(t => t.status !== 'eliminated').length, 0);
      const teamsEl = document.getElementById('stat-teams');
      if (teamsEl) teamsEl.querySelector('.stat-number').textContent = remaining || 48;
    }
  } catch (err) {
    showAppError(`Could not load standings (${err.message}).`);
  }

  // Match stats + results strip
  try {
    const matches = await fetch('/api/matches').then(r => r.json());
    if (Array.isArray(matches)) {
      const played = matches.filter(m => m.played);
      const goals = played.reduce((s, m) => s + (m.score_h || 0) + (m.score_a || 0), 0);

      const setStatNum = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.querySelector('.stat-number').textContent = val;
      };
      setStatNum('stat-goals',   goals);
      setStatNum('stat-matches', played.length);
      setStatNum('stat-teams',   48);
      setStatNum('stat-gpm', played.length > 0 ? (goals / played.length).toFixed(1) : '—');

      const strip = document.getElementById('results-strip');
      if (strip) {
        if (played.length > 0) {
          strip.innerHTML = played.slice(-10).reverse().map(m =>
            `<span class="badge badge-green" style="font-size:12px;padding:6px 12px;border-radius:var(--radius);white-space:nowrap;">
              ${getFlag(m.home)} ${escapeHtml(m.home)} ${escapeHtml(m.score_h)}–${escapeHtml(m.score_a)} ${escapeHtml(m.away)} ${getFlag(m.away)}
              · ${m.group ? 'Group ' + escapeHtml(m.group) : escapeHtml(m.stage || '')}
            </span>`
          ).join('');
        } else {
          strip.innerHTML = '<span style="font-size:13px;color:var(--muted);padding:8px 0;">Tournament begins June 11, 2026 — no results yet</span>';
        }
      }

      // Live results panel
      renderLiveResults(played);

      // Only show LIVE badges once real results exist.
      const isLive = played.length > 0;
      const navBadge = document.getElementById('nav-live-badge');
      const liveBadge = document.getElementById('live-section-badge');
      if (navBadge) navBadge.style.display = isLive ? '' : 'none';
      if (liveBadge) liveBadge.style.display = isLive ? '' : 'none';
    }
  } catch {}

  const lu = document.getElementById('last-updated');
  if (lu) lu.textContent = new Date().toLocaleTimeString();
}

function renderStandings(groups) {
  return groups.map(g => {
    const teams = g.teams || [];
    const rows = teams.map((t, i) => {
      let trStyle = '';
      if (i < 2) trStyle = 'style="border-left:3px solid var(--data-teal);"';
      else if (t.status === 'eliminated') trStyle = 'style="opacity:0.45;"';
      const gd = (t.gd > 0 ? '+' : '') + t.gd;
      const played = (t.w || 0) + (t.d || 0) + (t.l || 0);
      const name = escapeHtml(t.name);
      return `<tr ${trStyle}>
        <td class="team-cell"><div class="team-cell-inner"><span class="team-flag">${getFlag(t.name)}</span><span class="team-name" title="${name}">${name}</span></div></td>
        <td style="text-align:center;font-family:var(--font-data);">${played}</td>
        <td style="text-align:center;font-family:var(--font-data);">${gd}</td>
        <td style="text-align:center;font-family:var(--font-data);font-weight:700;">${t.pts}</td>
      </tr>`;
    }).join('');
    return `<div class="card">
      <div style="font-family:var(--font-display);font-size:22px;color:var(--pitch-night);margin-bottom:var(--sp-sm);">Group ${escapeHtml(g.group)}</div>
      <table class="data-table standings-table">
        <thead><tr>
          <th>Team</th>
          <th style="text-align:center;">P</th>
          <th style="text-align:center;">GD</th>
          <th style="text-align:center;">Pts</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');
}

function renderLiveResults(played) {
  const liveResults = document.getElementById('live-results');
  if (!liveResults) return;
  if (played.length > 0) {
    liveResults.innerHTML = played.slice(-8).reverse().map(m =>
      `<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:var(--radius);padding:var(--sp-md);margin-bottom:var(--sp-sm);">
        <div style="font-family:var(--font-display);font-size:20px;letter-spacing:0.05em;margin-bottom:4px;">
          ${getFlag(m.home)} ${escapeHtml(m.home)}  ${escapeHtml(m.score_h ?? '?')}–${escapeHtml(m.score_a ?? '?')}  ${escapeHtml(m.away)} ${getFlag(m.away)}
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.4);">${m.group ? 'Group ' + escapeHtml(m.group) : escapeHtml(m.stage || '')} · ${escapeHtml(m.date || '')}</div>
      </div>`
    ).join('');
  } else {
    liveResults.innerHTML = `
      <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:var(--radius);padding:var(--sp-md);">
        <div style="font-size:13px;color:rgba(255,255,255,0.4);">No results yet — tournament begins June 11, 2026</div>
      </div>`;
  }
}

// ── 4. Team Explorer ──────────────────────────────────────────────────────────
let _allTeams = [];

function bindTeamExplorer() {
  const sel = document.getElementById('team-selector');
  if (!sel) return;
  sel.addEventListener('change', () => {
    if (sel.value) loadTeam(sel.value);
  });
}

async function loadTeam(country) {
  if (!country) return;

  const team = _allTeams.find(t => t.name === country) || {};

  // Update profile card
  const flagEl = document.getElementById('team-flag');
  const nameEl = document.getElementById('team-name');
  if (flagEl) flagEl.textContent = getFlag(country);
  if (nameEl) nameEl.textContent = country;

  const confBadge = document.getElementById('badge-confederation');
  const grpBadge  = document.getElementById('badge-group');
  if (confBadge) {
    confBadge.textContent  = team.confederation || '—';
    confBadge.className    = `badge ${confBadgeClass(team.confederation)}`;
  }
  if (grpBadge) {
    grpBadge.textContent = team.group ? `Group ${team.group}` : '—';
  }

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('stat-fifa-rank', team.fifa_rank ? `#${team.fifa_rank}` : '—');
  setText('stat-elo',       team.elo       || '—');
  setText('stat-value',     team.squad_value_m ? `€${Math.round(team.squad_value_m)}M` : '—');
  setText('stat-titles',    WC_TITLES[country] !== undefined ? WC_TITLES[country] : '0');
  setText('stat-coach',     '—');
  setText('stat-avg-age',   '—');
  setText('record-w',  '—');
  setText('record-d',  '—');
  setText('record-l',  '—');
  setText('record-goals', '—');

  // Load squad → compute avg age, WC record
  try {
    const squad = await fetch(`/api/squads/${encodeURIComponent(country)}`).then(r => r.json());
    if (Array.isArray(squad) && squad.length > 0) {
      const ages = squad.map(p => p.age).filter(a => a > 0);
      if (ages.length) {
        const avg = (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1);
        setText('stat-avg-age', avg);
      }
      loadSquadTable(squad);
    }
  } catch {}

  // Historical WC record
  try {
    const history = await fetch('/api/matches').then(r => r.json());
    if (Array.isArray(history)) {
      // fixtures.json holds upcoming fixtures, not historical
      // Show placeholders
    }
  } catch {}

  // Altair charts
  loadChart('chart-age',    `/charts/age/${encodeURIComponent(country)}`,    { width: 'container' });
  loadChart('chart-league', `/charts/league/${encodeURIComponent(country)}`, { width: 'container' });

  // Radar — keep current Team B
  const teamB = window.radarTeamB || 'Spain';
  window.radarTeamB = teamB;
  if (typeof window.initRadar === 'function') {
    window.initRadar(country, teamB);
  }
}

function loadSquadTable(squad) {
  const tbody = document.getElementById('squad-tbody');
  if (!tbody) return;
  tbody.innerHTML = squad.map((p, i) => `
    <tr data-pos="${escapeHtml(p.pos || '')}">
      <td style="color:var(--muted);font-size:11px;">${i + 1}</td>
      <td style="font-weight:500;">${escapeHtml(p.name || '—')}</td>
      <td><span class="badge badge-teal">${escapeHtml(p.pos || '—')}</span></td>
      <td style="font-family:var(--font-data);">${escapeHtml(p.age || '—')}</td>
      <td style="font-size:12px;color:var(--muted);">${escapeHtml(p.club || '—')}</td>
      <td style="font-family:var(--font-data);text-align:center;">${p.caps ?? '—'}</td>
      <td style="font-family:var(--font-data);text-align:center;">${p.goals ?? '—'}</td>
    </tr>`).join('');
}

// ── 5a. Heatmap confederation filter ─────────────────────────────────────────
window.filterHeatmap = function (btn) {
  document.querySelectorAll('#heatmap-filters .filter-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-pressed', 'true');
  const conf = btn.dataset.conf;
  const endpoint = conf === 'all'
    ? '/charts/heatmap'
    : `/charts/heatmap?confederation=${encodeURIComponent(conf)}`;
  loadChart('chart-heatmap', endpoint);
};

// ── 5. Squad position filter ──────────────────────────────────────────────────
window.filterSquad = function (btn) {
  // Scope to the squad filter group only, so heatmap filter state is untouched.
  const group = btn.parentElement;
  if (group) group.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-pressed', 'true');
  const pos = btn.dataset.pos;
  document.querySelectorAll('#squad-tbody tr').forEach(row => {
    row.style.display = (pos === 'all' || row.dataset.pos === pos) ? '' : 'none';
  });
};

// ── 6. H2H section ────────────────────────────────────────────────────────────
function bindH2H() {
  const selA = document.getElementById('h2h-team-a');
  const selB = document.getElementById('h2h-team-b');
  if (!selA || !selB) return;
  const update = () => loadH2H(selA.value, selB.value);
  selA.addEventListener('change', update);
  selB.addEventListener('change', update);
}

async function loadH2H(a, b) {
  if (!a || !b || a === b) return;

  const teamA = _allTeams.find(t => t.name === a) || {};
  const teamB = _allTeams.find(t => t.name === b) || {};

  // Update header cards
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('h2h-flag-a', getFlag(a));
  setText('h2h-name-a', a);
  setText('h2h-flag-b', getFlag(b));
  setText('h2h-name-b', b);
  const confA = document.getElementById('h2h-conf-a');
  const confB = document.getElementById('h2h-conf-b');
  if (confA) { confA.textContent = teamA.confederation || '—'; confA.className = `badge ${confBadgeClass(teamA.confederation)}`; }
  if (confB) { confB.textContent = teamB.confederation || '—'; confB.className = `badge ${confBadgeClass(teamB.confederation)}`; }

  // Win probability
  try {
    const pred = await fetch(`/api/predict/${encodeURIComponent(a)}/${encodeURIComponent(b)}`).then(r => r.json());
    const pa = pred.win_a || 0, pd = pred.draw || 0, pb = pred.win_b || 0;
    const probA = document.getElementById('prob-a');
    const probD = document.getElementById('prob-draw');
    const probB = document.getElementById('prob-b');
    if (probA) probA.style.flex = pa;
    if (probD) probD.style.flex = pd;
    if (probB) probB.style.flex = pb;
    setText('prob-label-a',    `${(pa * 100).toFixed(0)}%`);
    setText('prob-label-draw', `Draw ${(pd * 100).toFixed(0)}%`);
    setText('prob-label-b',    `${(pb * 100).toFixed(0)}%`);
    updateH2HMetrics(a, b, teamA, teamB, pred);
  } catch {}

  // H2H historical chart
  try {
    const h2hData = await fetch(`/api/h2h/${encodeURIComponent(a)}/${encodeURIComponent(b)}`).then(r => r.json());
    renderH2HHistory(h2hData, a, b);
  } catch (err) {
    const el = document.getElementById('chart-h2h');
    if (el) el.innerHTML = `<p class="chart-error">H2H data unavailable: ${err.message}</p>`;
  }
}

function updateH2HMetrics(a, b, teamA, teamB, pred) {
  const setMet = (id, val, highlight) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val;
    if (highlight) {
      el.style.color = 'var(--data-teal)';
    } else {
      el.style.color = '';
    }
  };

  const eA = teamA.elo || 0, eB = teamB.elo || 0;
  setMet('metric-a-elo',   eA || '—', eA >= eB && eA > 0);
  setMet('metric-b-elo',   eB || '—', eB > eA);

  const rA = teamA.fifa_rank, rB = teamB.fifa_rank;
  setMet('metric-a-rank',  rA ? `#${rA}` : '—', rA && (!rB || rA < rB));
  setMet('metric-b-rank',  rB ? `#${rB}` : '—', rB && (!rA || rB < rA));

  const vA = teamA.squad_value_m, vB = teamB.squad_value_m;
  setMet('metric-a-value', vA ? `€${Math.round(vA)}M` : '—', vA && (!vB || vA > vB));
  setMet('metric-b-value', vB ? `€${Math.round(vB)}M` : '—', vB && (!vA || vB > vA));

  const tA = WC_TITLES[a] || 0, tB = WC_TITLES[b] || 0;
  setMet('metric-a-titles', tA, tA >= tB);
  setMet('metric-b-titles', tB, tB > tA);

  // avg age placeholder (requires squad fetch — leave as — for speed)
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('metric-a-age', '—');
  setText('metric-b-age', '—');

  // Bookie
  const ba = pred.bookie_a != null ? pred.bookie_a : pred.win_a;
  const bb = pred.bookie_b != null ? pred.bookie_b : pred.win_b;
  setMet('metric-a-bookie', ba != null ? `${(ba * 100).toFixed(0)}%` : '—', ba > bb);
  setMet('metric-b-bookie', bb != null ? `${(bb * 100).toFixed(0)}%` : '—', bb > ba);
}

function renderH2HHistory(matches, nameA, nameB) {
  const el = document.getElementById('chart-h2h');
  if (!el) return;

  if (!Array.isArray(matches) || matches.length === 0) {
    el.innerHTML = `<p style="color:var(--muted);font-size:13px;padding:var(--sp-xl);text-align:center;margin:0;">
      No World Cup meetings between ${escapeHtml(nameA)} and ${escapeHtml(nameB)}
    </p>`;
    return;
  }

  // Count results and update metric spans
  let wA = 0, wB = 0, draws = 0;
  matches.forEach(m => {
    const sa = Number(m.score_a), sb = Number(m.score_b);
    if (!isNaN(sa) && !isNaN(sb)) {
      if (sa > sb) wA++;
      else if (sb > sa) wB++;
      else draws++;
    }
  });

  const setText = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  setText('metric-a-h2hwins', wA);
  setText('metric-b-h2hwins', wB);

  const last = matches[matches.length - 1];
  if (last) {
    setText('metric-a-last', `${last.score_a ?? '?'}`);
    setText('metric-b-last', `${last.score_b ?? '?'} (${last.year || '?'})`);
  }

  const rows = [...matches].reverse().map(m => {
    const sa = m.score_a ?? '?', sb = m.score_b ?? '?';
    const nsa = Number(sa), nsb = Number(sb);
    let resultHtml;
    if (!isNaN(nsa) && !isNaN(nsb)) {
      if (nsa > nsb) resultHtml = `<span style="color:var(--data-teal);font-weight:700;">${escapeHtml(nameA)}</span>`;
      else if (nsb > nsa) resultHtml = `<span style="color:var(--red-card);font-weight:700;">${escapeHtml(nameB)}</span>`;
      else resultHtml = `<span style="color:var(--muted);">Draw</span>`;
    } else {
      resultHtml = '<span style="color:var(--muted);">—</span>';
    }
    return `<tr>
      <td style="font-family:var(--font-data);">${escapeHtml(m.year || '?')}</td>
      <td style="font-size:12px;color:var(--muted);">${escapeHtml(m.stage || '—')}</td>
      <td style="font-family:var(--font-display);font-size:18px;text-align:center;">${escapeHtml(sa)} – ${escapeHtml(sb)}</td>
      <td>${resultHtml}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="card" style="overflow-x:auto;">
      <div style="font-family:var(--font-display);font-size:20px;color:var(--pitch-night);margin-bottom:var(--sp-sm);">
        World Cup History · ${escapeHtml(nameA)} vs ${escapeHtml(nameB)}
      </div>
      <div style="display:flex;gap:var(--sp-lg);margin-bottom:var(--sp-md);align-items:center;">
        <span style="font-family:var(--font-display);font-size:28px;color:var(--data-teal);">${wA}</span>
        <span style="font-family:var(--font-body);font-size:12px;color:var(--muted);">–${draws}–</span>
        <span style="font-family:var(--font-display);font-size:28px;color:var(--red-card);">${wB}</span>
        <span style="font-size:11px;color:var(--muted);margin-left:auto;">${matches.length} meetings</span>
      </div>
      <table class="data-table">
        <thead><tr>
          <th>Year</th><th>Stage</th>
          <th style="text-align:center;">Score</th><th>Winner</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── 7. Elo history selector ────────────────────────────────────────────────────
function bindEloSelector() {
  const sel = document.getElementById('elo-selector');
  if (!sel) return;
  sel.addEventListener('change', () => {
    const selected = Array.from(sel.selectedOptions).map(o => o.value);
    if (selected.length === 0) return;
    const q = selected.map(t => `teams=${encodeURIComponent(t)}`).join('&');
    loadChart('chart-elo', `/charts/elo?${q}`);
  });
}

// ── 9. Live refresh ───────────────────────────────────────────────────────────
function bindRefresh() {
  const btn = document.getElementById('btn-refresh');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.textContent = 'Refreshing…';
    btn.disabled = true;
    try {
      const refreshResp = await fetch('/api/refresh', { method: 'POST' });
      if (!refreshResp.ok) {
        // 503 = live sync disabled on this deployment; reload from static data anyway.
        const info = await refreshResp.json().catch(() => ({}));
        if (refreshResp.status !== 503) {
          showAppError(`Live refresh failed (${info.error || refreshResp.status}).`);
        }
      }

      const matches = await fetch('/api/matches').then(r => r.json());
      if (Array.isArray(matches)) {
        const played = matches.filter(m => m.played);
        renderLiveResults(played);
        const goals = played.reduce((s, m) => s + (m.score_h || 0) + (m.score_a || 0), 0);
        const setStatNum = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.querySelector('.stat-number').textContent = val;
        };
        setStatNum('stat-goals',   goals);
        setStatNum('stat-matches', played.length);
        setStatNum('stat-gpm', played.length > 0 ? (goals / played.length).toFixed(1) : '—');
      }

      const groups = await fetch('/api/standings').then(r => r.json());
      if (Array.isArray(groups)) {
        const container = document.getElementById('groups-container');
        if (container) container.innerHTML = renderStandings(groups);
      }

      // Reload every live-dependent visual, not just the goals chart.
      loadChart('chart-fbref', '/charts/fbref');
      loadChart('chart-performance', '/charts/performance');
      loadScorers();

      const lu = document.getElementById('last-updated');
      if (lu) lu.textContent = new Date().toLocaleTimeString();
    } catch (err) {
      showAppError(`Refresh failed (${err.message}).`);
    } finally {
      btn.textContent = 'Refresh';
      btn.disabled = false;
    }
  });
}

// ── 10. Smooth scroll + IntersectionObserver nav ──────────────────────────────
function bindNav() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const sections = Array.from(document.querySelectorAll('section[id]'));
  if (!sections.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        document.querySelectorAll('.nav-link').forEach(link => {
          link.classList.toggle('nav-link-active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { threshold: 0.25, rootMargin: '-56px 0px 0px 0px' });

  sections.forEach(s => observer.observe(s));
}

// ─── FOCUS CHART — The Credibility Gap ──────────────────────────────────────

async function loadCredibilityChart() {
  const elementId = 'chart-credibility';
  const container = document.getElementById(elementId);
  if (!container) return;

  const seq = (chartLoadSeq[elementId] = (chartLoadSeq[elementId] || 0) + 1);
  const mySeq = seq;

  finalizeVegaView(container);
  container.textContent = 'Computing probabilities…';

  try {
    const spec = await fetchChartSpec('/charts/credibility-gap');
    if (mySeq !== chartLoadSeq[elementId]) return;

    const result = await embedChart(container, spec, {
      tooltip: { theme: 'light' },
    });
    if (mySeq !== chartLoadSeq[elementId]) return;

    // Purposeful interactivity: click dot → jump to Team Explorer
    result.view.addSignalListener('team_click_tuple', (_name, value) => {
      const badge = document.getElementById('credibility-selected-team');
      if (!value) {
        if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
        return;
      }
      const selectedTeam = value.values && value.values[0];
      if (!selectedTeam) return;

      if (badge) {
        badge.style.display = 'block';
        badge.textContent = `Selected: ${selectedTeam}`;
      }

      const teamSelector = document.getElementById('team-selector');
      if (teamSelector) {
        teamSelector.value = selectedTeam;
        teamSelector.dispatchEvent(new Event('change'));
      }

      setTimeout(() => {
        const teamsSection = document.getElementById('teams');
        if (teamsSection) teamsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    });

    const teamsResp = await fetch('/api/teams');
    if (teamsResp.ok) {
      const teams = await teamsResp.json();
      if (teams && Array.isArray(teams)) renderCredibilityInsights(teams);
    }
  } catch (err) {
    if (mySeq !== chartLoadSeq[elementId]) return;
    showChartError(
      container,
      err.message,
      'Check that <code>/charts/credibility-gap</code> returns valid JSON.',
    );
  }
}

function renderCredibilityInsights(teams) {
  const container = document.getElementById('credibility-insights')
  if (!container || teams.length === 0) return

  // Elo softmax matches the server-side credibility chart.
  const elos = teams.map(t => t.elo || 1700)
  const meanElo = elos.reduce((s, v) => s + v, 0) / elos.length
  const temp = 350
  const expElos = elos.map(e => Math.exp((e - meanElo) / temp))
  const sumExp = expElos.reduce((s, v) => s + v, 0)
  const eloProbs = expElos.map(e => (e / sumExp) * 100)

  // Bookmaker probabilities come straight from the API (master_teams.implied_prob),
  // so there is a single source of truth shared with the server.
  const rawImplied = teams.map(t => (t.implied_prob != null ? t.implied_prob : 0))
  const sumImplied = rawImplied.reduce((s, v) => s + v, 0) || 1
  const bookieProbs = rawImplied.map(p => (p / sumImplied) * 100)

  const withDivergence = teams.map((t, i) => ({
    ...t,
    elo_prob: eloProbs[i],
    bookie_prob: bookieProbs[i],
    divergence: eloProbs[i] - bookieProbs[i],
  })).sort((a, b) => b.divergence - a.divergence)

  const topModelPick = withDivergence[0]
  const mostOverrated = withDivergence[withDivergence.length - 1]
  const top10 = [...withDivergence].sort((a, b) => b.elo_prob - a.elo_prob).slice(0, 10)
  const mostAgreed = top10.reduce((prev, curr) =>
    Math.abs(curr.divergence) < Math.abs(prev.divergence) ? curr : prev
  )

  const insightCards = [
    {
      label: 'Model most bullish vs market',
      team: topModelPick.name,
      value: `+${topModelPick.divergence.toFixed(2)}pp`,
      desc: `Elo gives ${topModelPick.name} ${topModelPick.elo_prob.toFixed(1)}% vs bookmakers' ${topModelPick.bookie_prob.toFixed(1)}%`,
      color: '#0F766E',
      bg: '#F0FDF9',
    },
    {
      label: 'Market most bullish vs model',
      team: mostOverrated.name,
      value: `${mostOverrated.divergence.toFixed(2)}pp`,
      desc: `Bookmakers give ${mostOverrated.name} ${mostOverrated.bookie_prob.toFixed(1)}% vs Elo's ${mostOverrated.elo_prob.toFixed(1)}%`,
      color: '#C42B2B',
      bg: '#FEF2F2',
    },
    {
      label: 'Best agreement (top 10)',
      team: mostAgreed.name,
      value: `${Math.abs(mostAgreed.divergence).toFixed(2)}pp gap`,
      desc: `Both models are closely aligned on ${mostAgreed.name}'s chances`,
      color: '#D4A017',
      bg: '#FFFBEB',
    },
  ]

  container.innerHTML = insightCards.map(card => `
    <div class="card" style="background: ${card.bg}; border-left: 3px solid ${card.color}; padding: var(--sp-md);">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
                  color: ${card.color}; margin-bottom: 4px; font-family: var(--font-body);">
        ${escapeHtml(card.label)}
      </div>
      <div style="font-family: var(--font-display); font-size: 28px; color: var(--pitch-night); line-height: 1;">
        ${escapeHtml(card.team)}
      </div>
      <div style="font-family: var(--font-data); font-size: 18px; color: ${card.color}; font-weight: 700; margin: 2px 0 6px;">
        ${escapeHtml(card.value)}
      </div>
      <div style="font-size: 12px; color: var(--slate); line-height: 1.5; font-family: var(--font-body);">
        ${escapeHtml(card.desc)}
      </div>
    </div>
  `).join('')
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Fire all static chart loads immediately (no dependencies)
  loadAllCharts();

  // Load overview data
  loadOverview();
  loadScorers();

  // Populate dropdowns and store team list
  _allTeams = await populateDropdowns();

  // Wire up all interactive sections
  bindTeamExplorer();
  bindH2H();
  bindEloSelector();
  bindRefresh();
  bindNav();

  // Init D3 charts
  if (typeof window.initBracket === 'function') window.initBracket();
  if (typeof window.initRadar   === 'function') window.initRadar('France', 'Spain');

  // Focus chart — loaded last (heaviest computation)
  loadCredibilityChart();
});
