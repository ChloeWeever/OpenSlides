const current = document.getElementById('slide-current');
const next = document.getElementById('slide-next');

let currentSlide = null;
let selectedIndex = null;

function renderSlide(container, slide) {
  container.className = `slide-container layout-${slide.layout || 'content'}`;
  container.style.background = slide.background || '#1e1e2e';
  container.style.color = slide.color || '#cdd6f4';
  container.innerHTML = '';

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

function buildElement(el, index) {
  let node;
  switch (el.type) {
    case 'heading': {
      node = document.createElement('h1');
      node.className = 'el-heading';
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
    // Click on blank area → deselect
    if (selectedIndex !== null) {
      selectedIndex = null;
      applyHighlight(null);
      notifySelection(null);
    }
    return;
  }
  const index = parseInt(target.dataset.elIndex, 10);
  if (selectedIndex === index) {
    // Toggle off
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
    selectedIndex = null; // clear selection on slide change
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
