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

// ── Core chart loader ─────────────────────────────────────────────────────────
async function loadChart(elementId, endpoint, opts = {}) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = '<div class="skeleton-shimmer"></div>';
  try {
    const spec = await fetch(endpoint).then(r => r.json());
    if (spec.error) throw new Error(spec.error);
    el.innerHTML = '';
    await vegaEmbed(`#${elementId}`, spec, {
      renderer: 'svg',
      actions: false,
      theme: 'none',
      ...opts,
    });
  } catch (err) {
    el.innerHTML = `<p class="chart-error">Chart unavailable: ${err.message}</p>`;
  }
}

// ── 1. Populate all dropdowns ─────────────────────────────────────────────────
async function populateDropdowns() {
  let teams;
  try {
    teams = await fetch('/api/teams').then(r => r.json());
  } catch {
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
    const rows = scorers.slice(0, 10).map((s, i) => `
      <tr>
        <td style="color:var(--muted);font-size:11px;background:transparent;">${i + 1}</td>
        <td style="font-weight:500;background:transparent;">${s.player}</td>
        <td style="font-size:12px;background:transparent;">${getFlag(s.team)} ${s.team}</td>
        <td style="font-family:var(--font-data);text-align:center;font-weight:700;color:var(--trophy-gold);background:transparent;">${s.goals}</td>
        <td style="font-family:var(--font-data);text-align:center;background:transparent;">—</td>
        <td style="font-family:var(--font-data);text-align:center;background:transparent;">—</td>
      </tr>`).join('');
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
    const groups = await fetch('/api/standings').then(r => r.json());
    const container = document.getElementById('groups-container');
    if (container && Array.isArray(groups) && groups.length > 0) {
      container.innerHTML = '';
      groups.forEach(g => {
        const teams = g.teams || [];
        const rows = teams.map((t, i) => {
          let trStyle = '';
          if (i < 2) trStyle = 'style="border-left:3px solid var(--data-teal);"';
          else if (t.status === 'eliminated') trStyle = 'style="opacity:0.45;"';
          const gd = (t.gd > 0 ? '+' : '') + t.gd;
          const played = (t.w || 0) + (t.d || 0) + (t.l || 0);
          return `<tr ${trStyle}>
            <td class="team-cell"><div class="team-cell-inner"><span class="team-flag">${getFlag(t.name)}</span><span class="team-name" title="${t.name}">${t.name}</span></div></td>
            <td style="text-align:center;font-family:var(--font-data);">${played}</td>
            <td style="text-align:center;font-family:var(--font-data);">${gd}</td>
            <td style="text-align:center;font-family:var(--font-data);font-weight:700;">${t.pts}</td>
          </tr>`;
        }).join('');
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div style="font-family:var(--font-display);font-size:22px;color:var(--pitch-night);margin-bottom:var(--sp-sm);">Group ${g.group}</div>
          <table class="data-table standings-table">
            <thead><tr>
              <th>Team</th>
              <th style="text-align:center;">P</th>
              <th style="text-align:center;">GD</th>
              <th style="text-align:center;">Pts</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
        container.appendChild(card);
      });
    }
  } catch {}

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
      setStatNum('stat-xg', played.length > 0 ? (goals / played.length).toFixed(1) : '—');

      const strip = document.getElementById('results-strip');
      if (strip) {
        if (played.length > 0) {
          strip.innerHTML = played.slice(-10).reverse().map(m =>
            `<span class="badge badge-green" style="font-size:12px;padding:6px 12px;border-radius:var(--radius);white-space:nowrap;">
              ${getFlag(m.home)} ${m.home} ${m.score_h}–${m.score_a} ${m.away} ${getFlag(m.away)}
              · ${m.group ? 'Group ' + m.group : m.stage || ''}
            </span>`
          ).join('');
        } else {
          strip.innerHTML = '<span style="font-size:13px;color:var(--muted);padding:8px 0;">Tournament begins June 11, 2026 — no results yet</span>';
        }
      }

      // Live results panel
      renderLiveResults(played);
    }
  } catch {}

  const lu = document.getElementById('last-updated');
  if (lu) lu.textContent = new Date().toLocaleTimeString();
}

function renderLiveResults(played) {
  const liveResults = document.getElementById('live-results');
  if (!liveResults) return;
  if (played.length > 0) {
    liveResults.innerHTML = played.slice(-8).reverse().map(m =>
      `<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:var(--radius);padding:var(--sp-md);margin-bottom:var(--sp-sm);">
        <div style="font-family:var(--font-display);font-size:20px;letter-spacing:0.05em;margin-bottom:4px;">
          ${getFlag(m.home)} ${m.home}  ${m.score_h ?? '?'}–${m.score_a ?? '?'}  ${m.away} ${getFlag(m.away)}
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.4);">${m.group ? 'Group ' + m.group : m.stage || ''} · ${m.date || ''}</div>
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
    <tr data-pos="${p.pos || ''}">
      <td style="color:var(--muted);font-size:11px;">${i + 1}</td>
      <td style="font-weight:500;">${p.name || '—'}</td>
      <td><span class="badge badge-teal">${p.pos || '—'}</span></td>
      <td style="font-family:var(--font-data);">${p.age || '—'}</td>
      <td style="font-size:12px;color:var(--muted);">${p.club || '—'}</td>
      <td style="font-family:var(--font-data);text-align:center;">${p.caps ?? '—'}</td>
      <td style="font-family:var(--font-data);text-align:center;">${p.goals ?? '—'}</td>
    </tr>`).join('');
}

// ── 5a. Heatmap confederation filter ─────────────────────────────────────────
window.filterHeatmap = function (btn) {
  document.querySelectorAll('#heatmap-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const conf = btn.dataset.conf;
  const endpoint = conf === 'all'
    ? '/charts/heatmap'
    : `/charts/heatmap?confederation=${encodeURIComponent(conf)}`;
  loadChart('chart-heatmap', endpoint);
};

// ── 5. Squad position filter ──────────────────────────────────────────────────
window.filterSquad = function (btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
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
      No World Cup meetings between ${nameA} and ${nameB}
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
      if (nsa > nsb) resultHtml = `<span style="color:var(--data-teal);font-weight:700;">${nameA}</span>`;
      else if (nsb > nsa) resultHtml = `<span style="color:var(--red-card);font-weight:700;">${nameB}</span>`;
      else resultHtml = `<span style="color:var(--muted);">Draw</span>`;
    } else {
      resultHtml = '<span style="color:var(--muted);">—</span>';
    }
    return `<tr>
      <td style="font-family:var(--font-data);">${m.year || '?'}</td>
      <td style="font-size:12px;color:var(--muted);">${m.stage || '—'}</td>
      <td style="font-family:var(--font-display);font-size:18px;text-align:center;">${sa} – ${sb}</td>
      <td>${resultHtml}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="card" style="overflow-x:auto;">
      <div style="font-family:var(--font-display);font-size:20px;color:var(--pitch-night);margin-bottom:var(--sp-sm);">
        World Cup History · ${nameA} vs ${nameB}
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
      await fetch('/api/refresh', { method: 'POST' });
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
        setStatNum('stat-xg', played.length > 0 ? (goals / played.length).toFixed(1) : '—');
      }
      const groups = await fetch('/api/standings').then(r => r.json());
      if (Array.isArray(groups)) {
        const container = document.getElementById('groups-container');
        if (container) {
          container.innerHTML = '';
          groups.forEach(g => {
            const teams = g.teams || [];
            const rows = teams.map((t, i) => {
              let trStyle = '';
              if (i < 2) trStyle = 'style="border-left:3px solid var(--data-teal);"';
              else if (t.status === 'eliminated') trStyle = 'style="opacity:0.45;"';
              const gd = (t.gd > 0 ? '+' : '') + t.gd;
              const played = (t.w || 0) + (t.d || 0) + (t.l || 0);
              return `<tr ${trStyle}>
                <td class="team-cell"><div class="team-cell-inner"><span class="team-flag">${getFlag(t.name)}</span><span class="team-name" title="${t.name}">${t.name}</span></div></td>
                <td style="text-align:center;font-family:var(--font-data);">${played}</td>
                <td style="text-align:center;font-family:var(--font-data);">${gd}</td>
                <td style="text-align:center;font-family:var(--font-data);font-weight:700;">${t.pts}</td>
              </tr>`;
            }).join('');
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
              <div style="font-family:var(--font-display);font-size:22px;color:var(--pitch-night);margin-bottom:var(--sp-sm);">Group ${g.group}</div>
              <table class="data-table standings-table">
                <thead><tr>
                  <th>Team</th>
                  <th style="text-align:center;">P</th>
                  <th style="text-align:center;">GD</th>
                  <th style="text-align:center;">Pts</th>
                </tr></thead>
                <tbody>${rows}</tbody>
              </table>`;
            container.appendChild(card);
          });
        }
      }
      loadChart('chart-fbref', '/charts/fbref');
      const lu = document.getElementById('last-updated');
      if (lu) lu.textContent = new Date().toLocaleTimeString();
    } catch {
      // silently fail — error state already shown in chart containers
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
  const container = document.getElementById('chart-credibility')
  if (!container) return

  try {
    container.textContent = 'Computing probabilities…'

    const spec = await fetch('/charts/credibility-gap').then(r => r.json())
    if (spec.error) throw new Error(spec.error)

    const result = await vegaEmbed('#chart-credibility', spec, {
      renderer: 'svg',
      actions: false,
      theme: 'none',
      tooltip: { theme: 'light' },
    })

    // Purposeful interactivity: click dot → jump to Team Explorer
    // Listen on _tuple signal which holds the most recently clicked datum
    result.view.addSignalListener('team_click_tuple', (_name, value) => {
      const badge = document.getElementById('credibility-selected-team')
      if (!value) {
        if (badge) { badge.style.display = 'none'; badge.textContent = '' }
        return
      }
      // values array contains selected field values in order of fields:["name"]
      const selectedTeam = value.values && value.values[0]
      if (!selectedTeam) return

      if (badge) { badge.style.display = 'block'; badge.textContent = `Selected: ${selectedTeam}` }

      const teamSelector = document.getElementById('team-selector')
      if (teamSelector) {
        teamSelector.value = selectedTeam
        teamSelector.dispatchEvent(new Event('change'))
      }

      setTimeout(() => {
        const teamsSection = document.getElementById('teams')
        if (teamsSection) teamsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    })

    // Render insight cards
    const teams = await fetch('/api/teams').then(r => r.json())
    if (teams && Array.isArray(teams)) renderCredibilityInsights(teams)

  } catch (err) {
    const el = document.getElementById('chart-credibility')
    if (el) {
      el.innerHTML = `
        <div class="chart-error">
          <p>⚠ Chart unavailable: ${err.message}</p>
          <p style="font-size:11px; margin-top:8px">
            Check that <code>/charts/credibility-gap</code> returns valid JSON.
          </p>
        </div>`
    }
    console.error('Credibility chart error:', err)
  }
}

function renderCredibilityInsights(teams) {
  const container = document.getElementById('credibility-insights')
  if (!container || teams.length === 0) return

  // Same American odds as Python — hardcoded to match server-side computation
  const AMERICAN_ODDS = {
    'Argentina': -150, 'France': 400, 'Brazil': 450, 'England': 600,
    'Spain': 700, 'Germany': 1000, 'Portugal': 1400, 'Netherlands': 2000,
    'United States': 2500, 'Uruguay': 2500, 'Colombia': 3000, 'Morocco': 3000,
    'Belgium': 3500, 'Mexico': 3500, 'Japan': 5000, 'Croatia': 5000,
    'Canada': 4500, 'Turkey': 8000, 'Austria': 8000, 'Switzerland': 8000,
    'South Korea': 10000, 'Ecuador': 10000, 'Senegal': 8000, 'Ivory Coast': 12000,
    'Norway': 15000, 'Sweden': 12000, 'Algeria': 20000, 'Ghana': 20000,
    'Scotland': 25000, 'Tunisia': 25000, 'Egypt': 20000, 'Paraguay': 30000,
    'Czechia': 20000, 'Bosnia and Herzegovina': 25000, 'Iran': 30000,
    'Saudi Arabia': 35000, 'Australia': 25000, 'DR Congo': 40000,
    'South Africa': 50000, 'Panama': 50000, 'Cape Verde': 50000, 'Iraq': 60000,
    'New Zealand': 75000, 'Uzbekistan': 75000, 'Jordan': 75000, 'Qatar': 75000,
    'Curaçao': 100000, 'Haiti': 150000,
  }

  function americanToProb(odds) {
    if (odds >= 0) return 100 / (odds + 100)
    return Math.abs(odds) / (Math.abs(odds) + 100) * 100
  }

  const elos = teams.map(t => t.elo || 1700)
  const meanElo = elos.reduce((s, v) => s + v, 0) / elos.length
  const temp = 350
  const expElos = elos.map(e => Math.exp((e - meanElo) / temp))
  const sumExp = expElos.reduce((s, v) => s + v, 0)
  const eloProbs = expElos.map(e => (e / sumExp) * 100)

  const rawImplied = teams.map(t => americanToProb(AMERICAN_ODDS[t.name] ?? 10000))
  const sumImplied = rawImplied.reduce((s, v) => s + v, 0)
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
        ${card.label}
      </div>
      <div style="font-family: var(--font-display); font-size: 28px; color: #111; line-height: 1;">
        ${card.team}
      </div>
      <div style="font-family: var(--font-data); font-size: 18px; color: ${card.color}; font-weight: 700; margin: 2px 0 6px;">
        ${card.value}
      </div>
      <div style="font-size: 12px; color: #6B7280; line-height: 1.5; font-family: var(--font-body);">
        ${card.desc}
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
