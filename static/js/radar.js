(function () {
  'use strict';

  // Exact club names as they appear in master_squads.json
  const TOP5 = new Set([
    // Premier League
    'Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United',
    'Tottenham Hotspur', 'Newcastle United', 'Aston Villa', 'West Ham United',
    'Brighton & Hove Albion', 'Brentford', 'Fulham', 'Crystal Palace', 'Everton',
    'Nottingham Forest', 'Bournemouth', 'Wolverhampton Wanderers', 'Leicester City',
    'Ipswich Town', 'Southampton', 'Leeds United', 'Burnley',
    // La Liga
    'Real Madrid', 'Barcelona', 'Atlético Madrid', 'Athletic Bilbao', 'Villarreal',
    'Sevilla', 'Real Sociedad', 'Valencia', 'Real Betis', 'Girona', 'Las Palmas',
    'Espanyol', 'Celta Vigo', 'Mallorca', 'Rayo Vallecano', 'Alavés', 'Leganés',
    'Getafe', 'Osasuna',
    // Serie A
    'Juventus', 'Inter Milan', 'Napoli', 'Roma', 'Lazio', 'Atalanta', 'Fiorentina',
    'Torino', 'Bologna', 'Udinese', 'Genoa', 'Cagliari', 'Parma', 'Empoli',
    'Hellas Verona', 'Como', 'Monza', 'Lecce', 'Venezia', 'Milan',
    // Bundesliga
    'Bayern Munich', 'Borussia Dortmund', 'Bayer Leverkusen', 'RB Leipzig',
    'Eintracht Frankfurt', 'VfB Stuttgart', 'SC Freiburg', 'Wolfsburg', 'Mainz 05',
    'FC Augsburg', 'Werder Bremen', 'TSG Hoffenheim', 'Borussia Mönchengladbach',
    'Union Berlin', 'FC Heidenheim', 'Holstein Kiel', 'FC St. Pauli', 'VfL Bochum',
    // Ligue 1
    'Paris Saint-Germain', 'Monaco', 'Marseille', 'Lens', 'Lille', 'Nice', 'Rennes',
    'Strasbourg', 'Lyon', 'Nantes', 'Montpellier', 'Auxerre', 'Saint-Etienne',
    'Toulouse', 'Reims', 'Angers', 'Le Havre', 'Brest', 'Lorient', 'Metz',
  ]);

  // Axes: label is a 2-element array [line1, line2] for two-line SVG rendering
  const AXES = [
    {
      key: 'elo',
      label: ['Elo', 'Rating'],
      normalize: v => clamp((v - 1600) / (2200 - 1600) * 100),
      fmt: v => String(Math.round(v)),
    },
    {
      key: 'fifa_rank',
      label: ['FIFA', 'Rank'],
      normalize: v => clamp((48 - v) / 47 * 100),
      fmt: v => '#' + Math.round(v),
    },
    {
      key: 'squad_value_m',
      label: ['Squad', 'Value'],
      normalize: v => clamp((v || 0) / 1520 * 100),
      fmt: v => '€' + Math.round(v || 0) + 'M',
    },
    {
      key: 'avg_age',
      label: ['Avg', 'Age'],
      normalize: v => clamp((34 - v) / (34 - 22) * 100),
      fmt: v => v.toFixed(1) + ' yrs',
    },
    {
      key: 'top5_pct',
      label: ['Top-5', 'League %'],
      normalize: v => clamp(v),
      fmt: v => v.toFixed(1) + '%',
    },
    {
      key: 'avg_caps',
      label: ['Intl', 'Caps'],
      normalize: v => Math.min(100, (v / 80) * 100),
      fmt: v => v.toFixed(1),
    },
  ];

  const COLOR_A = '#0D2818';
  const COLOR_B = '#C42B2B';
  const CX = 250, CY = 230, R = 170, N = AXES.length, LEVELS = 5;

  let _tooltip = null;
  let _currentA = 'France';
  let _currentB = 'Spain';

  function clamp(v) { return Math.min(100, Math.max(0, v)); }
  function axisAngle(i) { return (i / N) * 2 * Math.PI - Math.PI / 2; }
  function polarPt(r, a) { return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; }
  function ptsStr(pts) { return pts.map(p => p.join(',')).join(' '); }

  function hexagonPts(r) {
    return Array.from({ length: N }, (_, i) => polarPt(r, axisAngle(i)));
  }

  function dataPts(normVals) {
    return normVals.map((v, i) => polarPt((v / 100) * R, axisAngle(i)));
  }

  function computeStats(td, players) {
    const ages = players.map(p => p.age).filter(v => v > 0);
    const caps = players.map(p => p.caps).filter(v => v != null);
    const top5n = players.filter(p => TOP5.has(p.club)).length;
    return {
      elo:           td.elo          || 1800,
      fifa_rank:     td.fifa_rank    || 24,
      squad_value_m: td.squad_value_m || 0,
      avg_age:   ages.length  ? ages.reduce((a, b) => a + b, 0) / ages.length  : 26,
      top5_pct:  players.length ? (top5n / players.length) * 100               : 0,
      avg_caps:  caps.length  ? caps.reduce((a, b) => a + b, 0) / caps.length  : 30,
    };
  }

  function draw(statsA, statsB, nameA, nameB) {
    const container = document.getElementById('chart-radar');
    if (!container) return;
    container.innerHTML = '';
    // Ensure block layout so title sits above SVG, not beside it
    container.style.display = 'block';

    // Clean up any stale tooltip from a previous draw
    if (_tooltip && _tooltip.parentNode) _tooltip.parentNode.removeChild(_tooltip);
    _tooltip = document.createElement('div');
    _tooltip.style.cssText = [
      'position:fixed', 'background:rgba(13,40,24,0.92)', 'color:#fff',
      'padding:8px 12px', 'border-radius:6px', 'font-family:Inter,sans-serif',
      'font-size:12px', 'pointer-events:none', 'opacity:0',
      'transition:opacity 0.15s', 'z-index:9999', 'line-height:1.6',
      'white-space:nowrap',
    ].join(';');
    document.body.appendChild(_tooltip);

    // Title div
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-family:Bebas Neue,sans-serif;font-size:22px;color:#0D2818;padding:12px 16px 0';
    titleEl.textContent = 'Team DNA Comparison';
    container.appendChild(titleEl);

    const svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('viewBox', '0 0 500 460');

    const g = svg.append('g');

    // ── Grid: 5 concentric hexagons ───────────────────────────────────────────
    for (let lvl = 1; lvl <= LEVELS; lvl++) {
      g.append('polygon')
        .attr('points', ptsStr(hexagonPts((lvl / LEVELS) * R)))
        .attr('stroke', '#E2E8E4')
        .attr('stroke-width', 0.5)
        .attr('fill', 'none');
    }

    // ── Axis lines from center to outer ring ──────────────────────────────────
    for (let i = 0; i < N; i++) {
      const [x2, y2] = polarPt(R, axisAngle(i));
      g.append('line')
        .attr('x1', CX).attr('y1', CY)
        .attr('x2', x2).attr('y2', y2)
        .attr('stroke', '#9CA3AF')
        .attr('stroke-width', 0.5);
    }

    // ── Tick labels (20/40/60/80/100) along top axis ──────────────────────────
    [20, 40, 60, 80, 100].forEach((tick, idx) => {
      const r = ((idx + 1) / LEVELS) * R;
      const [tx, ty] = polarPt(r, axisAngle(0));
      g.append('text')
        .attr('x', tx + 3).attr('y', ty)
        .attr('font-family', 'Space Mono, monospace')
        .attr('font-size', 8)
        .attr('fill', '#9CA3AF')
        .attr('dominant-baseline', 'middle')
        .text(tick);
    });

    // ── Axis labels at 110% radius ────────────────────────────────────────────
    AXES.forEach((axis, i) => {
      const a = axisAngle(i);
      const [lx, ly] = polarPt(R * 1.10, a);
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);

      const anchor = cosA > 0.1 ? 'start' : cosA < -0.1 ? 'end' : 'middle';
      const [l1, l2] = axis.label;

      const txt = g.append('text')
        .attr('text-anchor', anchor)
        .attr('font-family', 'Inter, sans-serif')
        .attr('font-size', 11)
        .attr('fill', '#374151');

      if (sinA < -0.8) {
        // Top axis: stack lines above the label point
        txt.append('tspan').attr('x', lx).attr('y', ly).attr('dy', '-1.1em').text(l1);
        txt.append('tspan').attr('x', lx).attr('dy', '1.2em').text(l2);
      } else if (sinA > 0.8) {
        // Bottom axis: stack lines below the label point
        txt.append('tspan').attr('x', lx).attr('y', ly).attr('dy', '0.2em').text(l1);
        txt.append('tspan').attr('x', lx).attr('dy', '1.2em').text(l2);
      } else {
        // Side axes: vertically centered on label point
        txt.append('tspan').attr('x', lx).attr('y', ly).attr('dy', '-0.5em').text(l1);
        txt.append('tspan').attr('x', lx).attr('dy', '1.2em').text(l2);
      }
    });

    // ── Team polygons + vertex dots ───────────────────────────────────────────
    [[statsA, nameA, COLOR_A], [statsB, nameB, COLOR_B]].forEach(([stats, name, color]) => {
      const rawVals  = AXES.map(ax => stats[ax.key]);
      const normVals = AXES.map((ax, i) => ax.normalize(rawVals[i]));
      const pts = dataPts(normVals);

      g.append('polygon')
        .attr('points', ptsStr(pts))
        .attr('fill', color)
        .attr('fill-opacity', 0.15)
        .attr('stroke', color)
        .attr('stroke-opacity', 0.8)
        .attr('stroke-width', 1.5);

      pts.forEach((dot, i) => {
        g.append('circle')
          .attr('cx', dot[0]).attr('cy', dot[1]).attr('r', 4)
          .attr('fill', color)
          .style('cursor', 'pointer')
          .on('mousemove', (event) => {
            _tooltip.innerHTML = [
              `<strong>${name}</strong>`,
              AXES[i].label.join(' '),
              `Value: ${AXES[i].fmt(rawVals[i])}`,
              `Score: ${normVals[i].toFixed(1)}/100`,
            ].join('<br>');
            _tooltip.style.opacity = '1';
            _tooltip.style.left = (event.clientX + 14) + 'px';
            _tooltip.style.top  = (event.clientY - 10) + 'px';
          })
          .on('mouseleave', () => { _tooltip.style.opacity = '0'; });
      });
    });

    // ── Legend ────────────────────────────────────────────────────────────────
    const lg = svg.append('g').attr('transform', 'translate(250,445)');
    [[nameA, COLOR_A, -110], [nameB, COLOR_B, 10]].forEach(([name, color, dx]) => {
      const row = lg.append('g').attr('transform', `translate(${dx},0)`);
      row.append('rect').attr('width', 12).attr('height', 12).attr('rx', 2)
        .attr('fill', color).attr('fill-opacity', 0.85);
      row.append('text')
        .attr('x', 17).attr('y', 10)
        .attr('font-family', 'Inter, sans-serif')
        .attr('font-size', 12)
        .attr('fill', '#374151')
        .text(name);
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.initRadar = async function (teamA = 'France', teamB = 'Spain') {
    _currentA = teamA;
    _currentB = teamB;

    const container = document.getElementById('chart-radar');
    if (!container) return;
    container.innerHTML = '<p style="color:#9CA3AF;font-size:13px;padding:40px;text-align:center;">Loading radar…</p>';

    try {
      const [teamsData, squadA, squadB] = await Promise.all([
        fetch('/api/teams').then(r => r.json()),
        fetch(`/api/squads/${encodeURIComponent(teamA)}`).then(r => r.json()),
        fetch(`/api/squads/${encodeURIComponent(teamB)}`).then(r => r.json()),
      ]);

      const tdA = teamsData.find(t => t.name === teamA) || {};
      const tdB = teamsData.find(t => t.name === teamB) || {};

      draw(
        computeStats(tdA, Array.isArray(squadA) ? squadA : []),
        computeStats(tdB, Array.isArray(squadB) ? squadB : []),
        teamA,
        teamB,
      );
    } catch (err) {
      const c = document.getElementById('chart-radar');
      if (c) {
        c.innerHTML = `<p style="color:#C42B2B;font-size:13px;padding:40px;text-align:center;">Radar unavailable: ${err.message}</p>`;
      }
    }
  };

  // Wire up Team Explorer selector → updates Team A slot in radar
  function bindTeamSelector() {
    const sel = document.getElementById('team-selector');
    if (!sel) return;
    sel.addEventListener('change', () => {
      if (sel.value) window.initRadar(sel.value, _currentB);
    });
  }

  // Initialise after DOM + all scripts are ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.initRadar();
      bindTeamSelector();
    });
  } else {
    window.initRadar();
    bindTeamSelector();
  }

}());
