const current = document.getElementById('slide-current');
const next = document.getElementById('slide-next');

let currentSlide = null;
let selectedIndex = null;

function renderSlide(container, slide) {
  container.className = `slide-container layout-${slide.layout || 'content'}`;
  container.style.background = slide.background || '';
  container.style.color = slide.color || '';
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
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'max-width:100%;max-height:52vh;';
  container.appendChild(canvas);

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

  const isPie = el.kind === 'pie' || el.kind === 'doughnut';
  new Chart(canvas, {
    type: el.kind,
    data: { labels: el.labels || [], datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 600 },
      plugins: {
        legend: {
          labels: { color: '#a6adc8', font: { size: 13 }, padding: 16 },
        },
        title: el.title
          ? { display: true, text: el.title, color: '#cdd6f4', font: { size: 15, weight: '600' }, padding: { bottom: 12 } }
          : { display: false },
      },
      scales: isPie ? {} : {
        x: { ticks: { color: '#a6adc8', font: { size: 12 } }, grid: { color: 'rgba(255,255,255,.07)' } },
        y: { ticks: { color: '#a6adc8', font: { size: 12 } }, grid: { color: 'rgba(255,255,255,.07)' } },
      },
    },
  });
}

function renderFlow(el) {
  const nodes = el.nodes || [];
  const edges = el.edges || [];

  // BFS to assign column depths
  const depth = {};
  const adj = {};
  nodes.forEach(n => { depth[n.id] = -1; adj[n.id] = []; });
  edges.forEach(e => { if (adj[e.from]) adj[e.from].push(e.to); });

  const roots = nodes.filter(n => !edges.some(e => e.to === n.id)).map(n => n.id);
  if (!roots.length && nodes.length) roots.push(nodes[0].id);
  const queue = [...roots];
  roots.forEach(r => { depth[r] = 0; });
  while (queue.length) {
    const id = queue.shift();
    (adj[id] || []).forEach(nid => {
      if (depth[nid] < depth[id] + 1) {
        depth[nid] = depth[id] + 1;
        queue.push(nid);
      }
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
  const numCols = Object.keys(cols).length;

  const NW = 150, NH = 48, HGAP = 100, VGAP = 28;
  const maxPerCol = Math.max(...Object.values(cols).map(a => a.length));
  const svgW = numCols * NW + (numCols - 1) * HGAP + 40;
  const svgH = maxPerCol * NH + (maxPerCol - 1) * VGAP + 40;

  const pos = {};
  Object.entries(cols).forEach(([d, ids]) => {
    const colH = ids.length * NH + (ids.length - 1) * VGAP;
    const startY = (svgH - colH) / 2;
    ids.forEach((id, i) => {
      pos[id] = {
        x: 20 + Number(d) * (NW + HGAP),
        y: startY + i * (NH + VGAP),
      };
    });
  });

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
  svg.style.cssText = `width:100%;max-height:52vh;`;

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
  arrowPath.setAttribute('fill', '#89b4fa');
  arrowPath.setAttribute('opacity', '0.8');
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Edges
  edges.forEach(e => {
    const from = pos[e.from], to = pos[e.to];
    if (!from || !to) return;
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', from.x + NW);
    line.setAttribute('y1', from.y + NH / 2);
    line.setAttribute('x2', to.x - 2);
    line.setAttribute('y2', to.y + NH / 2);
    line.setAttribute('stroke', '#89b4fa');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-opacity', '0.6');
    line.setAttribute('marker-end', 'url(#arrow)');
    svg.appendChild(line);
  });

  // Node label helper
  const nodeLabel = (n) => n.label || n.id;

  // Nodes
  nodes.forEach(n => {
    const p = pos[n.id];
    if (!p) return;
    const g = document.createElementNS(ns, 'g');

    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', p.x);
    rect.setAttribute('y', p.y);
    rect.setAttribute('width', NW);
    rect.setAttribute('height', NH);
    rect.setAttribute('rx', '8');
    rect.setAttribute('ry', '8');
    rect.setAttribute('fill', 'rgba(137,180,250,.12)');
    rect.setAttribute('stroke', '#89b4fa');
    rect.setAttribute('stroke-width', '1.5');
    g.appendChild(rect);

    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', p.x + NW / 2);
    text.setAttribute('y', p.y + NH / 2 + 1);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#cdd6f4');
    text.setAttribute('font-size', '13');
    text.setAttribute('font-family', 'Inter,system-ui,sans-serif');
    text.textContent = nodeLabel(n);
    g.appendChild(text);

    svg.appendChild(g);
  });

  return svg;
}

function renderMindmap(el) {
  const root = el.root || 'Topic';
  const children = el.children || [];

  const ns = 'http://www.w3.org/2000/svg';
  const W = 700, H = 500, CX = W / 2, CY = H / 2;

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.cssText = 'width:100%;max-height:52vh;';

  function addNode(x, y, label, isRoot, colorIdx) {
    const color = CHART_PALETTE[colorIdx % CHART_PALETTE.length];
    const g = document.createElementNS(ns, 'g');
    const pad = isRoot ? 18 : 12;
    const charW = isRoot ? 9 : 8;
    const bw = Math.max(label.length * charW + pad * 2, isRoot ? 90 : 70);
    const bh = isRoot ? 40 : 32;

    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', x - bw / 2);
    rect.setAttribute('y', y - bh / 2);
    rect.setAttribute('width', bw);
    rect.setAttribute('height', bh);
    rect.setAttribute('rx', isRoot ? '12' : '8');
    rect.setAttribute('fill', isRoot ? 'rgba(137,180,250,.2)' : `${color}22`);
    rect.setAttribute('stroke', isRoot ? '#89b4fa' : color);
    rect.setAttribute('stroke-width', isRoot ? '2' : '1.5');
    g.appendChild(rect);

    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y + 1);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#cdd6f4');
    text.setAttribute('font-size', isRoot ? '14' : '12');
    text.setAttribute('font-weight', isRoot ? '700' : '500');
    text.setAttribute('font-family', 'Inter,system-ui,sans-serif');
    text.textContent = label;
    g.appendChild(text);

    return { g, x, y, color };
  }

  function addEdge(x1, y1, x2, y2, color) {
    const path = document.createElementNS(ns, 'path');
    const mx = (x1 + x2) / 2;
    path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-opacity', '0.5');
    svg.appendChild(path);
  }

  // Calculate total leaf count for even vertical distribution
  function countLeaves(node) {
    if (!node.children || !node.children.length) return 1;
    return node.children.reduce((s, c) => s + countLeaves(c), 0);
  }

  const totalLeaves = children.reduce((s, c) => s + countLeaves(c), 0) || 1;
  const { g: rootNode } = addNode(CX, CY, root, true, 0);
  svg.appendChild(rootNode);

  let leafCursor = 0;
  children.forEach((child, ci) => {
    const leaves = countLeaves(child);
    const midLeaf = leafCursor + leaves / 2;
    const angle = ((midLeaf / totalLeaves) * 2 * Math.PI) - Math.PI / 2;
    const r1 = 160;
    const cx = CX + r1 * Math.cos(angle);
    const cy = CY + r1 * Math.sin(angle);

    addEdge(CX, CY, cx, cy, CHART_PALETTE[ci % CHART_PALETTE.length]);
    const { g: childNode, color } = addNode(cx, cy, child.label || '', false, ci);
    svg.appendChild(childNode);

    // Grandchildren
    const subChildren = child.children || [];
    subChildren.forEach((gc, gci) => {
      const subAngle = angle + ((gci - (subChildren.length - 1) / 2) * 0.35);
      const r2 = 120;
      const gcx = cx + r2 * Math.cos(subAngle);
      const gcy = cy + r2 * Math.sin(subAngle);
      addEdge(cx, cy, gcx, gcy, color);
      const { g: gcNode } = addNode(gcx, gcy, gc.label || '', false, ci);
      svg.appendChild(gcNode);
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

function showSlideSimple(slide, direction) {
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

  renderSlide(next, slide);
  next.style.visibility = 'visible';
  next.style.pointerEvents = 'auto';
  next.classList.remove('hidden');
  next.classList.add(anim.enter);
  current.classList.add(anim.exit);

  setTimeout(() => {
    current.innerHTML = next.innerHTML;
    current.className = next.className.replace(anim.enter, '').replace('hidden', '').trim();
    current.style.cssText = next.style.cssText;
    next.innerHTML = '';
    next.className = 'slide-container hidden';
    next.style.cssText = '';
    currentSlide = slide;
  }, 470);
}
