const current = document.getElementById('slide-current');
const next = document.getElementById('slide-next');

let currentSlide = null;
let selectedIndex = null;

// Resolved theme colors — updated from the slide container before each render
// so diagram/chart renderers always use the correct theme colors
let themeColors = {
  text1: '#cdd6f4',
  text2: '#a6adc8',
  text3: '#6c7086',
  accent: '#89b4fa',
  border: 'rgba(255,255,255,.08)',
};

function resolveThemeColors(container) {
  const cs = getComputedStyle(container);
  const get = (v, fallback) => cs.getPropertyValue(v).trim() || fallback;
  themeColors = {
    text1:  get('--text-1', '#cdd6f4'),
    text2:  get('--text-2', '#a6adc8'),
    text3:  get('--text-3', '#6c7086'),
    accent: get('--accent',  '#89b4fa'),
    border: get('--border',  'rgba(255,255,255,.08)'),
  };
}

function renderSlide(container, slide) {
  if (slide.soloHtml) {
    container.className = 'slide-container';
    container.style.cssText = 'background:#fff;padding:0;overflow:hidden;';
    container.innerHTML = '<iframe style="width:100%;height:100%;border:none;display:block;" sandbox="allow-scripts allow-same-origin"></iframe>';
    container.querySelector('iframe').srcdoc = slide.soloHtml;
    return;
  }
  container.className = `slide-container layout-${slide.layout || 'content'}`;
  container.style.background = slide.background || '';
  container.style.color = slide.color || '';
  // Apply per-slide CSS variable overrides for accent/gradient theming
  const tv = slide.themeVars;
  if (tv) {
    container.style.setProperty('--accent',   tv.accent   || '');
    container.style.setProperty('--accent-2', tv.accent2  || '');
    container.style.setProperty('--accent-3', tv.accent3  || '');
    container.style.setProperty('--grad',     tv.grad     || '');
    container.style.setProperty('--grad-soft',tv.gradSoft || '');
    container.style.setProperty('--surface',  tv.surface  || '');
    container.style.setProperty('--surface-2',tv.surface2 || '');
    container.style.setProperty('--border',   tv.border   || '');
    container.style.setProperty('--text-1',   tv.text1    || '');
    container.style.setProperty('--text-2',   tv.text2    || '');
    container.style.setProperty('--text-3',   tv.text3    || '');
  } else {
    ['--accent','--accent-2','--accent-3','--grad','--grad-soft','--surface','--surface-2','--border','--text-1','--text-2','--text-3']
      .forEach(v => container.style.removeProperty(v));
  }
  resolveThemeColors(container);
  container.innerHTML = '';

  // Section number watermark for section layout
  if (slide.layout === 'section' && slide.sectionNum != null) {
    const num = document.createElement('div');
    num.className = 'el-section-num';
    num.textContent = slide.sectionNum;
    container.appendChild(num);
  }

  if (slide.layout === 'two-column') {
    const colLeft = document.createElement('div');
    colLeft.className = 'col';
    const colRight = document.createElement('div');
    colRight.className = 'col';
    const half = Math.ceil((slide.elements || []).length / 2);
    (slide.elements || []).forEach((el, i) => {
      const node = buildElement(el, i);
      if (node) (i < half ? colLeft : colRight).appendChild(node);
    });
    container.appendChild(colLeft);
    container.appendChild(colRight);
  } else {
    (slide.elements || []).forEach((el, i) => {
      const node = buildElement(el, i);
      if (node) container.appendChild(node);
    });
  }

  // Re-apply selection highlight after re-render
  if (selectedIndex !== null) applyHighlight(selectedIndex);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildElement(el, index) {
  let node;

  switch (el.type) {
    case 'kicker': {
      node = document.createElement('div');
      node.className = 'el-kicker';
      node.textContent = el.text;
      break;
    }
    case 'heading': {
      node = document.createElement('h1');
      node.className = el.gradient ? 'el-heading gradient' : 'el-heading';
      node.textContent = el.text;
      break;
    }
    case 'subheading': {
      node = document.createElement('h2');
      node.className = 'el-subheading';
      node.textContent = el.text;
      break;
    }
    case 'body': {
      node = document.createElement('p');
      node.className = 'el-body';
      node.textContent = el.text;
      break;
    }
    case 'bullets': {
      node = document.createElement('ul');
      node.className = 'el-bullets';
      (el.items || []).forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        node.appendChild(li);
      });
      break;
    }
    case 'image': {
      const wrap = document.createElement('div');
      wrap.className = 'el-image-wrap';

      // Alignment / float
      const align = el.align || 'center';
      const float = el.float;
      if (float === 'left' || float === 'right') {
        wrap.style.cssText = `float:${float};margin:0 ${float==='left'?'16px 8px 0':'0 8px 0 16px'};`;
      } else {
        wrap.style.justifySelf = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
        wrap.style.alignSelf = 'center';
        wrap.style.width = el.width ? String(el.width) : '100%';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
      }

      const img = document.createElement('img');
      img.className = 'el-image';
      img.src = el.src;
      img.alt = el.alt || '';
      if (el.width)  img.style.width  = typeof el.width  === 'number' ? `${el.width}px`  : el.width;
      if (el.height) img.style.height = typeof el.height === 'number' ? `${el.height}px` : el.height;
      if (el.radius != null) img.style.borderRadius = typeof el.radius === 'number' ? `${el.radius}px` : el.radius;
      if (el.objectFit) img.style.objectFit = el.objectFit;
      wrap.appendChild(img);

      if (el.caption) {
        const cap = document.createElement('div');
        cap.className = 'el-image-caption';
        cap.textContent = el.caption;
        wrap.appendChild(cap);
      }

      node = wrap;
      break;
    }
    case 'images': {
      // Grid of multiple images
      node = document.createElement('div');
      const cols = el.cols || (el.items || []).length || 2;
      node.className = 'el-images-grid';
      if (el.gridTemplate) {
        node.style.gridTemplate = el.gridTemplate;
      } else {
        node.style.gridTemplateColumns = `repeat(${Math.min(cols, 6)}, 1fr)`;
      }
      if (el.gap != null) node.style.gap = typeof el.gap === 'number' ? `${el.gap}px` : el.gap;

      (el.items || []).forEach((item, itemIdx) => {
        const wrap2 = document.createElement('div');
        wrap2.className = 'el-images-grid-item';
        // For gridTemplate layouts, first item spans rows
        if (el.gridTemplate && itemIdx === 0) {
          wrap2.style.gridArea = 'a';
        } else if (el.gridTemplate && itemIdx === 1) {
          wrap2.style.gridArea = 'b';
        } else if (el.gridTemplate && itemIdx === 2) {
          wrap2.style.gridArea = 'c';
        }

        const img2 = document.createElement('img');
        img2.className = 'el-image';
        img2.src = item.src;
        img2.alt = item.alt || '';
        if (el.height || item.height) img2.style.height = typeof (item.height || el.height) === 'number' ? `${item.height || el.height}px` : (item.height || el.height);
        img2.style.width = '100%';
        img2.style.objectFit = item.objectFit || el.objectFit || 'cover';
        if (el.radius != null || item.radius != null) {
          const r = item.radius ?? el.radius;
          img2.style.borderRadius = typeof r === 'number' ? `${r}px` : r;
        }
        // gridTemplate layouts: images fill the grid cell height
        if (el.gridTemplate) { img2.style.height = '100%'; wrap2.style.height = '100%'; }
        wrap2.appendChild(img2);

        if (item.caption) {
          const cap2 = document.createElement('div');
          cap2.className = 'el-image-caption';
          cap2.textContent = item.caption;
          wrap2.appendChild(cap2);
        }
        node.appendChild(wrap2);
      });
      break;
    }
    case 'divider': {
      node = document.createElement('div');
      node.className = 'el-divider';
      break;
    }
    case 'pills': {
      node = document.createElement('div');
      node.className = 'el-pills';
      (el.items || []).forEach((item) => {
        const pill = document.createElement('span');
        pill.className = item.accent ? 'el-pill accent' : 'el-pill';
        pill.textContent = typeof item === 'string' ? item : item.text;
        node.appendChild(pill);
      });
      break;
    }
    case 'quote': {
      node = document.createElement('div');
      node.className = 'el-quote';
      node.textContent = el.text;
      if (el.author) {
        const author = document.createElement('div');
        author.className = 'el-quote-author';
        author.textContent = '— ' + el.author;
        // Append author outside quote for separate positioning
        const wrap = document.createElement('div');
        wrap.style.display = 'contents';
        wrap.dataset.elIndex = index;
        wrap.classList.add('el-selectable');
        wrap.appendChild(node);
        wrap.appendChild(author);
        return wrap;
      }
      break;
    }
    case 'stats': {
      node = document.createElement('div');
      node.className = 'el-stats';
      (el.items || []).forEach((stat) => {
        const s = document.createElement('div');
        s.className = 'el-stat';
        if (stat.label) {
          const lbl = document.createElement('div');
          lbl.className = 'stat-label';
          lbl.textContent = stat.label;
          s.appendChild(lbl);
        }
        const val = document.createElement('div');
        val.className = 'stat-value';
        val.textContent = stat.value;
        s.appendChild(val);
        if (stat.delta != null) {
          const delta = document.createElement('div');
          delta.className = stat.delta < 0 ? 'stat-delta down' : 'stat-delta';
          delta.textContent = stat.delta;
          s.appendChild(delta);
        }
        node.appendChild(s);
      });
      break;
    }
    case 'cards': {
      const cols = el.cols || (el.items || []).length || 3;
      node = document.createElement('div');
      node.className = `el-cards cols-${Math.min(cols, 4)}`;
      (el.items || []).forEach((card) => {
        const c = document.createElement('div');
        c.className = card.accent ? 'el-card el-card-accent' : 'el-card';
        if (card.icon) {
          const icon = document.createElement('div');
          icon.className = 'card-icon';
          icon.textContent = card.icon;
          c.appendChild(icon);
        }
        if (card.title) {
          const t = document.createElement('div');
          t.className = 'card-title';
          t.textContent = card.title;
          c.appendChild(t);
        }
        if (card.body) {
          const b = document.createElement('div');
          b.className = 'card-body';
          b.textContent = card.body;
          c.appendChild(b);
        }
        node.appendChild(c);
      });
      break;
    }
    case 'diagram': {
      node = document.createElement('div');
      node.className = 'el-diagram';
      renderDiagram(node, el);
      break;
    }
    default:
      return null;
  }

  node.dataset.elIndex = index;
  node.classList.add('el-selectable');
  return node;
}

// ── Diagram renderers ─────────────────────────────────────────────────────────

const CHART_PALETTE = ['#89b4fa','#cba6f7','#f38ba8','#a6e3a1','#f9e2af','#fab387','#94e2d5'];

function renderDiagram(container, el) {
  switch (el.kind) {
    case 'bar':
    case 'line':
    case 'pie':
    case 'doughnut':
      renderChartJS(container, el);
      break;
    case 'flow':
      container.appendChild(renderFlow(el));
      break;
    case 'mindmap':
      container.appendChild(renderMindmap(el));
      break;
    case 'svg':
    default:
      container.innerHTML = el.svgHtml || '';
      break;
  }
}

function renderChartJS(container, el) {
  if (typeof Chart === 'undefined') {
    container.innerHTML = '<div style="color:#f38ba8;font-size:13px;padding:16px">Chart.js not loaded</div>';
    return;
  }
  // Fixed dimensions — responsive:true would attach a ResizeObserver that causes
  // a post-paint reflow which pushes slide elements outward
  const isPie = el.kind === 'pie' || el.kind === 'doughnut';
  const W = isPie ? 400 : 640;
  const H = isPie ? 360 : 340;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = `width:${W}px;height:${H}px;max-width:100%;display:block;`;
  container.appendChild(canvas);

  const { text1, text2, accent } = themeColors;
  const gridColor = text2.startsWith('#')
    ? text2 + '22'
    : text2.replace(')', ', .13)').replace('rgb(', 'rgba(');

  const datasets = (el.datasets || []).map((d, i) => {
    const color = d.color || CHART_PALETTE[i % CHART_PALETTE.length];
    const isPie = el.kind === 'pie' || el.kind === 'doughnut';
    return {
      label: d.label || '',
      data: d.data || [],
      backgroundColor: isPie ? CHART_PALETTE : color + '44',
      borderColor: isPie ? CHART_PALETTE : color,
      borderWidth: 2,
      tension: 0.4,
      fill: el.kind === 'line',
      pointBackgroundColor: color,
    };
  });

  new Chart(canvas, {
    type: el.kind,
    data: { labels: el.labels || [], datasets },
    options: {
      responsive: false,
      animation: { duration: 600 },
      plugins: {
        legend: {
          labels: { color: text2, font: { size: 13 }, padding: 16 },
        },
        title: el.title
          ? { display: true, text: el.title, color: text1, font: { size: 15, weight: '600' }, padding: { bottom: 12 } }
          : { display: false },
      },
      scales: isPie ? {} : {
        x: { ticks: { color: text2, font: { size: 12 } }, grid: { color: gridColor } },
        y: { ticks: { color: text2, font: { size: 12 } }, grid: { color: gridColor } },
      },
    },
  });
}

function renderFlow(el) {
  const nodes = el.nodes || [];
  const edges = el.edges || [];

  const FONT_SIZE = 13;
  const PAD_X = 18;   // horizontal padding inside box
  const PAD_Y = 10;   // vertical padding inside box
  const MAX_LABEL_W = 160; // max box width before wrapping
  const HGAP = 60;    // gap between columns
  const VGAP = 20;    // gap between rows
  const ns = 'http://www.w3.org/2000/svg';

  // Approximate character width for mixed CJK/Latin text
  const charW = (ch) => ch.charCodeAt(0) > 0x2E7F ? FONT_SIZE * 1.0 : FONT_SIZE * 0.6;
  const measureText = (str) => [...str].reduce((w, ch) => w + charW(ch), 0);

  // Split label into lines that fit within MAX_LABEL_W - PAD_X*2
  const innerW = MAX_LABEL_W - PAD_X * 2;
  const splitLines = (label) => {
    const words = label.split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const candidate = cur ? cur + ' ' + w : w;
      if (measureText(candidate) > innerW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = candidate;
      }
    }
    if (cur) lines.push(cur);
    // Hard-wrap any single line still too wide (e.g. continuous Chinese)
    const result = [];
    for (const line of lines) {
      if (measureText(line) <= innerW) { result.push(line); continue; }
      let part = '';
      for (const ch of line) {
        if (measureText(part + ch) > innerW) { result.push(part); part = ch; }
        else part += ch;
      }
      if (part) result.push(part);
    }
    return result.length ? result : [label];
  };

  // Pre-compute box sizes
  const boxInfo = {};
  nodes.forEach(n => {
    const label = n.label || n.id;
    const lines = splitLines(label);
    const maxLineW = Math.max(...lines.map(l => measureText(l)));
    const bw = Math.min(MAX_LABEL_W, maxLineW + PAD_X * 2);
    const bh = lines.length * (FONT_SIZE + 4) + PAD_Y * 2;
    boxInfo[n.id] = { label, lines, bw, bh };
  });

  // BFS depth assignment
  const depth = {};
  const adj = {};
  nodes.forEach(n => { depth[n.id] = -1; adj[n.id] = []; });
  edges.forEach(e => { if (adj[e.from] !== undefined) adj[e.from].push(e.to); });
  const roots = nodes.filter(n => !edges.some(e => e.to === n.id)).map(n => n.id);
  if (!roots.length && nodes.length) roots.push(nodes[0].id);
  const queue = [...roots];
  roots.forEach(r => { depth[r] = 0; });
  while (queue.length) {
    const id = queue.shift();
    (adj[id] || []).forEach(nid => {
      if (depth[nid] < depth[id] + 1) { depth[nid] = depth[id] + 1; queue.push(nid); }
    });
  }
  nodes.forEach(n => { if (depth[n.id] < 0) depth[n.id] = 0; });

  // Group by depth
  const cols = {};
  nodes.forEach(n => {
    const d = depth[n.id];
    if (!cols[d]) cols[d] = [];
    cols[d].push(n.id);
  });
  const colKeys = Object.keys(cols).map(Number).sort((a, b) => a - b);

  // Column widths = widest box in that column
  const colW = {};
  colKeys.forEach(d => {
    colW[d] = Math.max(...cols[d].map(id => boxInfo[id].bw));
  });

  // Column x offsets
  const colX = {};
  let cx = 20;
  colKeys.forEach(d => { colX[d] = cx; cx += colW[d] + HGAP; });

  // SVG dimensions
  const svgW = cx - HGAP + 20;
  const maxColH = Math.max(...colKeys.map(d => {
    const ids = cols[d];
    return ids.reduce((h, id) => h + boxInfo[id].bh, 0) + (ids.length - 1) * VGAP;
  }));
  const svgH = maxColH + 40;

  // Node positions (centered in column, vertically centered)
  const pos = {};
  colKeys.forEach(d => {
    const ids = cols[d];
    const totalH = ids.reduce((h, id) => h + boxInfo[id].bh, 0) + (ids.length - 1) * VGAP;
    let y = (svgH - totalH) / 2;
    ids.forEach(id => {
      const info = boxInfo[id];
      // Center box horizontally within the column width
      pos[id] = { x: colX[d] + (colW[d] - info.bw) / 2, y };
      y += info.bh + VGAP;
    });
  });

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
  svg.style.cssText = 'width:100%;max-height:52vh;';

  const { text1, accent } = themeColors;
  // Node fill: accent at low opacity; works for both dark and light themes
  const nodeFill = accent.startsWith('#')
    ? accent + '1a'
    : accent.replace('rgb(', 'rgba(').replace(')', ', .10)');

  // Arrow marker
  const defs = document.createElementNS(ns, 'defs');
  const marker = document.createElementNS(ns, 'marker');
  marker.setAttribute('id', 'arrow');
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('refX', '6');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');
  const arrowPath = document.createElementNS(ns, 'path');
  arrowPath.setAttribute('d', 'M0,0 L0,6 L8,3 z');
  arrowPath.setAttribute('fill', accent);
  arrowPath.setAttribute('opacity', '0.8');
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Edges — connect right-center of from-box to left-center of to-box
  edges.forEach(e => {
    const fp = pos[e.from], tp = pos[e.to];
    const fi = boxInfo[e.from], ti = boxInfo[e.to];
    if (!fp || !tp || !fi || !ti) return;
    const x1 = fp.x + fi.bw;
    const y1 = fp.y + fi.bh / 2;
    const x2 = tp.x - 2;
    const y2 = tp.y + ti.bh / 2;
    const mx = (x1 + x2) / 2;
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', accent);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-opacity', '0.6');
    path.setAttribute('marker-end', 'url(#arrow)');
    svg.appendChild(path);
  });

  // Nodes
  nodes.forEach(n => {
    const p = pos[n.id];
    const info = boxInfo[n.id];
    if (!p || !info) return;
    const g = document.createElementNS(ns, 'g');

    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', p.x);
    rect.setAttribute('y', p.y);
    rect.setAttribute('width', info.bw);
    rect.setAttribute('height', info.bh);
    rect.setAttribute('rx', '8');
    rect.setAttribute('ry', '8');
    rect.setAttribute('fill', nodeFill);
    rect.setAttribute('stroke', accent);
    rect.setAttribute('stroke-width', '1.5');
    g.appendChild(rect);

    // Multi-line text
    const lineH = FONT_SIZE + 4;
    const totalTextH = info.lines.length * lineH;
    const startY = p.y + (info.bh - totalTextH) / 2 + FONT_SIZE;
    info.lines.forEach((line, li) => {
      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', p.x + info.bw / 2);
      txt.setAttribute('y', startY + li * lineH);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'auto');
      txt.setAttribute('fill', text1);
      txt.setAttribute('font-size', String(FONT_SIZE));
      txt.setAttribute('font-family', 'Inter,"Noto Sans SC",system-ui,sans-serif');
      txt.textContent = line;
      g.appendChild(txt);
    });

    svg.appendChild(g);
  });

  return svg;
}

function renderMindmap(el) {
  const root = el.root || 'Topic';
  const children = el.children || [];

  const ns = 'http://www.w3.org/2000/svg';

  // Shared text helpers (same as renderFlow)
  const FSROOT = 14, FSCHILD = 12, FSGC = 11;
  const charW = (ch, fs) => ch.charCodeAt(0) > 0x2E7F ? fs * 1.0 : fs * 0.6;
  const measureText = (str, fs) => [...str].reduce((w, ch) => w + charW(ch, fs), 0);
  const MAX_LINE_W = 110;
  const splitLines = (label, fs) => {
    const limit = MAX_LINE_W;
    const result = [];
    let part = '';
    for (const ch of label) {
      if (measureText(part + ch, fs) > limit) { result.push(part); part = ch; }
      else part += ch;
    }
    if (part) result.push(part);
    return result.length ? result : [label];
  };

  function makeNode(x, y, label, isRoot, colorIdx) {
    const color = CHART_PALETTE[colorIdx % CHART_PALETTE.length];
    const fs = isRoot ? FSROOT : FSCHILD;
    const PAD_X = isRoot ? 16 : 12;
    const PAD_Y = isRoot ? 10 : 7;
    const lines = splitLines(label, fs);
    const maxLW = Math.max(...lines.map(l => measureText(l, fs)));
    const bw = maxLW + PAD_X * 2;
    const lineH = fs + 3;
    const bh = lines.length * lineH + PAD_Y * 2;
    return { x, y, bw, bh, lines, lineH, fs, PAD_Y, isRoot, color };
  }

  function drawNode(info) {
    const { x, y, bw, bh, lines, lineH, fs, PAD_Y, isRoot, color } = info;
    const { text1, accent } = themeColors;
    const rootFill = accent.startsWith('#') ? accent + '33' : accent.replace('rgb(', 'rgba(').replace(')', ', .20)');
    const g = document.createElementNS(ns, 'g');
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', x - bw / 2);
    rect.setAttribute('y', y - bh / 2);
    rect.setAttribute('width', bw);
    rect.setAttribute('height', bh);
    rect.setAttribute('rx', isRoot ? '12' : '8');
    rect.setAttribute('fill', isRoot ? rootFill : `${color}22`);
    rect.setAttribute('stroke', isRoot ? accent : color);
    rect.setAttribute('stroke-width', isRoot ? '2' : '1.5');
    g.appendChild(rect);
    const totalTextH = lines.length * lineH;
    const startY = y - totalTextH / 2 + fs;
    lines.forEach((line, li) => {
      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', x);
      txt.setAttribute('y', startY + li * lineH);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'auto');
      txt.setAttribute('fill', text1);
      txt.setAttribute('font-size', fs);
      txt.setAttribute('font-weight', isRoot ? '700' : '500');
      txt.setAttribute('font-family', 'Inter,"Noto Sans SC",system-ui,sans-serif');
      txt.textContent = line;
      g.appendChild(txt);
    });
    return g;
  }

  function addEdge(x1, y1, x2, y2, color) {
    const path = document.createElementNS(ns, 'path');
    const mx = (x1 + x2) / 2;
    path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-opacity', '0.5');
    return path;
  }

  function countLeaves(node) {
    if (!node.children || !node.children.length) return 1;
    return node.children.reduce((s, c) => s + countLeaves(c), 0);
  }

  // Layout on a virtual 700×500 canvas; SVG viewBox will match
  const W = 720, H = 520, CX = W / 2, CY = H / 2;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.cssText = 'width:100%;max-height:52vh;';

  const rootInfo = makeNode(CX, CY, root, true, 0);
  svg.appendChild(drawNode(rootInfo));

  const totalLeaves = children.reduce((s, c) => s + countLeaves(c), 0) || 1;
  let leafCursor = 0;

  children.forEach((child, ci) => {
    const leaves = countLeaves(child);
    const midLeaf = leafCursor + leaves / 2;
    const angle = (midLeaf / totalLeaves) * 2 * Math.PI - Math.PI / 2;
    const r1 = 170;
    const cx = CX + r1 * Math.cos(angle);
    const cy = CY + r1 * Math.sin(angle);
    const childInfo = makeNode(cx, cy, child.label || '', false, ci);
    const color = childInfo.color;

    svg.appendChild(addEdge(CX, CY, cx, cy, color));
    svg.appendChild(drawNode(childInfo));

    const subChildren = child.children || [];
    subChildren.forEach((gc, gci) => {
      const subAngle = angle + (gci - (subChildren.length - 1) / 2) * 0.38;
      const r2 = 130;
      const gcx = cx + r2 * Math.cos(subAngle);
      const gcy = cy + r2 * Math.sin(subAngle);
      const gcInfo = makeNode(gcx, gcy, gc.label || '', false, ci);
      svg.appendChild(addEdge(cx, cy, gcx, gcy, color));
      svg.appendChild(drawNode(gcInfo));
    });

    leafCursor += leaves;
  });

  return svg;
}

// ─────────────────────────────────────────────────────────────────────────────

function applyHighlight(index) {
  document.querySelectorAll('.el-selectable').forEach((el) => {
    el.classList.remove('el-selected');
  });
  if (index !== null) {
    const target = document.querySelector(`[data-el-index="${index}"]`);
    if (target) target.classList.add('el-selected');
  }
}

function notifySelection(index) {
  if (!currentSlide) return;
  const el = currentSlide.elements?.[index];
  window.parent.postMessage(
    { type: 'element-selected', elementIndex: index, element: el || null },
    '*'
  );
}

// Click to select
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-el-index]');
  if (!target) {
    if (selectedIndex !== null) {
      selectedIndex = null;
      applyHighlight(null);
      notifySelection(null);
    }
    return;
  }
  const index = parseInt(target.dataset.elIndex, 10);
  if (selectedIndex === index) {
    selectedIndex = null;
    applyHighlight(null);
    notifySelection(null);
  } else {
    selectedIndex = index;
    applyHighlight(index);
    notifySelection(index);
  }
});

function getAnimClasses(transition, direction) {
  const dir = direction === 'backward' ? 'backward' : 'forward';
  switch (transition) {
    case 'slide':
      return { enter: `anim-slide-enter-${dir}`, exit: `anim-slide-exit-${dir}` };
    case 'fade':
      return { enter: 'anim-fade-enter', exit: 'anim-fade-exit' };
    case 'zoom':
      return { enter: 'anim-zoom-enter', exit: 'anim-zoom-exit' };
    default:
      return null;
  }
}

window.addEventListener('message', (event) => {
  const { type, slide, direction } = event.data || {};
  if (type === 'render') {
    selectedIndex = null;
    notifySelection(null);
    showSlideSimple(slide, direction);
  }
});

let animTimer = null;

function showSlideSimple(slide, direction) {
  // Cancel any in-flight animation immediately
  if (animTimer !== null) {
    clearTimeout(animTimer);
    animTimer = null;
    // Reset both containers to a clean state
    current.classList.remove(
      'anim-slide-enter-forward','anim-slide-exit-forward',
      'anim-slide-enter-backward','anim-slide-exit-backward',
      'anim-fade-enter','anim-fade-exit',
      'anim-zoom-enter','anim-zoom-exit'
    );
    next.innerHTML = '';
    next.className = 'slide-container hidden';
    next.style.cssText = '';
  }

  // No transition: render directly into current
  if (!currentSlide || !slide.transition || slide.transition === 'none') {
    renderSlide(current, slide);
    current.classList.remove('hidden');
    currentSlide = slide;
    return;
  }

  const anim = getAnimClasses(slide.transition, direction);
  if (!anim) {
    renderSlide(current, slide);
    currentSlide = slide;
    return;
  }

  // Render new slide into `next`, animate both, then promote `next` → `current`
  renderSlide(next, slide);
  next.classList.remove('hidden');
  next.style.visibility = 'visible';
  next.style.pointerEvents = 'auto';

  // Force reflow so CSS transition starts from the right keyframe
  void next.offsetWidth;

  next.classList.add(anim.enter);
  current.classList.add(anim.exit);

  const DURATION = 470;
  animTimer = setTimeout(() => {
    animTimer = null;

    // Swap: render the new slide fresh into `current` (avoids innerHTML/canvas loss)
    renderSlide(current, slide);
    if (!slide.soloHtml) {
      current.className = `slide-container layout-${slide.layout || 'content'}`;
      current.style.background = slide.background || '';
      current.style.color = slide.color || '';
    }

    // Reset next
    next.innerHTML = '';
    next.className = 'slide-container hidden';
    next.style.cssText = '';

    currentSlide = slide;
  }, DURATION);
}
