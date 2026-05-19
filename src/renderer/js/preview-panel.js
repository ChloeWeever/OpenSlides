// preview-panel.js — left pane: toolbar, slide viewport, thumbnail strip

const TRANSITIONS = ['none', 'slide', 'fade', 'zoom'];

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

// ── PreviewPanel ──────────────────────────────────────────────────────────────
function PreviewPanel({ slides, currentIndex, currentSlide, direction, onNext, onPrev, onGoTo, onSave, onElementSelected, canUndo, canRedo, onUndo, onRedo }) {
  const iframeRef = React.useRef(null);
  const [selectedTransition, setSelectedTransition] = React.useState(currentSlide?.transition || 'slide');
  const [showTransitions, setShowTransitions] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);

  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const send = () => {
      iframe.contentWindow?.postMessage(
        { type: 'render', slide: currentSlide, direction: direction.current },
        '*'
      );
    };
    if (iframe.contentDocument?.readyState === 'complete') send();
    else iframe.onload = send;
  }, [currentSlide]);

  // Listen for element selection from iframe
  React.useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'element-selected') {
        onElementSelected(e.data.element ?? null, e.data.elementIndex ?? null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onElementSelected]);

  // F5 to start fullscreen
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

        {/* Transition picker */}
        <div className="relative">
          <button
            onClick={() => setShowTransitions((v) => !v)}
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
      <div className="flex-1 flex items-center justify-center px-6 py-4 overflow-hidden">
        <div className="w-full max-w-3xl">
          <iframe
            ref={iframeRef}
            className="slide-viewport"
            src="slide-frame/slide-frame.html"
            title="Slide Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto flex-shrink-0 border-t border-[#2a2a3a] pt-3">
        {slides.map((slide, i) => (
          <button
            key={slide.id || i}
            onClick={() => onGoTo(i)}
            className={`slide-thumb w-24 flex-shrink-0 no-drag ${i === currentIndex ? 'active' : ''}`}
          >
            <ThumbnailSlide slide={slide} />
          </button>
        ))}
      </div>
    </div>
  );
}
