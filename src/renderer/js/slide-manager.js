// slide-manager.js — shared slide state hook with undo/redo history

const DEFAULT_SLIDES = [
  {
    id: 'slide-1',
    layout: 'title',
    background: '#1e1e2e',
    color: '#cdd6f4',
    transition: 'slide',
    elements: [
      { type: 'heading', text: 'Welcome to OpenSlides' },
      { type: 'subheading', text: 'AI-powered presentation editor' },
      { type: 'body', text: 'Start a conversation to generate your presentation.' },
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

  const slides = history[pointer];

  const currentSlide = slides[currentIndex] ?? slides[0];

  // Push a new slides snapshot onto the history stack
  const pushHistory = React.useCallback((newSlides) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, pointer + 1);
      const next = [...trimmed, newSlides];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setPointer((p) => {
      const next = Math.min(p + 1, MAX_HISTORY - 1);
      return next;
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
          pushHistory(data.slides);
          setCurrentIndex(0);
        }
        return;
      case 'add_slides':
        if (Array.isArray(data.slides)) {
          next = [...slides, ...data.slides];
          pushHistory(next);
        }
        return;
      case 'update_slide':
        next = slides.map((s) => (s.id === data.slideId ? { ...s, ...data.slide } : s));
        pushHistory(next);
        return;
      case 'delete_slide': {
        next = slides.filter((s) => s.id !== data.slideId);
        if (next.length === 0) return;
        pushHistory(next);
        setCurrentIndex((i) => Math.max(0, i - 1));
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
        setHistory([data.slides]);
        setPointer(0);
        setCurrentIndex(data.currentIndex ?? 0);
      }
    }
  }, []);

  const loadFromSlides = React.useCallback((newSlides) => {
    const slides = newSlides?.length ? newSlides : DEFAULT_SLIDES;
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
    applyAction,
    savePresentation,
    loadPresentation,
    loadFromSlides,
  };
}
