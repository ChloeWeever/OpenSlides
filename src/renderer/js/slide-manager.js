// slide-manager.js — shared slide state hook with undo/redo history

const DEFAULT_SLIDES = [
  {
    id: 'slide-1',
    layout: 'title',
    transition: 'slide',
    elements: [
      { type: 'kicker', text: 'Welcome' },
      { type: 'heading', text: 'OpenSlides', gradient: true },
      { type: 'subheading', text: 'AI-powered presentation editor' },
      { type: 'divider' },
      { type: 'pills', items: [{ text: 'AI', accent: true }, 'Electron', 'React'] },
    ],
  },
  {
    id: 'slide-2',
    layout: 'content',
    transition: 'slide',
    elements: [
      { type: 'kicker', text: 'Get started' },
      { type: 'heading', text: 'How to use' },
      { type: 'bullets', items: [
        'Describe your presentation in the chat panel',
        'AI generates structured slides instantly',
        'Click any element to select and edit it',
        'Use Ctrl+Z / Ctrl+Y for undo & redo',
      ]},
    ],
  },
];

const MAX_HISTORY = 50;

function useSlideManager() {
  // history: array of slides snapshots; pointer points to current position
  const [history, setHistory] = React.useState([DEFAULT_SLIDES]);
  const [pointer, setPointer] = React.useState(0);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const lastDirection = React.useRef('forward');

  const slides = history[pointer] ?? history[history.length - 1] ?? DEFAULT_SLIDES;

  const currentSlide = slides[currentIndex] ?? slides[0];

  // Push a new slides snapshot onto the history stack
  const pushHistory = React.useCallback((newSlides) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, pointer + 1);
      const next = [...trimmed, newSlides];
      const clamped = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      // Update pointer inside the same batch to avoid a transient undefined history[pointer]
      setTimeout(() => setPointer(clamped.length - 1), 0);
      return clamped;
    });
  }, [pointer]);

  const canUndo = pointer > 0;
  const canRedo = pointer < history.length - 1;

  const undo = React.useCallback(() => {
    if (!canUndo) return;
    setPointer((p) => p - 1);
  }, [canUndo]);

  const redo = React.useCallback(() => {
    if (!canRedo) return;
    setPointer((p) => p + 1);
  }, [canRedo]);

  const reorderSlide = React.useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const next = [...slides];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    pushHistory(next);
    setCurrentIndex(toIndex);
  }, [slides, pushHistory]);

  const goNext = React.useCallback(() => {
    lastDirection.current = 'forward';
    setCurrentIndex((i) => Math.min(i + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = React.useCallback(() => {
    lastDirection.current = 'backward';
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const goTo = React.useCallback((index) => {
    lastDirection.current = index > currentIndex ? 'forward' : 'backward';
    setCurrentIndex(index);
  }, [currentIndex]);

  const applyAction = React.useCallback((data) => {
    if (!data) return;
    let next;
    switch (data.action) {
      case 'replace_all':
        if (Array.isArray(data.slides) && data.slides.length > 0) {
          lastDirection.current = 'none';
          pushHistory(data.slides);
          setCurrentIndex(0);
        }
        return;
      case 'add_slides': {
        if (Array.isArray(data.slides)) {
          // Insert after data.afterIndex if provided, otherwise append
          const idx = data.afterIndex != null ? data.afterIndex + 1 : slides.length;
          next = [...slides.slice(0, idx), ...data.slides, ...slides.slice(idx)];
          pushHistory(next);
          setCurrentIndex(idx);
        }
        return;
      }
      case 'update_slide':
        next = slides.map((s) => (s.id === data.slideId ? { ...s, ...data.slide } : s));
        pushHistory(next);
        return;
      case 'delete_slide': {
        next = slides.filter((s) => s.id !== data.slideId);
        if (next.length === 0) return;
        pushHistory(next);
        setCurrentIndex((i) => Math.min(i, next.length - 1));
        return;
      }
      default:
        return;
    }
  }, [slides, pushHistory]);

  const savePresentation = React.useCallback(async () => {
    if (window.openslides) {
      await window.openslides.savePresentation({ slides, currentIndex });
    }
  }, [slides, currentIndex]);

  const loadPresentation = React.useCallback(async () => {
    if (window.openslides) {
      const data = await window.openslides.loadPresentation();
      if (data?.slides?.length) {
        lastDirection.current = 'none';
        setHistory([data.slides]);
        setPointer(0);
        setCurrentIndex(data.currentIndex ?? 0);
      }
    }
  }, []);

  const loadFromSlides = React.useCallback((newSlides) => {
    const slides = newSlides?.length ? newSlides : DEFAULT_SLIDES;
    lastDirection.current = 'none';
    setHistory([slides]);
    setPointer(0);
    setCurrentIndex(0);
  }, []);

  return {
    slides,
    currentIndex,
    currentSlide,
    direction: lastDirection,
    canUndo,
    canRedo,
    undo,
    redo,
    goNext,
    goPrev,
    goTo,
    reorderSlide,
    applyAction,
    savePresentation,
    loadPresentation,
    loadFromSlides,
  };
}
