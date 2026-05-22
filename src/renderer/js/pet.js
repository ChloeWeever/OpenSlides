// pet.js — Codex desktop pet: CodexSprite + PetFloat + PetdexGallery
// Ported from nexus-chat (TypeScript → plain React/JSX)

// ── CodexSprite ───────────────────────────────────────────────────────────────

const SPRITE_COLS = 8;
const SPRITE_ROWS = 9;

const SPRITE_STATES = {
  idle:    { row: 0, frames: 6, fps: 7 },
  runR:    { row: 1, frames: 8, fps: 12 },
  runL:    { row: 2, frames: 8, fps: 12 },
  waving:  { row: 3, frames: 4, fps: 8 },
  jumping: { row: 4, frames: 5, fps: 10 },
  failed:  { row: 5, frames: 8, fps: 8 },
  waiting: { row: 6, frames: 6, fps: 5 },
  running: { row: 7, frames: 6, fps: 10 },
  review:  { row: 8, frames: 6, fps: 7 },
};

function CodexSprite({ spritesheetUrl, state = 'idle', displayWidth = 80, jumping = false }) {
  const [frame, setFrame] = React.useState(0);
  const [imgSize, setImgSize] = React.useState(null);
  const activeState = jumping ? 'jumping' : state;

  React.useEffect(() => {
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = spritesheetUrl;
  }, [spritesheetUrl]);

  React.useEffect(() => {
    setFrame(0);
    const anim = SPRITE_STATES[activeState] || SPRITE_STATES.idle;
    const id = setInterval(
      () => setFrame(f => (f + 1) % anim.frames),
      Math.round(1000 / anim.fps)
    );
    return () => clearInterval(id);
  }, [activeState]);

  if (!imgSize) return React.createElement('div', { style: { width: displayWidth, height: displayWidth } });

  const frameW = imgSize.w / SPRITE_COLS;
  const frameH = imgSize.h / SPRITE_ROWS;
  const scale = displayWidth / frameW;
  const displayH = Math.round(frameH * scale);
  const bgW = Math.round(imgSize.w * scale);
  const bgH = Math.round(imgSize.h * scale);
  const bgX = -(frame * displayWidth);
  const bgY = -((SPRITE_STATES[activeState]?.row ?? 0) * displayH);

  return (
    <div style={{
      width: displayWidth,
      height: displayH,
      backgroundImage: `url(${spritesheetUrl})`,
      backgroundSize: `${bgW}px ${bgH}px`,
      backgroundPosition: `${bgX}px ${bgY}px`,
      backgroundRepeat: 'no-repeat',
      cursor: 'grab',
      userSelect: 'none',
    }} />
  );
}

// ── PetFloat ──────────────────────────────────────────────────────────────────

const PET_WIDTH = 80;
const PET_CLICK_MESSAGES = ['...', 'Focus!', 'On it!', '*yawn*', 'Meow~'];
const PET_WALK_SPEED = 1.5;
const PET_WALK_TICK_MS = 16;
const PET_POS_KEY = 'openslides-pet-pos';

function loadPetPos() {
  try {
    const s = localStorage.getItem(PET_POS_KEY);
    if (s) return JSON.parse(s);
  } catch { /**/ }
  return { bottom: 20, right: 20 };
}

function PetFloat({ spritesheetUrl, isBusy }) {
  const [pos, setPos] = React.useState(loadPetPos);
  const [message, setMessage] = React.useState(null);
  const [jumping, setJumping] = React.useState(false);
  const [spriteState, setSpriteState] = React.useState('idle');

  const posRef = React.useRef(pos);
  const isBusyRef = React.useRef(false);
  const wanderRef = React.useRef(true);
  const floatRef = React.useRef(null);
  const msgTimer = React.useRef(null);
  const jumpTimer = React.useRef(null);
  const wanderTimer = React.useRef(null);
  const walkInterval = React.useRef(null);
  const postBusyTimer = React.useRef(null);
  const dragState = React.useRef(null);

  const setPosTracked = React.useCallback((p) => {
    posRef.current = p;
    setPos(p);
  }, []);

  React.useEffect(() => {
    localStorage.setItem(PET_POS_KEY, JSON.stringify(pos));
  }, [pos]);

  const stopWalking = React.useCallback(() => {
    if (walkInterval.current) { clearInterval(walkInterval.current); walkInterval.current = null; }
    setSpriteState('idle');
  }, []);

  const scheduleWander = React.useCallback(() => {
    if (wanderTimer.current) clearTimeout(wanderTimer.current);
    wanderTimer.current = setTimeout(() => {
      if (!wanderRef.current || isBusyRef.current) return;
      if (Math.random() < 0.3) { scheduleWander(); return; }

      const el = floatRef.current;
      const parent = el?.parentElement;
      if (!parent) { scheduleWander(); return; }

      const petH = el.clientHeight || PET_WIDTH;
      const maxRight = Math.max(0, parent.clientWidth - PET_WIDTH);
      const maxBottom = Math.max(0, parent.clientHeight - petH);
      const cur = posRef.current;

      let targetRight = Math.random() * maxRight;
      const targetBottom = Math.max(0, Math.min(maxBottom, cur.bottom + (Math.random() - 0.5) * 100));
      if (Math.abs(targetRight - cur.right) < 60 && Math.abs(targetBottom - cur.bottom) < 30) {
        targetRight = maxRight - cur.right;
      }
      const target = { right: targetRight, bottom: targetBottom };
      const dir = target.right < cur.right ? 'runR' : 'runL';
      setSpriteState(dir);

      walkInterval.current = setInterval(() => {
        if (!wanderRef.current || isBusyRef.current) {
          if (walkInterval.current) { clearInterval(walkInterval.current); walkInterval.current = null; }
          setSpriteState('idle');
          return;
        }
        const c = posRef.current;
        const dx = target.right - c.right;
        const dy = target.bottom - c.bottom;
        const dist = Math.hypot(dx, dy);
        if (dist <= PET_WALK_SPEED) {
          setPosTracked(target);
          if (walkInterval.current) { clearInterval(walkInterval.current); walkInterval.current = null; }
          setSpriteState('idle');
          scheduleWander();
          return;
        }
        const ratio = PET_WALK_SPEED / dist;
        setPosTracked({ right: c.right + dx * ratio, bottom: c.bottom + dy * ratio });
      }, PET_WALK_TICK_MS);
    }, 5000 + Math.random() * 10000);
  }, [setPosTracked]);

  // Start wander on mount
  React.useEffect(() => {
    scheduleWander();
    return () => {
      if (wanderTimer.current) clearTimeout(wanderTimer.current);
      if (walkInterval.current) clearInterval(walkInterval.current);
    };
  }, []);

  // React to isBusy changes
  React.useEffect(() => {
    if (isBusy) {
      if (postBusyTimer.current) { clearTimeout(postBusyTimer.current); postBusyTimer.current = null; }
      if (wanderTimer.current) { clearTimeout(wanderTimer.current); wanderTimer.current = null; }
      if (walkInterval.current) { clearInterval(walkInterval.current); walkInterval.current = null; }
      isBusyRef.current = true;
      setSpriteState('running');
    } else if (isBusyRef.current) {
      isBusyRef.current = false;
      setSpriteState('waving');
      postBusyTimer.current = setTimeout(() => {
        postBusyTimer.current = null;
        setSpriteState('idle');
        scheduleWander();
      }, 1200);
    }
  }, [isBusy, scheduleWander]);

  const showMessage = React.useCallback((text) => {
    if (msgTimer.current) clearTimeout(msgTimer.current);
    setMessage(text);
    msgTimer.current = setTimeout(() => setMessage(null), 2500);
  }, []);

  const triggerJump = React.useCallback(() => {
    if (jumping) return;
    setJumping(true);
    if (jumpTimer.current) clearTimeout(jumpTimer.current);
    jumpTimer.current = setTimeout(() => setJumping(false), 500);
  }, [jumping]);

  const handleMouseDown = React.useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    stopWalking();
    if (wanderTimer.current) { clearTimeout(wanderTimer.current); wanderTimer.current = null; }
    if (postBusyTimer.current) { clearTimeout(postBusyTimer.current); postBusyTimer.current = null; }

    dragState.current = {
      startMouseX: e.clientX, startMouseY: e.clientY,
      startBottom: posRef.current.bottom, startRight: posRef.current.right,
      moved: false, downTime: Date.now(),
    };

    const onMove = (ev) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startMouseX;
      const dy = ev.clientY - dragState.current.startMouseY;
      if (Math.hypot(dx, dy) > 4) dragState.current.moved = true;
      const el = floatRef.current;
      const parent = el?.parentElement;
      const petH = el?.clientHeight ?? PET_WIDTH;
      const maxRight = parent ? Math.max(0, parent.clientWidth - PET_WIDTH) : 9999;
      const maxBottom = parent ? Math.max(0, parent.clientHeight - petH) : 9999;
      setPosTracked({
        bottom: Math.max(0, Math.min(maxBottom, dragState.current.startBottom - dy)),
        right:  Math.max(0, Math.min(maxRight,  dragState.current.startRight  - dx)),
      });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!dragState.current) return;
      const wasClick = !dragState.current.moved && Date.now() - dragState.current.downTime < 300;
      dragState.current = null;
      if (wasClick) {
        triggerJump();
        showMessage(PET_CLICK_MESSAGES[Math.floor(Math.random() * PET_CLICK_MESSAGES.length)]);
      }
      if (!isBusyRef.current && wanderRef.current) scheduleWander();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [stopWalking, scheduleWander, setPosTracked, triggerJump, showMessage]);

  if (!spritesheetUrl) return null;

  return (
    <div
      ref={floatRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        bottom: pos.bottom,
        right: pos.right,
        zIndex: 40,
        userSelect: 'none',
        cursor: 'grab',
      }}
    >
      {message && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 6,
          background: 'var(--ui-bg-3)',
          border: '1px solid var(--ui-border)',
          color: 'var(--ui-text)',
          padding: '3px 9px',
          borderRadius: 10,
          fontSize: 11,
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          pointerEvents: 'none',
        }}>
          {message}
        </div>
      )}
      <CodexSprite
        spritesheetUrl={spritesheetUrl}
        state={spriteState}
        jumping={jumping}
        displayWidth={PET_WIDTH}
      />
    </div>
  );
}

// ── PetdexGallery ─────────────────────────────────────────────────────────────

const PETDEX_PAGE_SIZE = 24;

const KIND_STYLE = {
  character: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  creature:  { color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  object:    { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
};

// Shows the first idle frame of a spritesheet as a thumbnail (8×9 grid, row 0 col 0)
function PetThumb({ url, size = 32 }) {
  const [loaded, setLoaded] = React.useState(false);
  // frame 0, row 0 of 8×9 grid — scale so 1 frame fills `size`
  // naturalWidth / 8 = frameW; display at `size` px → scale = size / frameW
  // We use a fixed clip container and scale the img inside
  return (
    <div style={{
      width: size, height: size,
      overflow: 'hidden',
      position: 'relative',
      background: 'var(--ui-bg-4)',
      borderRadius: 4,
      flexShrink: 0,
    }}>
      <img
        src={url}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          // scale so that 1/8 of the image width = `size` px → scale = 8
          transform: `scale(8) translate(0, 0)`,
          transformOrigin: '0 0',
          imageRendering: 'auto',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.15s',
        }}
      />
    </div>
  );
}

function PetdexGallery({ activePetUrl, onSelect, onClear }) {
  const [pets, setPets] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [preview, setPreview] = React.useState(null);

  React.useEffect(() => {
    if (!window.openslides?.fetchPetManifest) return;
    setLoading(true);
    window.openslides.fetchPetManifest().then((result) => {
      setLoading(false);
      if (result.error) { setError(result.error); return; }
      const data = result.data;
      setPets(data.pets ?? []);
    }).catch(err => { setLoading(false); setError(err.message); });
  }, []);

  const allFiltered = pets.filter(p =>
    search === '' ||
    p.displayName.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(allFiltered.length / PETDEX_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagePets = allFiltered.slice(safePage * PETDEX_PAGE_SIZE, (safePage + 1) * PETDEX_PAGE_SIZE);

  const inputCls = 'w-full ui-bg-4 border ui-border rounded-lg px-3 py-2 text-sm ui-text ui-text-4 transition-all';

  return (
    <div>
      {/* Active pet banner */}
      {activePetUrl && (
        <div className="flex items-center justify-between rounded-lg border ui-border px-3 py-2 mb-3"
          style={{borderWidth:1,borderStyle:'solid',background:'rgba(var(--ui-primary-rgb,99,102,241),0.06)'}}>
          <div className="flex items-center gap-2">
            <PetThumb url={activePetUrl} size={32} />
            <span className="text-xs font-medium ui-text">{t('petGalleryActive')}</span>
          </div>
          <button
            onClick={onClear}
            className="text-xs ui-text-3 hover:ui-text transition-colors px-2 py-1 rounded hover:ui-bg-5"
          >
            {t('petGalleryRemove')}
          </button>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0); }}
        placeholder={t('petGallerySearch')}
        className={inputCls}
        style={{outline:'none', marginBottom: 8}}
        onFocus={e => e.target.style.boxShadow='0 0 0 2px var(--ui-primary)'}
        onBlur={e => e.target.style.boxShadow=''}
      />

      {/* States */}
      {loading && <p className="text-xs ui-text-3 text-center py-4">{t('petGalleryLoading')}</p>}
      {error && <p className="text-xs py-4 text-center" style={{color:'var(--ui-error,#f38ba8)'}}>{t('petGalleryError')}: {error}</p>}

      {!loading && !error && (
        <>
          {/* Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 6,
            maxHeight: 240,
            overflowY: 'auto',
            paddingRight: 2,
          }}>
            {pagePets.map(pet => {
              const isActive = activePetUrl === pet.spritesheetUrl;
              const ks = KIND_STYLE[pet.kind] || { color: '#888', bg: 'rgba(128,128,128,0.1)' };
              return (
                <button
                  key={pet.slug}
                  onClick={() => setPreview(pet)}
                  className="flex items-center gap-2 rounded-lg border transition-all text-left"
                  style={{
                    padding: '6px 8px',
                    borderWidth: 1, borderStyle: 'solid',
                    borderColor: isActive ? 'var(--ui-primary)' : 'var(--ui-border)',
                    background: isActive ? 'rgba(var(--ui-primary-rgb,99,102,241),0.08)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--ui-bg-5)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <PetThumb url={pet.spritesheetUrl} size={32} />
                  <div style={{minWidth:0, flex:1}}>
                    <p className="text-xs font-medium ui-text truncate">{pet.displayName}</p>
                    <span style={{
                      fontSize: 10, padding: '1px 5px', borderRadius: 99,
                      color: ks.color, background: ks.bg, fontWeight: 500,
                    }}>{pet.kind}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          {pets.length > 0 && (
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="rounded-lg border ui-border text-xs ui-text-3 hover:ui-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{padding:'4px 10px', borderWidth:1, borderStyle:'solid'}}
              >
                {t('petGalleryPrev')}
              </button>
              <span className="text-xs ui-text-3">
                {safePage + 1} / {totalPages} · {allFiltered.length} pets
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="rounded-lg border ui-border text-xs ui-text-3 hover:ui-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{padding:'4px 10px', borderWidth:1, borderStyle:'solid'}}
              >
                {t('petGalleryNext')}
              </button>
            </div>
          )}
        </>
      )}

      {/* Preview modal */}
      {preview && (
        <div
          style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}
          onClick={() => setPreview(null)}
        >
          <div
            className="ui-bg-3 border ui-border rounded-xl shadow-2xl p-5"
            style={{width:240, borderWidth:1, borderStyle:'solid'}}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <PetThumb url={preview.spritesheetUrl} size={64} />
              <div>
                <p className="text-sm font-semibold ui-text">{preview.displayName}</p>
                {(() => { const ks = KIND_STYLE[preview.kind] || {}; return (
                  <span style={{fontSize:10,padding:'1px 5px',borderRadius:99,color:ks.color,background:ks.bg,fontWeight:500}}>{preview.kind}</span>
                ); })()}
                {preview.submittedBy && (
                  <p className="text-xs ui-text-3 mt-1">by {preview.submittedBy}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { onSelect(preview.spritesheetUrl); setPreview(null); }}
                className="flex-1 rounded-lg text-xs font-medium text-white transition-colors"
                style={{padding:'7px 12px', background:'var(--ui-primary)'}}
                onMouseEnter={e => e.currentTarget.style.background='var(--ui-primary-h)'}
                onMouseLeave={e => e.currentTarget.style.background='var(--ui-primary)'}
              >
                {activePetUrl === preview.spritesheetUrl ? t('petGalleryAlready') : t('petGalleryUse')}
              </button>
              <button
                onClick={() => setPreview(null)}
                className="rounded-lg border ui-border text-xs ui-text-3 hover:ui-text transition-colors"
                style={{padding:'7px 12px', borderWidth:1, borderStyle:'solid'}}
              >
                {t('petGalleryCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
