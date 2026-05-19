// preview-panel.js — left pane: toolbar, slide viewport, thumbnail strip

const TRANSITIONS = ['none', 'slide', 'fade', 'zoom'];
const LAYOUTS = ['title', 'content', 'section', 'two-column', 'big-quote', 'blank'];
const ELEMENT_TYPES = ['kicker','heading','subheading','body','divider','bullets','pills','quote','stats','cards'];

let _slideIdCounter = Date.now();
function newSlideId() { return `slide-${++_slideIdCounter}`; }

function makeBlankSlide(background) {
  return {
    id: newSlideId(),
    layout: 'content',
    transition: 'slide',
    background: background || '#0f0f1a',
    elements: [
      { type: 'kicker', text: 'NEW SLIDE' },
      { type: 'heading', text: 'Slide Title', gradient: true },
      { type: 'divider' },
      { type: 'bullets', items: ['Point one', 'Point two'] },
    ],
  };
}

// ── Slide editor drawer ────────────────────────────────────────────────────────
function SlideEditor({ slide, onClose, onUpdate, onPreview, lang }) {
  const [draft, setDraft] = React.useState(() => JSON.parse(JSON.stringify(slide)));

  React.useEffect(() => {
    const fresh = JSON.parse(JSON.stringify(slide));
    setDraft(fresh);
    onPreview(fresh);
  }, [slide.id]);

  React.useEffect(() => {
    onPreview(draft);
  }, [draft]);

  const save = () => { onUpdate(draft); onClose(); };
  const cancel = () => { onPreview(slide); onClose(); };
  const update = (fn) => setDraft(d => fn(d));
  const setLayout = (layout) => update(d => ({ ...d, layout }));
  const setBg = (background) => update(d => ({ ...d, background }));

  const setEl = (i, patch) => update(d => ({
    ...d, elements: d.elements.map((e, idx) => idx === i ? { ...e, ...patch } : e),
  }));
  const delEl = (i) => update(d => ({ ...d, elements: d.elements.filter((_, idx) => idx !== i) }));
  const moveEl = (i, dir) => update(d => {
    const els = [...d.elements];
    const j = i + dir;
    if (j < 0 || j >= els.length) return d;
    [els[i], els[j]] = [els[j], els[i]];
    return { ...d, elements: els };
  });

  const addEl = (type) => {
    const defaults = {
      kicker:     { type: 'kicker', text: 'LABEL' },
      heading:    { type: 'heading', text: 'Title', gradient: true },
      subheading: { type: 'subheading', text: 'Subtitle' },
      body:       { type: 'body', text: 'Paragraph text.' },
      divider:    { type: 'divider' },
      bullets:    { type: 'bullets', items: ['Item one', 'Item two'] },
      pills:      { type: 'pills', items: ['Tag A', 'Tag B'] },
      quote:      { type: 'quote', text: 'Quote text.', author: 'Author' },
      stats:      { type: 'stats', items: [{ label: 'METRIC', value: '42', delta: '+10%' }] },
      cards:      { type: 'cards', cols: 3, items: [{ icon: '⭐', title: 'Card', body: 'Description' }] },
    };
    update(d => ({ ...d, elements: [...d.elements, defaults[type] || { type }] }));
  };

  const inputCls = 'w-full rounded-lg px-3 py-1.5 text-xs resize-none focus:outline-none';
  const inputStyle = { background:'var(--ui-bg)', border:'1px solid var(--ui-border)', color:'var(--ui-text-2)' };
  const labelCls = 'text-[10px] ui-text-4 uppercase tracking-wider mb-1';

  const renderElEditor = (el, i) => {
    const hasText = ['kicker','heading','subheading','body','quote'].includes(el.type);
    const hasList = ['bullets','pills'].includes(el.type);
    return (
      <div key={i} className="rounded-xl p-3 flex flex-col gap-2" style={{background:'var(--ui-bg-4)',border:'1px solid var(--ui-border)'}}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{color:'var(--ui-primary)',background:'rgba(208,64,0,0.12)'}}>{el.type}</span>
          <div className="flex-1" />
          <button onClick={() => moveEl(i, -1)} disabled={i === 0} className="w-5 h-5 flex items-center justify-center ui-text-4 hover:ui-text-2 disabled:opacity-30 text-xs">↑</button>
          <button onClick={() => moveEl(i, 1)} disabled={i === draft.elements.length - 1} className="w-5 h-5 flex items-center justify-center ui-text-4 hover:ui-text-2 disabled:opacity-30 text-xs">↓</button>
          <button onClick={() => delEl(i)} className="w-5 h-5 flex items-center justify-center ui-text-4 hover:text-[#f38ba8] text-xs">✕</button>
        </div>

        {hasText && (
          <textarea
            className={inputCls}
            style={inputStyle}
            rows={el.type === 'body' ? 3 : 1}
            value={el.text || ''}
            onChange={e => setEl(i, { text: e.target.value })}
            onFocus={e => e.target.style.borderColor='var(--ui-primary)'}
            onBlur={e => e.target.style.borderColor='var(--ui-border)'}
          />
        )}
        {el.type === 'quote' && (
          <input className={inputCls} style={inputStyle} value={el.author || ''} placeholder="Author"
            onChange={e => setEl(i, { author: e.target.value })}
            onFocus={e => e.target.style.borderColor='var(--ui-primary)'}
            onBlur={e => e.target.style.borderColor='var(--ui-border)'}
          />
        )}
        {el.type === 'heading' && (
          <label className="flex items-center gap-2 text-xs ui-text-3 cursor-pointer">
            <input type="checkbox" checked={!!el.gradient} onChange={e => setEl(i, { gradient: e.target.checked })} />
            Gradient
          </label>
        )}
        {hasList && (
          <div className="flex flex-col gap-1">
            {(el.items || []).map((item, j) => {
              const val = typeof item === 'string' ? item : item.text || '';
              return (
                <div key={j} className="flex gap-1">
                  <input className={inputCls + ' flex-1'} style={inputStyle} value={val}
                    onChange={e => {
                      const items = [...(el.items || [])];
                      items[j] = typeof item === 'string' ? e.target.value : { ...item, text: e.target.value };
                      setEl(i, { items });
                    }}
                    onFocus={e => e.target.style.borderColor='var(--ui-primary)'}
                    onBlur={e => e.target.style.borderColor='var(--ui-border)'}
                  />
                  <button onClick={() => setEl(i, { items: (el.items || []).filter((_, k) => k !== j) })}
                    className="w-6 h-6 flex items-center justify-center ui-text-4 hover:text-[#f38ba8] text-xs flex-shrink-0">✕</button>
                </div>
              );
            })}
            <button onClick={() => setEl(i, { items: [...(el.items || []), 'New item'] })}
              className="text-[10px] text-left mt-0.5" style={{color:'var(--ui-primary)'}}>+ Add item</button>
          </div>
        )}
        {el.type === 'stats' && (
          <div className="flex flex-col gap-1">
            {(el.items || []).map((item, j) => (
              <div key={j} className="flex gap-1">
                <input className={inputCls + ' flex-1'} style={inputStyle} value={item.value || ''} placeholder="Value"
                  onChange={e => { const items=[...el.items]; items[j]={...item,value:e.target.value}; setEl(i,{items}); }}
                  onFocus={e => e.target.style.borderColor='var(--ui-primary)'}
                  onBlur={e => e.target.style.borderColor='var(--ui-border)'}
                />
                <input className={inputCls + ' flex-1'} style={inputStyle} value={item.label || ''} placeholder="Label"
                  onChange={e => { const items=[...el.items]; items[j]={...item,label:e.target.value}; setEl(i,{items}); }}
                  onFocus={e => e.target.style.borderColor='var(--ui-primary)'}
                  onBlur={e => e.target.style.borderColor='var(--ui-border)'}
                />
                <input className={inputCls + ' w-16'} style={inputStyle} value={item.delta || ''} placeholder="±"
                  onChange={e => { const items=[...el.items]; items[j]={...item,delta:e.target.value}; setEl(i,{items}); }}
                  onFocus={e => e.target.style.borderColor='var(--ui-primary)'}
                  onBlur={e => e.target.style.borderColor='var(--ui-border)'}
                />
                <button onClick={() => setEl(i,{items:el.items.filter((_,k)=>k!==j)})}
                  className="w-6 h-6 flex items-center justify-center ui-text-4 hover:text-[#f38ba8] text-xs flex-shrink-0">✕</button>
              </div>
            ))}
            <button onClick={() => setEl(i,{items:[...(el.items||[]),{label:'METRIC',value:'0',delta:''}]})}
              className="text-[10px] text-left mt-0.5" style={{color:'var(--ui-primary)'}}>+ Add stat</button>
          </div>
        )}
        {el.type === 'cards' && (
          <div className="flex flex-col gap-1">
            {(el.items || []).map((item, j) => (
              <div key={j} className="flex gap-1 items-start">
                <input className={inputCls + ' w-10'} style={inputStyle} value={item.icon||''} placeholder="icon"
                  onChange={e => { const items=[...el.items]; items[j]={...item,icon:e.target.value}; setEl(i,{items}); }}
                  onFocus={e => e.target.style.borderColor='var(--ui-primary)'}
                  onBlur={e => e.target.style.borderColor='var(--ui-border)'}
                />
                <input className={inputCls + ' flex-1'} style={inputStyle} value={item.title||''} placeholder="Title"
                  onChange={e => { const items=[...el.items]; items[j]={...item,title:e.target.value}; setEl(i,{items}); }}
                  onFocus={e => e.target.style.borderColor='var(--ui-primary)'}
                  onBlur={e => e.target.style.borderColor='var(--ui-border)'}
                />
                <input className={inputCls + ' flex-1'} style={inputStyle} value={item.body||''} placeholder="Description"
                  onChange={e => { const items=[...el.items]; items[j]={...item,body:e.target.value}; setEl(i,{items}); }}
                  onFocus={e => e.target.style.borderColor='var(--ui-primary)'}
                  onBlur={e => e.target.style.borderColor='var(--ui-border)'}
                />
                <button onClick={() => setEl(i,{items:el.items.filter((_,k)=>k!==j)})}
                  className="w-6 h-6 flex items-center justify-center ui-text-4 hover:text-[#f38ba8] text-xs flex-shrink-0 mt-0.5">✕</button>
              </div>
            ))}
            <button onClick={() => setEl(i,{items:[...(el.items||[]),{icon:'⭐',title:'Card',body:'Description'}]})}
              className="text-[10px] text-left mt-0.5" style={{color:'var(--ui-primary)'}}>+ Add card</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full ui-bg-3" style={{borderLeft:'1px solid var(--ui-border)'}}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0" style={{borderBottom:'1px solid var(--ui-border)'}}>
        <span className="text-xs font-medium ui-text-2">{t('editSlidePanelTitle')}</span>
        <div className="flex-1" />
        <button onClick={save}
          className="px-3 py-1 rounded-lg text-xs font-medium text-white"
          style={{background:'var(--ui-primary)'}}
          onMouseEnter={e => e.currentTarget.style.background='var(--ui-primary-h)'}
          onMouseLeave={e => e.currentTarget.style.background='var(--ui-primary)'}
        >{t('apply')}</button>
        <button onClick={cancel} className="w-6 h-6 flex items-center justify-center ui-text-4 hover:ui-text text-sm">✕</button>
      </div>

      {draft.soloHtml ? (
        /* Solo slide: show raw HTML editor */
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0" style={{borderBottom:'1px solid var(--ui-border)'}}>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{background:'var(--ui-primary)',color:'#fff'}}>S</span>
            <span className="text-xs ui-text-3">{t('soloSlide')}</span>
          </div>
          <textarea
            value={draft.soloHtml}
            onChange={e => setDraft(d => ({ ...d, soloHtml: e.target.value }))}
            className="flex-1 w-full bg-transparent px-4 py-3 text-xs ui-text font-mono resize-none focus:outline-none"
            style={{caretColor:'var(--ui-primary)'}}
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Slide meta */}
        <div className="flex gap-3">
          <div className="flex-1">
            <div className={labelCls}>{t('layout')}</div>
            <select value={draft.layout || 'content'} onChange={e => setLayout(e.target.value)}
              className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none"
              style={{background:'var(--ui-bg)',border:'1px solid var(--ui-border)',color:'var(--ui-text-2)'}}>
              {LAYOUTS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <div className={labelCls}>{t('background')}</div>
            <div className="flex items-center gap-2">
              <input type="color" value={draft.background || '#0f0f1a'} onChange={e => setBg(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0" />
              <input className={inputCls + ' w-24'} style={inputStyle} value={draft.background || ''} placeholder="#0f0f1a"
                onChange={e => setBg(e.target.value)}
                onFocus={e => e.target.style.borderColor='var(--ui-primary)'}
                onBlur={e => e.target.style.borderColor='var(--ui-border)'}
              />
            </div>
          </div>
        </div>

        {/* Elements */}
        <div>
          <div className={labelCls}>{t('elements')}</div>
          <div className="flex flex-col gap-2">
            {draft.elements.map((el, i) => renderElEditor(el, i))}
          </div>
        </div>

        {/* Add element */}
        <div>
          <div className={labelCls}>{t('addElement')}</div>
          <div className="flex flex-wrap gap-1.5">
            {ELEMENT_TYPES.map(tp => (
              <button key={tp} onClick={() => addEl(tp)}
                className="text-[10px] px-2.5 py-1 rounded-full ui-bg-4 border ui-border ui-text-3 hover:ui-text-2 hover:ui-border-2 transition-colors"
                style={{borderWidth:1,borderStyle:'solid'}}>
                + {tp}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// ── Colour themes ──────────────────────────────────────────────────────────────
const THEMES = [
  { id: 'catppuccin', name: 'Catppuccin', bg: ['#0f0f1a', '#13131f'], color: '#cdd6f4', swatch: ['#0f0f1a', '#89b4fa', '#cba6f7'], themeVars: { accent:'#89b4fa', accent2:'#cba6f7', accent3:'#f38ba8', grad:'linear-gradient(135deg,#89b4fa,#cba6f7 55%,#f38ba8)', gradSoft:'linear-gradient(135deg,rgba(137,180,250,.15),rgba(203,166,247,.12) 55%,rgba(243,139,168,.1))', surface:'rgba(137,180,250,.08)', surface2:'rgba(203,166,247,.08)', border:'rgba(255,255,255,.08)' } },
  { id: 'midnight', name: 'Midnight', bg: ['#080c14', '#0c1020'], color: '#e2e8f8', swatch: ['#080c14', '#38bdf8', '#818cf8'], themeVars: { accent:'#38bdf8', accent2:'#818cf8', accent3:'#fb7185', grad:'linear-gradient(135deg,#38bdf8,#818cf8 55%,#fb7185)', gradSoft:'linear-gradient(135deg,rgba(56,189,248,.15),rgba(129,140,248,.12) 55%,rgba(251,113,133,.1))', surface:'rgba(56,189,248,.08)', surface2:'rgba(129,140,248,.08)', border:'rgba(255,255,255,.08)' } },
  { id: 'forest', name: 'Forest', bg: ['#0a120e', '#0d1912'], color: '#d4f0e0', swatch: ['#0a120e', '#4ade80', '#34d399'], themeVars: { accent:'#4ade80', accent2:'#34d399', accent3:'#a3e635', grad:'linear-gradient(135deg,#4ade80,#34d399 55%,#a3e635)', gradSoft:'linear-gradient(135deg,rgba(74,222,128,.15),rgba(52,211,153,.12) 55%,rgba(163,230,53,.1))', surface:'rgba(74,222,128,.08)', surface2:'rgba(52,211,153,.08)', border:'rgba(255,255,255,.07)' } },
  { id: 'ember', name: 'Ember', bg: ['#150a06', '#1c0f08'], color: '#fde8d8', swatch: ['#150a06', '#fb923c', '#f43f5e'], themeVars: { accent:'#fb923c', accent2:'#f43f5e', accent3:'#fbbf24', grad:'linear-gradient(135deg,#fb923c,#f43f5e 55%,#fbbf24)', gradSoft:'linear-gradient(135deg,rgba(251,146,60,.15),rgba(244,63,94,.12) 55%,rgba(251,191,36,.1))', surface:'rgba(251,146,60,.08)', surface2:'rgba(244,63,94,.08)', border:'rgba(255,255,255,.07)' } },
  { id: 'rose', name: 'Rose Gold', bg: ['#140d10', '#1c1118'], color: '#fce7f3', swatch: ['#140d10', '#f472b6', '#e879f9'], themeVars: { accent:'#f472b6', accent2:'#e879f9', accent3:'#fb7185', grad:'linear-gradient(135deg,#f472b6,#e879f9 55%,#fb7185)', gradSoft:'linear-gradient(135deg,rgba(244,114,182,.15),rgba(232,121,249,.12) 55%,rgba(251,113,133,.1))', surface:'rgba(244,114,182,.08)', surface2:'rgba(232,121,249,.08)', border:'rgba(255,255,255,.07)' } },
  { id: 'slate', name: 'Slate', bg: ['#0f1117', '#141720'], color: '#e2e8f0', swatch: ['#0f1117', '#94a3b8', '#64748b'], themeVars: { accent:'#94a3b8', accent2:'#cbd5e1', accent3:'#7dd3fc', grad:'linear-gradient(135deg,#94a3b8,#cbd5e1 55%,#7dd3fc)', gradSoft:'linear-gradient(135deg,rgba(148,163,184,.15),rgba(203,213,225,.12) 55%,rgba(125,211,252,.1))', surface:'rgba(148,163,184,.08)', surface2:'rgba(203,213,225,.08)', border:'rgba(255,255,255,.07)' } },
  { id: 'light', name: 'Light', bg: ['#f8f9fc', '#f0f2f8'], color: '#111827', swatch: ['#f8f9fc', '#6366f1', '#ec4899'], themeVars: { accent:'#6366f1', accent2:'#8b5cf6', accent3:'#ec4899', grad:'linear-gradient(135deg,#6366f1,#8b5cf6 55%,#ec4899)', gradSoft:'linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.1) 55%,rgba(236,72,153,.08))', surface:'rgba(99,102,241,.08)', surface2:'rgba(139,92,246,.06)', border:'rgba(0,0,0,.08)', text1:'#111827', text2:'#374151', text3:'#6b7280' } },
  { id: 'corporate', name: 'Corporate', bg: ['#f5f7fa', '#eef1f7'], color: '#0f172a', swatch: ['#f5f7fa', '#2563eb', '#0ea5e9'], themeVars: { accent:'#2563eb', accent2:'#0ea5e9', accent3:'#6366f1', grad:'linear-gradient(135deg,#2563eb,#0ea5e9 55%,#6366f1)', gradSoft:'linear-gradient(135deg,rgba(37,99,235,.12),rgba(14,165,233,.1) 55%,rgba(99,102,241,.08))', surface:'rgba(37,99,235,.06)', surface2:'rgba(14,165,233,.05)', border:'rgba(0,0,0,.07)', text1:'#0f172a', text2:'#1e3a5f', text3:'#475569' } },
];

function ThemeSwatch({ theme, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={theme.name}
      className={`relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${active ? 'ui-bg-5' : 'hover:ui-bg-5'}`}
      style={active ? {outline:'1px solid var(--ui-primary)',outlineOffset:'-1px'} : {}}
    >
      <div className="w-12 h-8 rounded-md overflow-hidden flex-shrink-0" style={{ background: theme.swatch[0] }}>
        <div className="w-full h-full flex">
          <div className="flex-1" style={{ background: theme.swatch[0] }} />
          <div className="w-3" style={{ background: theme.swatch[1] }} />
          <div className="w-2" style={{ background: theme.swatch[2] }} />
        </div>
      </div>
      <span className="text-[9px] ui-text-3 leading-none whitespace-nowrap">{theme.name}</span>
    </button>
  );
}

function ThumbnailSlide({ slide }) {
  return (
    <div style={{ background: slide.background || '#1e1e2e', color: slide.color || '#cdd6f4', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '4px', overflow: 'hidden' }}>
      {(slide.elements || []).slice(0, 3).map((el, i) => (
        <div key={i} style={{ fontSize: el.type === 'heading' ? '6px' : '4px', fontWeight: el.type === 'heading' ? 700 : 400, opacity: 0.9, textAlign: 'center', lineHeight: 1.3, overflow: 'hidden', maxWidth: '100%', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {el.type === 'bullets' ? (el.items || []).slice(0, 2).join(' · ') : el.text}
        </div>
      ))}
    </div>
  );
}

function ThumbnailStrip({ slides, currentIndex, onGoTo, onReorder, onAdd, onDuplicate, onDelete }) {
  const dragFrom = React.useRef(null);
  const [dragOver, setDragOver] = React.useState(null);
  const [ctxMenu, setCtxMenu] = React.useState(null);
  const ctxRef = React.useRef(null);

  const handleDragStart = (e, i) => { dragFrom.current = i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setDragImage(e.currentTarget, 48, 32); };
  const handleDragOver = (e, i) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOver !== i) setDragOver(i); };
  const handleDrop = (e, i) => { e.preventDefault(); const from = dragFrom.current; setDragOver(null); dragFrom.current = null; if (from != null && from !== i) onReorder(from, i); };
  const handleDragEnd = () => { setDragOver(null); dragFrom.current = null; };
  const handleContextMenu = (e, i) => { e.preventDefault(); setCtxMenu({ index: i, x: e.clientX, y: e.clientY }); };

  React.useLayoutEffect(() => {
    if (!ctxMenu || !ctxRef.current) return;
    const rect = ctxRef.current.getBoundingClientRect();
    let { x, y } = ctxMenu;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    if (x + rect.width  > window.innerWidth  - 8) x = window.innerWidth  - rect.width  - 8;
    if (x !== ctxMenu.x || y !== ctxMenu.y) setCtxMenu((m) => ({ ...m, x, y }));
  }, [ctxMenu?.index, ctxMenu?.x, ctxMenu?.y]);

  React.useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e) => { if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ctxMenu]);

  return (
    <div className="flex items-end gap-2 px-4 pb-3 overflow-x-auto flex-shrink-0 pt-3" style={{borderTop:'1px solid var(--ui-border)'}}>
      {slides.map((slide, i) => (
        <div key={slide.id || i} draggable onDragStart={(e) => handleDragStart(e, i)} onDragOver={(e) => handleDragOver(e, i)} onDrop={(e) => handleDrop(e, i)} onDragEnd={handleDragEnd} onContextMenu={(e) => handleContextMenu(e, i)}
          style={{ outline: dragOver === i && dragFrom.current !== i ? '2px solid var(--ui-primary)' : 'none', borderRadius: '6px', transition: 'outline 0.1s' }}>
          <button onClick={() => onGoTo(i)} className={`slide-thumb w-24 flex-shrink-0 no-drag ${i === currentIndex ? 'active' : ''}`}
            title={`Slide ${i + 1} — right-click for options`} style={{position:'relative'}}>
            <ThumbnailSlide slide={slide} />
            {slide.soloHtml && (
              <div style={{position:'absolute',top:3,right:3,background:'var(--ui-primary)',color:'#fff',
                fontSize:'7px',fontWeight:'bold',padding:'1px 3px',borderRadius:'2px',lineHeight:'1.4',pointerEvents:'none'}}>S</div>
            )}
          </button>
          <div className="text-center text-[10px] ui-text-4 mt-0.5 select-none">{i + 1}</div>
        </div>
      ))}

      <button onClick={() => onAdd(slides.length - 1)} title={t('newSlide')}
        className="w-24 flex-shrink-0 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed ui-border ui-text-4 transition-all"
        style={{ aspectRatio: '16/9', borderColor:'var(--ui-border)' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor='var(--ui-primary)'; e.currentTarget.style.color='var(--ui-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor='var(--ui-border)'; e.currentTarget.style.color='var(--ui-text-4)'; }}>
        <span className="text-lg leading-none">+</span>
      </button>

      {ctxMenu && (
        <div ref={ctxRef} className="fixed z-50 ui-bg-4 rounded-xl shadow-2xl py-1 overflow-hidden" style={{ left: ctxMenu.x, top: ctxMenu.y, minWidth: 160, border:'1px solid var(--ui-border)' }}>
          {[
            { label: t('newSlideAfter'), action: () => { onAdd(ctxMenu.index); setCtxMenu(null); } },
            { label: t('duplicate'),    action: () => { onDuplicate(ctxMenu.index); setCtxMenu(null); } },
            { label: t('delete'),       action: () => { onDelete(ctxMenu.index); setCtxMenu(null); }, danger: true },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              className={`block w-full text-left px-4 py-2 text-sm transition-colors ${item.danger ? 'text-[#f38ba8]' : 'ui-text-2'}`}
              onMouseEnter={e => e.currentTarget.style.background = item.danger ? 'rgba(243,139,168,0.1)' : 'var(--ui-bg-5)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const send = () => { iframe.contentWindow?.postMessage({ type: 'render', slide, direction }, '*'); };
    if (iframe.contentDocument?.readyState === 'complete') send();
    else iframe.onload = send;
  }, [slide, direction]);

  React.useEffect(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
    return () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); };
  }, []);

  React.useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) onClose(); };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [onClose]);

  React.useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault(); if (canNext) { setDirection('forward'); setIndex((i) => i + 1); }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault(); if (canPrev) { setDirection('backward'); setIndex((i) => i - 1); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canNext, canPrev, onClose]);

  const resetHideTimer = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  };
  React.useEffect(() => { resetHideTimer(); return () => clearTimeout(hideTimer.current); }, []);

  const goTo = (i) => { setDirection(i > index ? 'forward' : 'backward'); setIndex(i); };

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black flex flex-col" onMouseMove={resetHideTimer} onClick={resetHideTimer}>
      <div className="flex-1 relative">
        <iframe ref={iframeRef} src="slide-frame/slide-frame.html" className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin" title="Fullscreen Slide" />
        <div className="absolute left-0 top-0 bottom-0 w-1/5 cursor-pointer" onClick={() => { if (canPrev) { setDirection('backward'); setIndex((i) => i - 1); } }} />
        <div className="absolute right-0 top-0 bottom-0 w-1/5 cursor-pointer" onClick={() => { if (canNext) { setDirection('forward'); setIndex((i) => i + 1); } }} />
      </div>
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 pointer-events-auto" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
          <span className="text-white text-sm font-medium opacity-80">
            {(slide?.elements || []).find((e) => e.type === 'heading')?.text || `Slide ${index + 1}`}
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-sm" title={t('exitPresent')}>
            ✕
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 pointer-events-auto" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)' }}>
          <div className="flex gap-1 px-6 pb-1 pt-3">
            {slides.map((_, i) => (
              <button key={i} onClick={() => goTo(i)} className={`h-1 flex-1 rounded-full transition-all duration-200 ${i === index ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 px-6 pb-5 pt-2">
            <button onClick={() => { if (canPrev) { setDirection('backward'); setIndex((i) => i - 1); } }} disabled={!canPrev}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all ${canPrev ? 'bg-white/10 hover:bg-white/20 text-white' : 'text-white/20 cursor-not-allowed'}`}>‹</button>
            <span className="text-white/70 text-sm font-mono min-w-[56px] text-center">{index + 1} / {slides.length}</span>
            <button onClick={() => { if (canNext) { setDirection('forward'); setIndex((i) => i + 1); } }} disabled={!canNext}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all ${canNext ? 'bg-white/10 hover:bg-white/20 text-white' : 'text-white/20 cursor-not-allowed'}`}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const IMAGE_LAYOUTS = [
  { id: 'single', label: 'Single', count: 1, icon: '▣', preview: [{ x: 10, y: 10, w: 80, h: 80 }], build: (urls) => ({ type: 'image', src: urls[0], alt: '', align: 'center', objectFit: 'contain' }) },
  { id: 'two-col', label: '2 Side by Side', count: 2, icon: '▣▣', preview: [{ x: 5, y: 10, w: 40, h: 80 }, { x: 55, y: 10, w: 40, h: 80 }], build: (urls) => ({ type: 'images', cols: 2, gap: 12, objectFit: 'cover', radius: 10, items: urls.map((src) => ({ src, alt: '' })) }) },
  { id: 'three-col', label: '3 Column', count: 3, icon: '▣▣▣', preview: [{ x: 3, y: 10, w: 28, h: 80 }, { x: 36, y: 10, w: 28, h: 80 }, { x: 69, y: 10, w: 28, h: 80 }], build: (urls) => ({ type: 'images', cols: 3, gap: 10, objectFit: 'cover', radius: 8, items: urls.map((src) => ({ src, alt: '' })) }) },
  { id: 'hero-thumb', label: 'Hero + Thumbs', count: 3, icon: '▣+▣▣', preview: [{ x: 5, y: 10, w: 55, h: 80 }, { x: 65, y: 10, w: 30, h: 37 }, { x: 65, y: 53, w: 30, h: 37 }], build: (urls) => ({ type: 'images', cols: 2, gap: 10, objectFit: 'cover', radius: 10, items: [{ src: urls[0], alt: '', style: 'grid-row: span 2' }, { src: urls[1], alt: '' }, { src: urls[2], alt: '' }], gridTemplate: '"a b" "a c"' }) },
  { id: 'two-plus-one', label: 'Wide + 2 Stack', count: 3, icon: '▬+▣▣', preview: [{ x: 5, y: 10, w: 90, h: 45 }, { x: 5, y: 58, w: 42, h: 32 }, { x: 53, y: 58, w: 42, h: 32 }], build: (urls) => ({ type: 'images', cols: 2, gap: 10, objectFit: 'cover', radius: 10, gridTemplate: '"a a" "b c"', items: urls.map((src) => ({ src, alt: '' })) }) },
  { id: 'mosaic', label: 'Mosaic 4', count: 4, icon: '⊞', preview: [{ x: 5, y: 10, w: 42, h: 37 }, { x: 53, y: 10, w: 42, h: 37 }, { x: 5, y: 52, w: 42, h: 37 }, { x: 53, y: 52, w: 42, h: 37 }], build: (urls) => ({ type: 'images', cols: 2, gap: 8, objectFit: 'cover', radius: 10, items: urls.map((src) => ({ src, alt: '' })) }) },
  { id: 'strip', label: 'Horizontal Strip', count: 4, icon: '▬▬▬▬', preview: [{ x: 3, y: 25, w: 21, h: 50 }, { x: 27, y: 25, w: 21, h: 50 }, { x: 51, y: 25, w: 21, h: 50 }, { x: 75, y: 25, w: 21, h: 50 }], build: (urls) => ({ type: 'images', cols: 4, gap: 8, height: 220, objectFit: 'cover', radius: 8, items: urls.map((src) => ({ src, alt: '' })) }) },
];

function LayoutPreview({ rects }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: 72, height: 72 }}>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="4" fill="rgba(208,64,0,0.2)" stroke="rgba(208,64,0,0.6)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

function ImageTray({ slide, onApplyAction }) {
  const images = (slide?.elements || []).map((el, idx) => ({ el, idx })).filter(({ el }) => el.type === 'image' || el.type === 'images');
  if (!images.length) return null;

  const handleRemove = (elIndex) => {
    const elements = (slide.elements || []).filter((_, i) => i !== elIndex);
    onApplyAction({ action: 'update_slide', slideId: slide.id, slide: { ...slide, elements } });
  };
  const thumbSrc = (el) => el.type === 'image' ? el.src : el.items?.[0]?.src || '';
  const thumbLabel = (el) => el.type === 'image' ? '1 image' : `${(el.items||[]).length} images`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto flex-shrink-0" style={{borderTop:'1px solid var(--ui-border)'}}>
      <span className="text-[10px] ui-text-4 uppercase tracking-wider flex-shrink-0">Images</span>
      {images.map(({ el, idx }) => (
        <div key={idx} className="relative flex-shrink-0 group">
          <div className="h-12 w-20 rounded-md overflow-hidden flex items-center justify-center" style={{border:'1px solid var(--ui-border)',background:'var(--ui-bg-4)'}}>
            <img src={thumbSrc(el)} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="text-[9px] ui-text-4 text-center mt-0.5">{thumbLabel(el)}</div>
          <button onClick={() => handleRemove(idx)} title="Remove"
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#f38ba8] text-black text-[9px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ── PreviewPanel ──────────────────────────────────────────────────────────────
function PreviewPanel({ slides, currentIndex, currentSlide, direction, onNext, onPrev, onGoTo, onReorder, onApplyAction, onSave, onElementSelected, canUndo, canRedo, onUndo, onRedo, showEditor, onOpenEditor, onCloseEditor, onRegisterPreview, lang }) {
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

  const handleAddSlide = React.useCallback((afterIndex) => {
    const bg = currentSlide?.background || '#0f0f1a';
    const newSlide = makeBlankSlide(bg);
    if (currentSlide?.themeVars) newSlide.themeVars = currentSlide.themeVars;
    if (currentSlide?.color) newSlide.color = currentSlide.color;
    onApplyAction({ action: 'add_slides', slides: [newSlide], afterIndex });
  }, [currentSlide, onApplyAction]);

  const handleDuplicateSlide = React.useCallback((index) => {
    const src = slides[index];
    const copy = { ...JSON.parse(JSON.stringify(src)), id: newSlideId() };
    onApplyAction({ action: 'add_slides', slides: [copy], afterIndex: index });
  }, [slides, onApplyAction]);

  const handleDeleteSlide = React.useCallback((index) => {
    if (slides.length <= 1) return;
    onApplyAction({ action: 'delete_slide', slideId: slides[index].id });
  }, [slides, onApplyAction]);

  const handlePreviewSlide = React.useCallback((previewSlide) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.contentWindow?.postMessage({ type: 'render', slide: previewSlide, direction: 'none' }, '*');
  }, []);

  React.useEffect(() => {
    onRegisterPreview?.(handlePreviewSlide);
  }, [handlePreviewSlide, onRegisterPreview]);

  const applyTheme = React.useCallback((theme) => {
    setActiveThemeId(theme.id);
    setShowThemes(false);
    const newSlides = slides.map((s, i) => ({ ...s, background: theme.bg[i % theme.bg.length], color: theme.color, themeVars: theme.themeVars }));
    onApplyAction({ action: 'replace_all', slides: newSlides });
  }, [slides, onApplyAction]);

  React.useEffect(() => {
    if (!showThemes) return;
    const handler = (e) => { if (themePickerRef.current && !themePickerRef.current.contains(e.target)) setShowThemes(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showThemes]);

  React.useEffect(() => {
    const el = viewportContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const pad = 48;
      const availW = width - pad, availH = height - pad;
      const byWidth = { w: availW, h: availW * 9 / 16 };
      const byHeight = { w: availH * 16 / 9, h: availH };
      const fit = byHeight.w <= availW ? byHeight : byWidth;
      setViewportSize({ width: Math.round(fit.w), height: Math.round(fit.h) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  React.useEffect(() => {
    if (!showImagePicker) return;
    const handler = (e) => { if (imagePickerRef.current && !imagePickerRef.current.contains(e.target)) setShowImagePicker(false); };
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
    if (iframe.contentDocument?.readyState === 'complete') send();
    else iframe.onload = () => { if (!cancelled) send(); };
    return () => { cancelled = true; };
  }, [currentSlide]);

  React.useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'element-selected') onElementSelected(e.data.element ?? null, e.data.elementIndex ?? null);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onElementSelected]);

  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'F5') { e.preventDefault(); setFullscreen(true); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < slides.length - 1;

  // Shared toolbar button style helpers
  const toolBtn = (active) => active
    ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all text-white ui-primary'
    : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ui-text-3 hover:ui-text hover:ui-bg-5 ui-border';

  return (
    <div className="flex flex-col h-full ui-bg select-none">
      {fullscreen && <FullscreenPresenter slides={slides} startIndex={currentIndex} onClose={() => setFullscreen(false)} />}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 no-drag flex-shrink-0" style={{borderBottom:'1px solid var(--ui-border)'}}>
        <button onClick={onPrev} disabled={!canPrev} title={t('prevSlide')}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-sm ${canPrev ? 'ui-text-2 hover:ui-bg-5' : 'ui-text-4 cursor-not-allowed'}`}>
          ‹
        </button>

        <span className="text-xs ui-text-3 min-w-[52px] text-center font-mono">
          {currentIndex + 1} / {slides.length}
        </span>

        <button onClick={onNext} disabled={!canNext} title={t('nextSlide')}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-sm ${canNext ? 'ui-text-2 hover:ui-bg-5' : 'ui-text-4 cursor-not-allowed'}`}>
          ›
        </button>

        <div className="w-px h-5 mx-1" style={{background:'var(--ui-border)'}} />

        <span className="text-sm ui-text-2 flex-1 truncate">
          {(currentSlide?.elements || []).find((e) => e.type === 'heading')?.text || `Slide ${currentIndex + 1}`}
        </span>

        {/* Insert image */}
        <div className="relative" ref={imagePickerRef}>
          <button onClick={() => setShowImagePicker((v) => !v)} disabled={uploadingImage}
            title={t('insertImage')} className={toolBtn(showImagePicker)} style={{borderWidth:1,borderStyle:'solid',
              ...(showImagePicker ? {background:'var(--ui-primary)',borderColor:'var(--ui-primary)',color:'#fff'} : {borderColor:'var(--ui-border)'})}}>
            {uploadingImage ? '…' : t('image')}
          </button>
          {showImagePicker && (
            <div className="absolute left-0 top-full mt-1 z-20 rounded-xl shadow-2xl p-3" style={{ width: 340, background:'var(--ui-bg-4)', border:'1px solid var(--ui-border)' }}>
              <div className="text-[10px] ui-text-4 uppercase tracking-wider mb-2 px-1">{t('chooseLayout')}</div>
              <div className="grid grid-cols-3 gap-2">
                {IMAGE_LAYOUTS.map((layout) => (
                  <button key={layout.id} onClick={() => handleInsertLayout(layout)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:ui-bg-5 transition-colors group">
                    <LayoutPreview rects={layout.preview} />
                    <span className="text-[10px] ui-text-3 group-hover:ui-text-2 transition-colors text-center leading-tight">{layout.label}</span>
                    <span className="text-[9px] ui-text-4">{layout.count} photo{layout.count > 1 ? 's' : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme picker */}
        <div ref={themePickerRef} className="relative">
          <button onClick={() => { setShowThemes((v) => !v); setShowTransitions(false); }}
            title={t('colorTheme')}
            className={toolBtn(showThemes)}
            style={{borderWidth:1,borderStyle:'solid',
              ...(showThemes ? {background:'var(--ui-primary)',borderColor:'var(--ui-primary)',color:'#fff'} : {borderColor:'var(--ui-border)'})}}>
            <span className="flex gap-0.5">
              {(THEMES.find(th => th.id === activeThemeId) || THEMES[0]).swatch.map((c, i) => (
                <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
              ))}
            </span>
            {t('theme')}
          </button>
          {showThemes && (
            <div className="absolute left-0 top-full mt-1 rounded-xl shadow-2xl z-20 p-2" style={{ width: 300, background:'var(--ui-bg-4)', border:'1px solid var(--ui-border)' }}>
              <div className="text-[10px] ui-text-4 uppercase tracking-wider mb-2 px-1">{t('colorTheme')}</div>
              <div className="grid grid-cols-4 gap-1">
                {THEMES.map((theme) => (
                  <ThemeSwatch key={theme.id} theme={theme} active={activeThemeId === theme.id} onClick={() => applyTheme(theme)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Transition picker */}
        <div className="relative">
          <button onClick={() => { setShowTransitions((v) => !v); setShowThemes(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ui-text-3 hover:ui-text hover:ui-bg-5 transition-all"
            style={{border:'1px solid var(--ui-border)'}}>
            ✦ {selectedTransition}
          </button>
          {showTransitions && (
            <div className="absolute right-0 top-full mt-1 rounded-lg shadow-xl z-10 overflow-hidden" style={{background:'var(--ui-bg-4)',border:'1px solid var(--ui-border)'}}>
              {TRANSITIONS.map((tr) => (
                <button key={tr} onClick={() => { setSelectedTransition(tr); setShowTransitions(false); }}
                  className={`block w-full text-left px-4 py-2 text-sm transition-colors ${tr === selectedTransition ? 'ui-primary text-white' : 'ui-text-2'}`}
                  style={tr === selectedTransition ? {background:'var(--ui-primary)',color:'#fff'} : {}}
                  onMouseEnter={e => { if (tr !== selectedTransition) e.currentTarget.style.background='var(--ui-bg-5)'; }}
                  onMouseLeave={e => { if (tr !== selectedTransition) e.currentTarget.style.background=''; }}>
                  {tr}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Edit slide */}
        <button onClick={() => showEditor ? onCloseEditor() : onOpenEditor()} title={t('editSlide')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all"
          style={showEditor
            ? {background:'var(--ui-primary)',borderColor:'var(--ui-primary)',color:'#fff',borderWidth:1,borderStyle:'solid'}
            : {borderColor:'var(--ui-border)',color:'var(--ui-text-3)',borderWidth:1,borderStyle:'solid'}}
          onMouseEnter={e => { if (!showEditor) { e.currentTarget.style.color='var(--ui-text)'; e.currentTarget.style.background='var(--ui-bg-5)'; }}}
          onMouseLeave={e => { if (!showEditor) { e.currentTarget.style.color='var(--ui-text-3)'; e.currentTarget.style.background=''; }}}>
          {t('editSlide')}
        </button>

        {/* Present */}
        <button onClick={() => setFullscreen(true)} title={`${t('present')} (F5)`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
          style={{background:'var(--ui-primary)'}}
          onMouseEnter={e => e.currentTarget.style.background='var(--ui-primary-h)'}
          onMouseLeave={e => e.currentTarget.style.background='var(--ui-primary)'}>
          {t('present')}
        </button>

        <div className="w-px h-5 mx-1" style={{background:'var(--ui-border)'}} />

        {/* Save */}
        <button onClick={onSave} title={t('save')}
          className="w-8 h-8 rounded-lg flex items-center justify-center ui-text-3 hover:ui-text hover:ui-bg-5 transition-colors text-sm">
          ↓
        </button>

        <div className="w-px h-5 mx-1" style={{background:'var(--ui-border)'}} />

        {/* Undo / Redo */}
        <button onClick={onUndo} disabled={!canUndo} title={t('undo')}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-sm ${canUndo ? 'ui-text-2 hover:ui-bg-5' : 'ui-text-4 cursor-not-allowed'}`}>
          ↩
        </button>
        <button onClick={onRedo} disabled={!canRedo} title={t('redo')}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-sm ${canRedo ? 'ui-text-2 hover:ui-bg-5' : 'ui-text-4 cursor-not-allowed'}`}>
          ↪
        </button>
      </div>

      {/* Slide viewport */}
      <div ref={viewportContainerRef} className="flex-1 flex items-center justify-center overflow-hidden">
        <iframe ref={iframeRef} className="slide-viewport" src="slide-frame/slide-frame.html" title="Slide Preview"
          sandbox="allow-scripts allow-same-origin"
          style={viewportSize.width > 0 ? { width: viewportSize.width, height: viewportSize.height } : { width: '100%', aspectRatio: '16/9' }}
        />
      </div>

      <ImageTray slide={currentSlide} onApplyAction={onApplyAction} />

      <ThumbnailStrip slides={slides} currentIndex={currentIndex} onGoTo={onGoTo} onReorder={onReorder}
        onAdd={handleAddSlide} onDuplicate={handleDuplicateSlide} onDelete={handleDeleteSlide} />
    </div>
  );
}
