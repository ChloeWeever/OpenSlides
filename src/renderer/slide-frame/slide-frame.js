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
      node = document.createElement('img');
      node.className = 'el-image';
      node.src = el.src;
      node.alt = el.alt || '';
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
    default:
      return null;
  }

  node.dataset.elIndex = index;
  node.classList.add('el-selectable');
  return node;
}

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
