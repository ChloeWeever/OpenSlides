// preview-panel.js — left pane: toolbar, slide viewport, thumbnail strip

const TRANSITIONS = ['none', 'slide', 'fade', 'zoom'];

// ── Colour themes ──────────────────────────────────────────────────────────────
const THEMES = [
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    bg: ['#0f0f1a', '#13131f'],
    color: '#cdd6f4',
    swatch: ['#0f0f1a', '#89b4fa', '#cba6f7'],
    themeVars: { accent:'#89b4fa', accent2:'#cba6f7', accent3:'#f38ba8', grad:'linear-gradient(135deg,#89b4fa,#cba6f7 55%,#f38ba8)', gradSoft:'linear-gradient(135deg,rgba(137,180,250,.15),rgba(203,166,247,.12) 55%,rgba(243,139,168,.1))', surface:'rgba(137,180,250,.08)', surface2:'rgba(203,166,247,.08)', border:'rgba(255,255,255,.08)' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    bg: ['#080c14', '#0c1020'],
    color: '#e2e8f8',
    swatch: ['#080c14', '#38bdf8', '#818cf8'],
    themeVars: { accent:'#38bdf8', accent2:'#818cf8', accent3:'#fb7185', grad:'linear-gradient(135deg,#38bdf8,#818cf8 55%,#fb7185)', gradSoft:'linear-gradient(135deg,rgba(56,189,248,.15),rgba(129,140,248,.12) 55%,rgba(251,113,133,.1))', surface:'rgba(56,189,248,.08)', surface2:'rgba(129,140,248,.08)', border:'rgba(255,255,255,.08)' },
  },
  {
    id: 'forest',
    name: 'Forest',
    bg: ['#0a120e', '#0d1912'],
    color: '#d4f0e0',
    swatch: ['#0a120e', '#4ade80', '#34d399'],
    themeVars: { accent:'#4ade80', accent2:'#34d399', accent3:'#a3e635', grad:'linear-gradient(135deg,#4ade80,#34d399 55%,#a3e635)', gradSoft:'linear-gradient(135deg,rgba(74,222,128,.15),rgba(52,211,153,.12) 55%,rgba(163,230,53,.1))', surface:'rgba(74,222,128,.08)', surface2:'rgba(52,211,153,.08)', border:'rgba(255,255,255,.07)' },
  },
  {
    id: 'ember',
    name: 'Ember',
    bg: ['#150a06', '#1c0f08'],
    color: '#fde8d8',
    swatch: ['#150a06', '#fb923c', '#f43f5e'],
    themeVars: { accent:'#fb923c', accent2:'#f43f5e', accent3:'#fbbf24', grad:'linear-gradient(135deg,#fb923c,#f43f5e 55%,#fbbf24)', gradSoft:'linear-gradient(135deg,rgba(251,146,60,.15),rgba(244,63,94,.12) 55%,rgba(251,191,36,.1))', surface:'rgba(251,146,60,.08)', surface2:'rgba(244,63,94,.08)', border:'rgba(255,255,255,.07)' },
  },
  {
    id: 'rose',
    name: 'Rose Gold',
    bg: ['#140d10', '#1c1118'],
    color: '#fce7f3',
    swatch: ['#140d10', '#f472b6', '#e879f9'],
    themeVars: { accent:'#f472b6', accent2:'#e879f9', accent3:'#fb7185', grad:'linear-gradient(135deg,#f472b6,#e879f9 55%,#fb7185)', gradSoft:'linear-gradient(135deg,rgba(244,114,182,.15),rgba(232,121,249,.12) 55%,rgba(251,113,133,.1))', surface:'rgba(244,114,182,.08)', surface2:'rgba(232,121,249,.08)', border:'rgba(255,255,255,.07)' },
  },
  {
    id: 'slate',
    name: 'Slate',
    bg: ['#0f1117', '#141720'],
    color: '#e2e8f0',
    swatch: ['#0f1117', '#94a3b8', '#64748b'],
    themeVars: { accent:'#94a3b8', accent2:'#cbd5e1', accent3:'#7dd3fc', grad:'linear-gradient(135deg,#94a3b8,#cbd5e1 55%,#7dd3fc)', gradSoft:'linear-gradient(135deg,rgba(148,163,184,.15),rgba(203,213,225,.12) 55%,rgba(125,211,252,.1))', surface:'rgba(148,163,184,.08)', surface2:'rgba(203,213,225,.08)', border:'rgba(255,255,255,.07)' },
  },
  {
    id: 'light',
    name: 'Light',
    bg: ['#f8f9fc', '#f0f2f8'],
    color: '#111827',
    swatch: ['#f8f9fc', '#6366f1', '#ec4899'],
    themeVars: { accent:'#6366f1', accent2:'#8b5cf6', accent3:'#ec4899', grad:'linear-gradient(135deg,#6366f1,#8b5cf6 55%,#ec4899)', gradSoft:'linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.1) 55%,rgba(236,72,153,.08))', surface:'rgba(99,102,241,.08)', surface2:'rgba(139,92,246,.06)', border:'rgba(0,0,0,.08)', text1:'#111827', text2:'#374151', text3:'#6b7280' },
  },
  {
    id: 'corporate',
    name: 'Corporate',
    bg: ['#f5f7fa', '#eef1f7'],
    color: '#0f172a',
    swatch: ['#f5f7fa', '#2563eb', '#0ea5e9'],
    themeVars: { accent:'#2563eb', accent2:'#0ea5e9', accent3:'#6366f1', grad:'linear-gradient(135deg,#2563eb,#0ea5e9 55%,#6366f1)', gradSoft:'linear-gradient(135deg,rgba(37,99,235,.12),rgba(14,165,233,.1) 55%,rgba(99,102,241,.08))', surface:'rgba(37,99,235,.06)', surface2:'rgba(14,165,233,.05)', border:'rgba(0,0,0,.07)', text1:'#0f172a', text2:'#1e3a5f', text3:'#475569' },
  },
];

function ThemeSwatch({ theme, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={theme.name}
      className={`relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${active ? 'bg-[#6366f1]/20 ring-1 ring-[#6366f1]' : 'hover:bg-[#2a2a3a]'}`}
    >
      <div className="w-12 h-8 rounded-md overflow-hidden flex-shrink-0" style={{ background: theme.swatch[0] }}>
        <div className="w-full h-full flex">
          <div className="flex-1" style={{ background: theme.swatch[0] }} />
          <div className="w-3" style={{ background: theme.swatch[1] }} />
          <div className="w-2" style={{ background: theme.swatch[2] }} />
        </div>
      </div>
      <span className="text-[9px] text-[#8888a8] leading-none whitespace-nowrap">{theme.name}</span>
    </button>
  );
}

function ThumbnailSlide({ slide }) {
  return (
    <div
      style={{
        background: slide.background || '#1e1e2e',
        color: slide.color || '#cdd6f4',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '4px',
        overflow: 'hidden',
      }}
    >
      {(slide.elements || []).slice(0, 3).map((el, i) => (
        <div key={i} style={{ fontSize: el.type === 'heading' ? '6px' : '4px', fontWeight: el.type === 'heading' ? 700 : 400, opacity: 0.9, textAlign: 'center', lineHeight: 1.3, overflow: 'hidden', maxWidth: '100%', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {el.type === 'bullets' ? (el.items || []).slice(0, 2).join(' · ') : el.text}
        </div>
      ))}
    </div>
  );
}

// ── Thumbnail strip with drag-to-reorder ──────────────────────────────────────
function ThumbnailStrip({ slides, currentIndex, onGoTo, onReorder }) {
  const dragFrom = React.useRef(null);
  const [dragOver, setDragOver] = React.useState(null);

  const handleDragStart = (e, i) => {
    dragFrom.current = i;
    e.dataTransfer.effectAllowed = 'move';
    // Ghost image: use the element itself
    e.dataTransfer.setDragImage(e.currentTarget, 48, 32);
  };

  const handleDragOver = (e, i) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== i) setDragOver(i);
  };

  const handleDrop = (e, i) => {
    e.preventDefault();
    const from = dragFrom.current;
    setDragOver(null);
    dragFrom.current = null;
    if (from != null && from !== i) onReorder(from, i);
  };

  const handleDragEnd = () => {
    setDragOver(null);
    dragFrom.current = null;
  };

  return (
    <div className="flex gap-2 px-4 pb-3 overflow-x-auto flex-shrink-0 border-t border-[#2a2a3a] pt-3">
      {slides.map((slide, i) => (
        <div
          key={slide.id || i}
          draggable
          onDragStart={(e) => handleDragStart(e, i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={(e) => handleDrop(e, i)}
          onDragEnd={handleDragEnd}
          style={{
            outline: dragOver === i && dragFrom.current !== i
              ? '2px solid #6366f1'
              : 'none',
            borderRadius: '6px',
            transition: 'outline 0.1s',
          }}
        >
          <button
            onClick={() => onGoTo(i)}
            className={`slide-thumb w-24 flex-shrink-0 no-drag ${i === currentIndex ? 'active' : ''}`}
            title={`Slide ${i + 1} — drag to reorder`}
          >
            <ThumbnailSlide slide={slide} />
          </button>
          <div className="text-center text-[10px] text-[#4a4a6a] mt-0.5 select-none">{i + 1}</div>
        </div>
      ))}
    </div>
  );
}

// ── Fullscreen presenter overlay ──────────────────────────────────────────────
function FullscreenPresenter({ slides, startIndex, onClose }) {
  const [index, setIndex] = React.useState(startIndex);
  const [showControls, setShowControls] = React.useState(true);
  const [direction, setDirection] = React.useState('forward');
  const iframeRef = React.useRef(null);
  const hideTimer = React.useRef(null);
  const containerRef = React.useRef(null);

  const slide = slides[index];
  const canPrev = index > 0;
  const canNext = index < slides.length - 1;

  // Send slide to iframe whenever it changes
  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const send = () => {
      iframe.contentWindow?.postMessage({ type: 'render', slide, direction }, '*');
    };
    if (iframe.contentDocument?.readyState === 'complete') send();
    else iframe.onload = send;
  }, [slide, direction]);

  // Enter browser fullscreen on mount
  React.useEffect(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // Exit when browser fullscreen is dismissed (e.g. user presses F11 or ESC in browser)
  React.useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [onClose]);

  // Keyboard navigation
  React.useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        if (canNext) { setDirection('forward'); setIndex((i) => i + 1); }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        if (canPrev) { setDirection('backward'); setIndex((i) => i - 1); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canNext, canPrev, onClose]);

  // Auto-hide controls after 3s of no mouse movement
  const resetHideTimer = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  };
  React.useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, []);

  const goTo = (i) => {
    setDirection(i > index ? 'forward' : 'backward');
    setIndex(i);
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
    >
      {/* Slide iframe — fills screen */}
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          src="slide-frame/slide-frame.html"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
          title="Fullscreen Slide"
        />

        {/* Left / right click zones */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1/5 cursor-pointer"
          onClick={() => { if (canPrev) { setDirection('backward'); setIndex((i) => i - 1); } }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-1/5 cursor-pointer"
          onClick={() => { if (canNext) { setDirection('forward'); setIndex((i) => i + 1); } }}
        />
      </div>

      {/* Controls overlay — fades in/out */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 pointer-events-auto"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
          <span className="text-white text-sm font-medium opacity-80">
            {(slide?.elements || []).find((e) => e.type === 'heading')?.text || `Slide ${index + 1}`}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-sm"
            title="Exit (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Bottom bar: prev / counter / progress / next */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-auto"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)' }}>
          {/* Progress bar */}
          <div className="flex gap-1 px-6 pb-1 pt-3">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-1 flex-1 rounded-full transition-all duration-200 ${i === index ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`}
              />
            ))}
          </div>

          {/* Nav row */}
          <div className="flex items-center justify-center gap-4 px-6 pb-5 pt-2">
            <button
              onClick={() => { if (canPrev) { setDirection('backward'); setIndex((i) => i - 1); } }}
              disabled={!canPrev}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all ${canPrev ? 'bg-white/10 hover:bg-white/20 text-white' : 'text-white/20 cursor-not-allowed'}`}
            >
              ‹
            </button>
            <span className="text-white/70 text-sm font-mono min-w-[56px] text-center">
              {index + 1} / {slides.length}
            </span>
            <button
              onClick={() => { if (canNext) { setDirection('forward'); setIndex((i) => i + 1); } }}
              disabled={!canNext}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all ${canNext ? 'bg-white/10 hover:bg-white/20 text-white' : 'text-white/20 cursor-not-allowed'}`}
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Image layout templates ────────────────────────────────────────────────────
const IMAGE_LAYOUTS = [
  {
    id: 'single',
    label: 'Single',
    count: 1,
    icon: '▣',
    preview: [{ x: 10, y: 10, w: 80, h: 80 }],
    build: (urls) => ({ type: 'image', src: urls[0], alt: '', align: 'center', objectFit: 'contain' }),
  },
  {
    id: 'two-col',
    label: '2 Side by Side',
    count: 2,
    icon: '▣▣',
    preview: [{ x: 5, y: 10, w: 40, h: 80 }, { x: 55, y: 10, w: 40, h: 80 }],
    build: (urls) => ({ type: 'images', cols: 2, gap: 12, objectFit: 'cover', radius: 10,
      items: urls.map((src) => ({ src, alt: '' })) }),
  },
  {
    id: 'three-col',
    label: '3 Column',
    count: 3,
    icon: '▣▣▣',
    preview: [{ x: 3, y: 10, w: 28, h: 80 }, { x: 36, y: 10, w: 28, h: 80 }, { x: 69, y: 10, w: 28, h: 80 }],
    build: (urls) => ({ type: 'images', cols: 3, gap: 10, objectFit: 'cover', radius: 8,
      items: urls.map((src) => ({ src, alt: '' })) }),
  },
  {
    id: 'hero-thumb',
    label: 'Hero + Thumbs',
    count: 3,
    icon: '▣+▣▣',
    preview: [
      { x: 5, y: 10, w: 55, h: 80 },
      { x: 65, y: 10, w: 30, h: 37 },
      { x: 65, y: 53, w: 30, h: 37 },
    ],
    build: (urls) => ({
      type: 'images', cols: 2, gap: 10, objectFit: 'cover', radius: 10,
      items: [
        { src: urls[0], alt: '', style: 'grid-row: span 2' },
        { src: urls[1], alt: '' },
        { src: urls[2], alt: '' },
      ],
      // CSS grid: first item spans 2 rows
      gridTemplate: '"a b" "a c"',
    }),
  },
  {
    id: 'two-plus-one',
    label: 'Wide + 2 Stack',
    count: 3,
    icon: '▬+▣▣',
    preview: [
      { x: 5, y: 10, w: 90, h: 45 },
      { x: 5, y: 58, w: 42, h: 32 },
      { x: 53, y: 58, w: 42, h: 32 },
    ],
    build: (urls) => ({ type: 'images', cols: 2, gap: 10, objectFit: 'cover', radius: 10,
      gridTemplate: '"a a" "b c"',
      items: urls.map((src) => ({ src, alt: '' })) }),
  },
  {
    id: 'mosaic',
    label: 'Mosaic 4',
    count: 4,
    icon: '⊞',
    preview: [
      { x: 5, y: 10, w: 42, h: 37 }, { x: 53, y: 10, w: 42, h: 37 },
      { x: 5, y: 52, w: 42, h: 37 }, { x: 53, y: 52, w: 42, h: 37 },
    ],
    build: (urls) => ({ type: 'images', cols: 2, gap: 8, objectFit: 'cover', radius: 10,
      items: urls.map((src) => ({ src, alt: '' })) }),
  },
  {
    id: 'strip',
    label: 'Horizontal Strip',
    count: 4,
    icon: '▬▬▬▬',
    preview: [
      { x: 3, y: 25, w: 21, h: 50 }, { x: 27, y: 25, w: 21, h: 50 },
      { x: 51, y: 25, w: 21, h: 50 }, { x: 75, y: 25, w: 21, h: 50 },
    ],
    build: (urls) => ({ type: 'images', cols: 4, gap: 8, height: 220, objectFit: 'cover', radius: 8,
      items: urls.map((src) => ({ src, alt: '' })) }),
  },
];

// Mini SVG preview for a layout
function LayoutPreview({ rects }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: 72, height: 72 }}>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h}
          rx="4" fill="rgba(137,180,250,.25)" stroke="#89b4fa" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

// ── ImageTray — shows images on the current slide, allows removal ─────────────
function ImageTray({ slide, onApplyAction }) {
  const images = (slide?.elements || [])
    .map((el, idx) => ({ el, idx }))
    .filter(({ el }) => el.type === 'image' || el.type === 'images');
  if (!images.length) return null;

  const handleRemove = (elIndex) => {
    const elements = (slide.elements || []).filter((_, i) => i !== elIndex);
    onApplyAction({ action: 'update_slide', slideId: slide.id, slide: { ...slide, elements } });
  };

  const thumbSrc = (el) => {
    if (el.type === 'image') return el.src;
    return el.items?.[0]?.src || '';
  };

  const thumbLabel = (el) => {
    if (el.type === 'image') return '1 image';
    return `${(el.items||[]).length} images`;
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-[#2a2a3a] overflow-x-auto flex-shrink-0">
      <span className="text-[10px] text-[#4a4a6a] uppercase tracking-wider flex-shrink-0">Images</span>
      {images.map(({ el, idx }) => (
        <div key={idx} className="relative flex-shrink-0 group">
          <div className="h-12 w-20 rounded-md border border-[#2a2a3a] overflow-hidden bg-[#1a1a2a] flex items-center justify-center">
            <img src={thumbSrc(el)} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="text-[9px] text-[#4a4a6a] text-center mt-0.5">{thumbLabel(el)}</div>
          <button
            onClick={() => handleRemove(idx)}
            title="Remove"
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#f38ba8] text-black text-[9px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ── PreviewPanel ──────────────────────────────────────────────────────────────
function PreviewPanel({ slides, currentIndex, currentSlide, direction, onNext, onPrev, onGoTo, onReorder, onApplyAction, onSave, onElementSelected, canUndo, canRedo, onUndo, onRedo }) {
  const iframeRef = React.useRef(null);
  const viewportContainerRef = React.useRef(null);
  const [viewportSize, setViewportSize] = React.useState({ width: 0, height: 0 });
  const [selectedTransition, setSelectedTransition] = React.useState(currentSlide?.transition || 'slide');
  const [showTransitions, setShowTransitions] = React.useState(false);
  const [showThemes, setShowThemes] = React.useState(false);
  const [activeThemeId, setActiveThemeId] = React.useState('catppuccin');
  const [fullscreen, setFullscreen] = React.useState(false);
  const [showImagePicker, setShowImagePicker] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const imagePickerRef = React.useRef(null);
  const themePickerRef = React.useRef(null);

  // Apply a theme to all slides
  const applyTheme = React.useCallback((theme) => {
    setActiveThemeId(theme.id);
    setShowThemes(false);
    const newSlides = slides.map((s, i) => ({
      ...s,
      background: theme.bg[i % theme.bg.length],
      color: theme.color,
      themeVars: theme.themeVars,
    }));
    onApplyAction({ action: 'replace_all', slides: newSlides });
  }, [slides, onApplyAction]);

  // Close theme picker on outside click
  React.useEffect(() => {
    if (!showThemes) return;
    const handler = (e) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target)) setShowThemes(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showThemes]);

  // Fit 16:9 iframe to available container space
  React.useEffect(() => {
    const el = viewportContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const pad = 48; // px breathing room on each axis
      const availW = width - pad;
      const availH = height - pad;
      const byWidth = { w: availW, h: availW * 9 / 16 };
      const byHeight = { w: availH * 16 / 9, h: availH };
      const fit = byHeight.w <= availW ? byHeight : byWidth;
      setViewportSize({ width: Math.round(fit.w), height: Math.round(fit.h) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Close image picker on outside click
  React.useEffect(() => {
    if (!showImagePicker) return;
    const handler = (e) => {
      if (imagePickerRef.current && !imagePickerRef.current.contains(e.target)) {
        setShowImagePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showImagePicker]);

  const handleInsertLayout = React.useCallback(async (layout) => {
    setShowImagePicker(false);
    if (!window.openslides?.pickImage) return;
    setUploadingImage(true);
    try {
      const urls = [];
      for (let i = 0; i < layout.count; i++) {
        const result = await window.openslides.pickImage();
        if (!result.success) break;
        urls.push(result.dataUrl);
      }
      if (!urls.length) return;
      // Fill remaining slots with first image if user cancelled early
      while (urls.length < layout.count) urls.push(urls[0]);
      const element = layout.build(urls);
      const updatedElements = [...(currentSlide.elements || []), element];
      onApplyAction({ action: 'update_slide', slideId: currentSlide.id, slide: { ...currentSlide, elements: updatedElements } });
    } finally {
      setUploadingImage(false);
    }
  }, [currentSlide, onApplyAction]);

  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const msg = { type: 'render', slide: currentSlide, direction: direction.current };
    const send = () => iframe.contentWindow?.postMessage(msg, '*');
    let cancelled = false;
    if (iframe.contentDocument?.readyState === 'complete') {
      send();
    } else {
      iframe.onload = () => { if (!cancelled) send(); };
    }
    return () => { cancelled = true; };
  }, [currentSlide]);

  React.useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'element-selected') {
        onElementSelected(e.data.element ?? null, e.data.elementIndex ?? null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onElementSelected]);

  React.useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F5') { e.preventDefault(); setFullscreen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < slides.length - 1;

  return (
    <div className="flex flex-col h-full bg-[#0f0f0f] select-none">
      {/* Fullscreen presenter */}
      {fullscreen && (
        <FullscreenPresenter
          slides={slides}
          startIndex={currentIndex}
          onClose={() => setFullscreen(false)}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#2a2a3a] no-drag flex-shrink-0">
        <button
          onClick={onPrev}
          disabled={!canPrev}
          title="Previous slide"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-sm ${canPrev ? 'text-[#cdd6f4] hover:bg-[#2a2a3a]' : 'text-[#3a3a54] cursor-not-allowed'}`}
        >
          ‹
        </button>

        <span className="text-xs text-[#8888a8] min-w-[52px] text-center font-mono">
          {currentIndex + 1} / {slides.length}
        </span>

        <button
          onClick={onNext}
          disabled={!canNext}
          title="Next slide"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-sm ${canNext ? 'text-[#cdd6f4] hover:bg-[#2a2a3a]' : 'text-[#3a3a54] cursor-not-allowed'}`}
        >
          ›
        </button>

        <div className="w-px h-5 bg-[#2a2a3a] mx-1" />

        <span className="text-sm text-[#cdd6f4] flex-1 truncate">
          {(currentSlide?.elements || []).find((e) => e.type === 'heading')?.text || `Slide ${currentIndex + 1}`}
        </span>

        {/* Insert image — layout picker */}
        <div className="relative" ref={imagePickerRef}>
          <button
            onClick={() => setShowImagePicker((v) => !v)}
            disabled={uploadingImage}
            title="Insert image(s) into current slide"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all disabled:opacity-40 ${showImagePicker ? 'bg-[#6366f1] text-white border-[#6366f1]' : 'text-[#8888a8] hover:text-white hover:bg-[#2a2a3a] border-[#2a2a3a]'}`}
          >
            {uploadingImage ? '…' : '🖼 Image'}
          </button>
          {showImagePicker && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-[#1c1c28] border border-[#2a2a3a] rounded-xl shadow-2xl p-3" style={{ width: 340 }}>
              <div className="text-[10px] text-[#4a4a6a] uppercase tracking-wider mb-2 px-1">Choose a layout</div>
              <div className="grid grid-cols-3 gap-2">
                {IMAGE_LAYOUTS.map((layout) => (
                  <button
                    key={layout.id}
                    onClick={() => handleInsertLayout(layout)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-[#2a2a3a] transition-colors group"
                  >
                    <LayoutPreview rects={layout.preview} />
                    <span className="text-[10px] text-[#8888a8] group-hover:text-[#cdd6f4] transition-colors text-center leading-tight">
                      {layout.label}
                    </span>
                    <span className="text-[9px] text-[#4a4a6a]">{layout.count} photo{layout.count > 1 ? 's' : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme picker */}
        <div ref={themePickerRef} className="relative">
          <button
            onClick={() => { setShowThemes((v) => !v); setShowTransitions(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${showThemes ? 'bg-[#6366f1] text-white border-[#6366f1]' : 'text-[#8888a8] hover:text-white hover:bg-[#2a2a3a] border-[#2a2a3a]'}`}
            title="Color theme"
          >
            <span className="flex gap-0.5">
              {(THEMES.find(t => t.id === activeThemeId) || THEMES[0]).swatch.map((c, i) => (
                <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
              ))}
            </span>
            Theme
          </button>
          {showThemes && (
            <div className="absolute left-0 top-full mt-1 bg-[#1c1c28] border border-[#2a2a3a] rounded-xl shadow-2xl z-20 p-2" style={{ width: 300 }}>
              <div className="text-[10px] text-[#4a4a6a] uppercase tracking-wider mb-2 px-1">Color Theme</div>
              <div className="grid grid-cols-4 gap-1">
                {THEMES.map((theme) => (
                  <ThemeSwatch
                    key={theme.id}
                    theme={theme}
                    active={activeThemeId === theme.id}
                    onClick={() => applyTheme(theme)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Transition picker */}
        <div className="relative">
          <button
            onClick={() => { setShowTransitions((v) => !v); setShowThemes(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#8888a8] hover:text-white hover:bg-[#2a2a3a] border border-[#2a2a3a] transition-all"
          >
            ✦ {selectedTransition}
          </button>
          {showTransitions && (
            <div className="absolute right-0 top-full mt-1 bg-[#1c1c28] border border-[#2a2a3a] rounded-lg shadow-xl z-10 overflow-hidden">
              {TRANSITIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => { setSelectedTransition(t); setShowTransitions(false); }}
                  className={`block w-full text-left px-4 py-2 text-sm transition-colors ${t === selectedTransition ? 'bg-[#6366f1] text-white' : 'text-[#cdd6f4] hover:bg-[#2a2a3a]'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Present button */}
        <button
          onClick={() => setFullscreen(true)}
          title="Present fullscreen (F5)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#6366f1] hover:bg-[#5254cc] text-white transition-all"
        >
          ▶ Present
        </button>

        <div className="w-px h-5 bg-[#2a2a3a] mx-1" />

        {/* Save */}
        <button
          onClick={onSave}
          title="Save presentation"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8888a8] hover:text-white hover:bg-[#2a2a3a] transition-colors text-sm"
        >
          ↓
        </button>

        <div className="w-px h-5 bg-[#2a2a3a] mx-1" />

        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-sm ${canUndo ? 'text-[#cdd6f4] hover:bg-[#2a2a3a]' : 'text-[#3a3a54] cursor-not-allowed'}`}
        >
          ↩
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-sm ${canRedo ? 'text-[#cdd6f4] hover:bg-[#2a2a3a]' : 'text-[#3a3a54] cursor-not-allowed'}`}
        >
          ↪
        </button>
      </div>

      {/* Slide viewport */}
      <div ref={viewportContainerRef} className="flex-1 flex items-center justify-center overflow-hidden">
        <iframe
          ref={iframeRef}
          className="slide-viewport"
          src="slide-frame/slide-frame.html"
          title="Slide Preview"
          sandbox="allow-scripts allow-same-origin"
          style={viewportSize.width > 0
            ? { width: viewportSize.width, height: viewportSize.height }
            : { width: '100%', aspectRatio: '16/9' }}
        />
      </div>

      {/* Image tray — shown when current slide has images */}
      <ImageTray slide={currentSlide} onApplyAction={onApplyAction} />

      {/* Thumbnail strip */}
      <ThumbnailStrip
        slides={slides}
        currentIndex={currentIndex}
        onGoTo={onGoTo}
        onReorder={onReorder}
      />
    </div>
  );
}
