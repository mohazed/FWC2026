(function () {
  'use strict';

  const ROUNDS = [
    { key: 'qf_prob',    label: 'Quarter-Final', opacity: 0.18 },
    { key: 'sf_prob',    label: 'Semi-Final',    opacity: 0.35 },
    { key: 'final_prob', label: 'Final',         opacity: 0.60 },
    { key: 'win_prob',   label: 'Champion',      opacity: null }, // gold
  ];

  let _tooltip = null;

  function cleanupTooltip() {
    if (_tooltip && _tooltip.parentNode) _tooltip.parentNode.removeChild(_tooltip);
    _tooltip = null;
  }

  const LABEL_FONT = 11;
  const FLAG_GAP = 8;
  const LABEL_INSET = 16;
  const BAR_GAP = 8;

  /** Rough SVG text width estimate for Inter 11px (no canvas needed). */
  function estimateTextWidth(text, fontSize = LABEL_FONT) {
    return (text || '').length * fontSize * 0.52;
  }

  /** Shorten long team names so labels never collide with bars on narrow viewports. */
  function truncateTeamLabel(name, maxWidth) {
    if (!name || maxWidth <= 20) return name || '';
    const maxChars = Math.floor(maxWidth / (LABEL_FONT * 0.52));
    if (name.length <= maxChars) return name;
    if (maxChars <= 2) return name.slice(0, maxChars);
    return name.slice(0, maxChars - 1) + '\u2026';
  }

  window.initBracket = async function () {
    const container = document.getElementById('chart-montecarlo');
    if (!container) return;

    cleanupTooltip();
    container.innerHTML = '<div class="skeleton-shimmer" style="min-height:380px;"></div>';

    const N_SIMS = 2000;
    try {
      if (window.Flags && Flags.ensureReady) await Flags.ensureReady();

      const resp = await fetch(`/api/montecarlo?n=${N_SIMS}`);
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      const teams = (data.teams || []).slice(0, 16);
      if (teams.length === 0) throw new Error('No simulation data returned');

      container.innerHTML = '';

      // Header
      const header = document.createElement('div');
      header.innerHTML = `
        <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--pitch-night);padding:12px 16px 2px;">
          Monte Carlo — Tournament Probability
        </div>
        <div style="font-size:11px;color:var(--muted);padding:0 16px 10px;font-family:var(--font-body);">
          ${N_SIMS.toLocaleString()} simulations · Top 16 contenders by win probability
        </div>`;
      container.appendChild(header);

      // Dimensions — left padding sized for flag + longest team name in label lane
      const totalW = container.clientWidth || 520;
      const rowH   = 28;
      const FLAG_W = 24;
      const FLAG_H = 18;
      const longestName = teams.reduce(
        (s, t) => (t.name.length > s.length ? t.name : s), ''
      );
      const estLabelW = estimateTextWidth(longestName);
      const padLeft = Math.max(
        164,
        LABEL_INSET + FLAG_W + FLAG_GAP + estLabelW + BAR_GAP
      );
      const pad = { top: 10, right: 90, bottom: 58, left: padLeft };
      const innerW = Math.max(totalW - pad.left - pad.right, 120);
      const flagX = -pad.left + LABEL_INSET;
      const labelX = flagX + FLAG_W + FLAG_GAP;
      const labelMaxW = Math.max(
        pad.left - LABEL_INSET - FLAG_W - FLAG_GAP - BAR_GAP,
        60
      );
      const innerH = teams.length * rowH;
      const svgH   = innerH + pad.top + pad.bottom;

      const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0 ${totalW} ${svgH}`)
        .attr('aria-label', 'Tournament win probability for top 16 teams');

      const g = svg.append('g').attr('transform', `translate(${pad.left},${pad.top})`);

      // Scales
      const maxQF = Math.max(...teams.map(t => t.qf_prob), 0.01);
      const xScale = d3.scaleLinear().domain([0, maxQF]).range([0, innerW]);

      const yScale = d3.scaleBand()
        .domain(teams.map(t => t.name))
        .range([0, innerH])
        .padding(0.2);

      // Subtle grid lines
      [0.25, 0.5, 0.75, 1.0].forEach(frac => {
        const x = xScale(maxQF * frac);
        g.append('line')
          .attr('x1', x).attr('y1', 0)
          .attr('x2', x).attr('y2', innerH)
          .style('stroke', 'var(--border)')
          .style('stroke-width', 0.5);
      });

      // Draw bars (back to front — widest first, so narrower bars are visible on top)
      ROUNDS.forEach(({ key, opacity }) => {
        g.selectAll(null)
          .data(teams)
          .join('rect')
          .attr('y', d => yScale(d.name))
          .attr('height', yScale.bandwidth())
          .attr('x', 0)
          .attr('width', d => Math.max(xScale(d[key]), 0))
          .attr('rx', 3)
          .style('fill', opacity !== null ? 'var(--pitch-night)' : 'var(--trophy-gold)')
          .style('fill-opacity', opacity !== null ? opacity : 1);
      });

      // Gold border highlight for top team
      const top = teams[0];
      g.append('rect')
        .attr('y', yScale(top.name) - 1)
        .attr('height', yScale.bandwidth() + 2)
        .attr('x', -1)
        .attr('width', xScale(top.qf_prob) + 1)
        .attr('rx', 3)
        .attr('fill', 'none')
        .style('stroke', 'var(--trophy-gold)')
        .style('stroke-width', 1.5);

      // Flag thumbnails + team name labels (flag → gap → name → gap → bar)
      if (window.Flags) {
        g.selectAll('.team-flag-img')
          .data(teams)
          .join('image')
          .attr('class', 'team-flag-img')
          .attr('href', d => Flags.urlFor(d.name, 48))
          .attr('x', flagX)
          .attr('y', d => yScale(d.name) + (yScale.bandwidth() - FLAG_H) / 2)
          .attr('width', FLAG_W)
          .attr('height', FLAG_H)
          .attr('preserveAspectRatio', 'xMidYMid slice');
      }

      const labelSel = g.selectAll('.team-lbl')
        .data(teams)
        .join('text')
        .attr('class', 'team-lbl')
        .attr('x', labelX)
        .attr('y', d => yScale(d.name) + yScale.bandwidth() / 2)
        .attr('text-anchor', 'start')
        .attr('dominant-baseline', 'middle')
        .attr('font-family', 'Inter, sans-serif')
        .attr('font-size', LABEL_FONT)
        .attr('font-weight', (d, i) => i === 0 ? 700 : 400)
        .style('fill', (d, i) => i === 0 ? 'var(--trophy-gold)' : 'var(--slate)');

      labelSel.each(function (d) {
        const el = d3.select(this);
        const display = truncateTeamLabel(d.name, labelMaxW);
        el.text(display);
        el.selectAll('title').remove();
        if (display !== d.name) {
          el.append('title').text(d.name);
        }
      });

      // Win % labels at right edge
      g.selectAll('.win-pct')
        .data(teams)
        .join('text')
        .attr('class', 'win-pct')
        .attr('x', d => xScale(d.qf_prob) + 5)
        .attr('y', d => yScale(d.name) + yScale.bandwidth() / 2)
        .attr('dominant-baseline', 'middle')
        .attr('font-family', '"Space Mono", monospace')
        .attr('font-size', 9)
        .text(d => `${(d.win_prob * 100).toFixed(1)}%`)
        .style('fill', (d, i) => i === 0 ? 'var(--trophy-gold)' : 'var(--muted)');

      // Legend
      const lg = g.append('g').attr('transform', `translate(0, ${innerH + 16})`);
      const legendSpacing = Math.min(innerW / ROUNDS.length, 120);

      ROUNDS.forEach(({ label, opacity }, i) => {
        const lx = i * legendSpacing;
        lg.append('rect')
          .attr('x', lx).attr('y', 0)
          .attr('width', 10).attr('height', 10)
          .attr('rx', 2)
          .style('fill', opacity !== null ? 'var(--pitch-night)' : 'var(--trophy-gold)')
          .style('fill-opacity', opacity !== null ? opacity : 1);
        lg.append('text')
          .attr('x', lx + 14).attr('y', 9)
          .attr('font-family', 'Inter, sans-serif')
          .attr('font-size', 9.5)
          .style('fill', 'var(--muted)')
          .text(label);
      });

      // Transparent hit areas for tooltip
      _tooltip = document.createElement('div');
      _tooltip.style.cssText = [
        'position:fixed', 'z-index:9999',
        'background:var(--pitch-night)', 'color:var(--chalk-white)',
        'padding:8px 12px', 'border-radius:6px',
        'font-family:Inter,sans-serif', 'font-size:12px',
        'pointer-events:none', 'opacity:0',
        'transition:opacity 0.15s', 'line-height:1.7',
        'white-space:nowrap',
      ].join(';');
      document.body.appendChild(_tooltip);

      g.selectAll('.hit')
        .data(teams)
        .join('rect')
        .attr('class', 'hit')
        .attr('y', d => yScale(d.name))
        .attr('height', yScale.bandwidth())
        .attr('x', 0)
        .attr('width', innerW + pad.right - 10)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('mousemove', (event, d) => {
          _tooltip.innerHTML = [
            `<strong>${d.name}</strong>`,
            `Quarter-Final:  ${(d.qf_prob    * 100).toFixed(1)}%`,
            `Semi-Final:     ${(d.sf_prob    * 100).toFixed(1)}%`,
            `Final:          ${(d.final_prob * 100).toFixed(1)}%`,
            `<strong style="color:var(--trophy-gold);">Champion: ${(d.win_prob * 100).toFixed(1)}%</strong>`,
          ].join('<br>');
          _tooltip.style.opacity  = '1';
          _tooltip.style.left     = (event.clientX + 16) + 'px';
          _tooltip.style.top      = (event.clientY - 10) + 'px';
        })
        .on('mouseleave', () => { _tooltip.style.opacity = '0'; });

    } catch (err) {
      container.innerHTML = `<p class="chart-error">Tournament simulation unavailable: ${err.message}</p>`;
    }
  };

  // NOTE: bootstrap is owned by static/main.js to avoid double initialisation.

}());
