// chat-panel.js — right pane: AI conversation interface

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 msg-assistant rounded-xl w-fit">
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${isUser ? 'msg-user' : 'msg-assistant'}`}>
        {msg.content}
      </div>
    </div>
  );
}

function GenerationProgress({ outline, currentStep, done, error }) {
  if (!outline) return null;
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <div className="mx-4 mb-3 rounded-xl overflow-hidden" style={{background:'var(--ui-bg-4)',border:'1px solid var(--ui-border)'}}>
      <div className="px-3 py-2 flex items-center gap-2 select-none"
        style={{borderBottom: collapsed ? 'none' : '1px solid var(--ui-border)'}}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 cursor-pointer ${done ? 'bg-[#a6e3a1]' : 'animate-pulse'}`}
          style={!done ? {background:'var(--ui-primary)'} : {}}
          onClick={() => setCollapsed(c => !c)} />
        <span className="text-xs font-medium ui-text-2 flex-1 cursor-pointer" onClick={() => setCollapsed(c => !c)}>
          {done ? t('genComplete') : t('genSlide', currentStep, outline.length)}
        </span>
        {error && <span className="text-xs text-[#f38ba8] truncate max-w-[40%]">{error}</span>}
        <span className="text-[10px] ui-text-4 flex-shrink-0 ml-1 cursor-pointer" onClick={() => setCollapsed(c => !c)}>{collapsed ? '▸' : '▾'}</span>
      </div>
      {!collapsed && (
        <>
          <div className="p-2 flex flex-col gap-1 overflow-y-auto" style={{maxHeight:'240px'}}>
            {outline.map((s, i) => {
              const state = i < currentStep - 1 ? 'done' : i === currentStep - 1 ? 'active' : 'pending';
              return (
                <div key={s.id} className={`flex flex-col px-2 py-1.5 rounded-lg text-xs transition-colors`}
                  style={state === 'active' ? {background:'rgba(208,64,0,0.12)'} : {}}
                  ref={state === 'active' ? el => el?.scrollIntoView({ block:'nearest', behavior:'smooth' }) : null}>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                      style={
                        state === 'done'   ? {background:'#a6e3a1',color:'#000'} :
                        state === 'active' ? {background:'var(--ui-primary)',color:'#fff'} :
                                             {background:'var(--ui-bg-5)',color:'var(--ui-text-4)'}
                      }>
                      {state === 'done' ? '✓' : i + 1}
                    </span>
                    <span className={`truncate flex-1 font-medium ${state === 'pending' ? 'ui-text-4' : 'ui-text-2'}`}>
                      {s.title}
                    </span>
                    {s.layout && <span className="flex-shrink-0 text-[9px] ui-text-4">[{s.layout}]</span>}
                  </div>
                  {state !== 'pending' && (s.kicker || s.contentType || s.notes) && (
                    <div className="ml-6 mt-0.5 text-[10px] leading-snug ui-text-3">
                      {s.kicker && <span className="mr-1" style={{color:'var(--ui-primary)'}}>{s.kicker}</span>}
                      {s.contentType && <span className="opacity-60">[{s.contentType}]</span>}
                      {s.notes && !s.kicker && <span className="opacity-60 truncate">{s.notes.slice(0, 60)}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="h-1" style={{background:'var(--ui-border)'}}>
            <div
              className="h-full transition-all duration-500"
              style={{
                background: 'var(--ui-primary)',
                width: `${done ? 100 : Math.round(((currentStep - 1) / outline.length) * 100)}%`,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ChatPanel({ slides, currentSlide, onApplyAction, settings, selectedElement, onClearSelection, messages, setMessages, onNewSession, onBusyChange, lang }) {
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [error, setError] = React.useState('');
  const [genOutline, setGenOutline] = React.useState(null);
  const [genStep, setGenStep] = React.useState(0);
  const [genDone, setGenDone] = React.useState(false);
  const [genError, setGenError] = React.useState('');
  const [genMode, setGenMode] = React.useState('template'); // 'template' | 'solo'
  const endRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const abortRef = React.useRef(false);

  const quickPrompts = [
    t('quickPrompt1'), t('quickPrompt2'), t('quickPrompt3'),
    t('quickPrompt4'), t('quickPrompt5'),
  ];

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking, genOutline]);

  const isGenerating = genOutline && !genDone;
  React.useEffect(() => {
    onBusyChange?.(thinking || !!isGenerating);
  }, [thinking, isGenerating, onBusyChange]);

  const buildContext = React.useCallback(() => {
    const summarizeSlide = (s) => {
      if (!s) return s;
      if (s.soloHtml) {
        const { soloHtml, ...rest } = s;
        // Include full soloHtml so AI can edit it; other slides in history are already truncated
        return { ...rest, soloHtml };
      }
      return s;
    };
    let ctx = `Current presentation has ${slides.length} slide(s). Current slide: ${JSON.stringify(summarizeSlide(currentSlide), null, 2)}`;
    if (selectedElement) {
      ctx += `\n\nThe user has selected this element on the slide: ${JSON.stringify(selectedElement, null, 2)}`;
    }
    return ctx;
  }, [slides, currentSlide, selectedElement]);

  const actionToMessage = (data) => {
    switch (data.action) {
      case 'replace_all': return `Created ${data.slides?.length || 0} slides.`;
      case 'add_slides':  return `Added ${data.slides?.length || 0} slide(s).`;
      case 'update_slide': return 'Slide updated.';
      case 'delete_slide': return 'Slide deleted.';
      default: return 'Done!';
    }
  };

  const generatePresentation = React.useCallback(async (text, appendUserMsg = true) => {
    setThinking(true);
    setGenOutline(null);
    setGenDone(false);
    setGenError('');
    setError('');
    abortRef.current = false;

    if (appendUserMsg) {
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setInput('');
    }

    try {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('genStarting') }]);
      const outlineResult = await window.openslides.genOutline(text, settings);
      if (!outlineResult.success) throw new Error(outlineResult.error);
      const outline = outlineResult.data?.slides;
      if (!Array.isArray(outline) || !outline.length) throw new Error(t('genFailed'));

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: `${t('genOutlineConfirmed', outline.length)}\n${outline.map((s, i) => `${i+1}. [${s.layout}] ${s.title}`).join('\n')}\n\n${t('genStarting')}`,
        };
        return next;
      });

      setGenOutline(outline);
      setGenStep(1);
      setThinking(false);

      const allSlides = [];
      let errorCount = 0;

      for (let i = 0; i < outline.length; i++) {
        if (abortRef.current) {
          setGenDone(true);
          setMessages((prev) => [...prev, { role: 'assistant', content: t('genAborted', allSlides.length) }]);
          return;
        }
        setGenStep(i + 1);
        const s = outline[i];
        const slideResult = await window.openslides.genSlide(
          { outlineSlide: s, allOutline: outline, userRequest: text, slideIndex: i, totalSlides: outline.length },
          settings
        );
        if (!slideResult.success || !slideResult.data?.slides?.length) {
          errorCount++;
          setGenError(t('genSlideFailed', i + 1));
          allSlides.push({
            id: s.id || `slide-${i + 1}`,
            layout: s.layout || 'content',
            background: i % 2 === 0 ? '#0f0f1a' : '#13131f',
            transition: i === 0 ? 'fade' : 'slide',
            elements: [
              { type: 'kicker', text: s.kicker || 'SLIDE' },
              { type: 'heading', text: s.title || `Slide ${i + 1}`, gradient: true },
              { type: 'divider' },
              { type: 'body', text: slideResult.error || t('genFailed') },
            ],
          });
        } else {
          allSlides.push(...slideResult.data.slides);
        }
        onApplyAction({ action: 'replace_all', slides: [...allSlides] });
      }

      setGenStep(outline.length + 1);
      setGenDone(true);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: errorCount > 0
          ? t('genDoneWithErrors', outline.length, errorCount)
          : t('genDoneAll', outline.length),
      }]);
    } catch (err) {
      setGenError(err.message);
      setError(err.message);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
      setThinking(false);
    }
  }, [settings, onApplyAction, setMessages]);

  const generateSoloPresentation = React.useCallback(async (text, appendUserMsg = true) => {
    setThinking(true);
    setGenOutline(null);
    setGenDone(false);
    setGenError('');
    setError('');
    abortRef.current = false;

    if (appendUserMsg) {
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setInput('');
    }

    try {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('genStarting') }]);
      const outlineResult = await window.openslides.genSoloOutline(text, settings);
      if (!outlineResult.success) throw new Error(outlineResult.error);
      const outline = outlineResult.data?.slides;
      const theme = outlineResult.data?.theme || null;
      if (!Array.isArray(outline) || !outline.length) throw new Error(t('genFailed'));

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: `${t('genOutlineConfirmed', outline.length)}\n${outline.map((s, i) => `${i+1}. ${s.title}`).join('\n')}\n\n${t('genStarting')}`,
        };
        return next;
      });

      setGenOutline(outline);
      setGenStep(1);
      setThinking(false);

      const allSlides = [];
      let errorCount = 0;

      for (let i = 0; i < outline.length; i++) {
        if (abortRef.current) {
          setGenDone(true);
          setMessages((prev) => [...prev, { role: 'assistant', content: t('genAborted', allSlides.length) }]);
          return;
        }
        setGenStep(i + 1);
        const s = outline[i];
        const slideResult = await window.openslides.genSoloSlide(
          { outlineSlide: s, allOutline: outline, userRequest: text, slideIndex: i, totalSlides: outline.length, theme },
          settings
        );
        if (!slideResult.success || !slideResult.data?.html) {
          errorCount++;
          setGenError(t('genSlideFailed', i + 1));
          allSlides.push({
            id: s.id || `slide-${i + 1}`,
            layout: 'blank',
            background: '#ffffff',
            transition: i === 0 ? 'fade' : 'slide',
            elements: [
              { type: 'heading', text: s.title || `Slide ${i + 1}` },
              { type: 'body', text: slideResult.error || t('genFailed') },
            ],
          });
        } else {
          allSlides.push({
            id: s.id || `slide-${i + 1}`,
            layout: 'blank',
            soloHtml: slideResult.data.html,
            background: '#ffffff',
            transition: i === 0 ? 'fade' : 'slide',
          });
        }
        onApplyAction({ action: 'replace_all', slides: [...allSlides] });
      }

      setGenStep(outline.length + 1);
      setGenDone(true);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: errorCount > 0
          ? t('genDoneWithErrors', outline.length, errorCount)
          : t('genDoneAll', outline.length),
      }]);
    } catch (err) {
      setGenError(err.message);
      setError(err.message);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
      setThinking(false);
    }
  }, [settings, onApplyAction, setMessages]);

  const sendMessage = React.useCallback(async (text) => {
    if (!text.trim() || thinking) return;

    setError('');
    const userMsg = { role: 'user', content: text };
    const context = buildContext();
    const contextMsg = { role: 'user', content: `[Context] ${context}\n\n${text}` };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setThinking(true);

    try {
      const history = [...messages.slice(1).map((m) => ({ role: m.role, content: m.content })), contextMsg];
      const result = await window.openslides.sendChat(history, settings, genMode);

      if (!result.success) throw new Error(result.error);

      if (result.data?.action === 'generate_presentation') {
        setThinking(false);
        const req = result.data.request || text;
        return genMode === 'solo'
          ? generateSoloPresentation(req, false)
          : generatePresentation(req, false);
      }

      if (result.data) {
        onApplyAction(result.data);
        const reply = result.data.message || actionToMessage(result.data);
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: result.raw || 'Done!' }]);
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'Aborted') return;
      setError(err.message);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setThinking(false);
    }
  }, [messages, thinking, buildContext, onApplyAction, settings, setMessages, generatePresentation, generateSoloPresentation, genMode]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full ui-bg-3" style={{borderLeft:'1px solid var(--ui-border)'}}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 no-drag" style={{borderBottom:'1px solid var(--ui-border)'}}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{background:'var(--ui-primary)'}} />
          <span className="text-sm font-medium ui-text-2">{t('aiAssistant')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs ui-text-3">{settings?.modelName || t('noModelSet')}</span>
          <button
            onClick={onNewSession}
            disabled={thinking || isGenerating}
            title={t('newSession')}
            className="w-6 h-6 rounded flex items-center justify-center ui-text-3 hover:ui-text hover:ui-bg-5 transition-colors text-xs disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ✎
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {thinking && (
          <div className="flex justify-start">
            <ThinkingIndicator />
          </div>
        )}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Generation progress */}
      {genOutline && (
        <GenerationProgress
          outline={genOutline}
          currentStep={genStep}
          done={genDone}
          error={genError}
        />
      )}

      {/* Mode toggle */}
      <div className="px-4 pb-1 pt-1 flex items-center gap-2 flex-shrink-0">
        <span className="text-xs ui-text-4">{t('genMode')}</span>
        {['template', 'solo'].map((m) => (
          <button
            key={m}
            onClick={() => setGenMode(m)}
            disabled={thinking || isGenerating}
            className="text-xs px-2.5 py-1 rounded-md border transition-all disabled:opacity-40"
            style={genMode === m
              ? {background:'var(--ui-primary)',color:'#fff',borderColor:'var(--ui-primary)',borderWidth:1,borderStyle:'solid'}
              : {background:'var(--ui-bg-4)',borderColor:'var(--ui-border)',borderWidth:1,borderStyle:'solid',color:'var(--ui-text-3)'}}
          >
            {t('genMode_' + m)}
          </button>
        ))}
        <div className="relative" style={{display:'inline-flex'}}>
          <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold cursor-default ui-text-4"
            style={{background:'var(--ui-bg-5)',lineHeight:1}}
            onMouseEnter={e => e.currentTarget.nextSibling.style.display='block'}
            onMouseLeave={e => e.currentTarget.nextSibling.style.display='none'}>?</span>
          <div style={{display:'none',position:'absolute',bottom:'calc(100% + 6px)',left:'50%',transform:'translateX(-50%)',
            width:220,background:'var(--ui-bg-5)',border:'1px solid var(--ui-border)',borderRadius:8,
            padding:'8px 10px',zIndex:50,pointerEvents:'none'}}>
            <div className="text-[11px] font-semibold ui-text-2 mb-1">{t('genMode_template')}</div>
            <div className="text-[11px] ui-text-3 mb-2" style={{lineHeight:1.5}}>{t('genModeTemplateDesc')}</div>
            <div className="text-[11px] font-semibold ui-text-2 mb-1">Solo</div>
            <div className="text-[11px] ui-text-3" style={{lineHeight:1.5}}>{t('genModeSoloDesc')}</div>
          </div>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
        {quickPrompts.map((p) => (
          <button
            key={p}
            onClick={() => sendMessage(p)}
            disabled={thinking || isGenerating}
            className="text-xs px-3 py-1.5 rounded-full ui-bg-4 border ui-border ui-text-3 hover:ui-text-2 hover:ui-border-2 transition-all disabled:opacity-40"
            style={{borderWidth:1,borderStyle:'solid'}}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0 no-drag">
        {selectedElement && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-xs"
            style={{background:'rgba(208,64,0,0.12)',border:'1px solid rgba(208,64,0,0.35)',color:'var(--ui-primary)'}}>
            <span className="opacity-60">{t('selected')}</span>
            <span className="font-medium truncate flex-1">
              [{selectedElement.type}] {selectedElement.text || (selectedElement.items ? selectedElement.items.join(', ') : selectedElement.src || '')}
            </span>
            <button
              onClick={onClearSelection}
              className="ml-auto opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
            >
              ✕
            </button>
          </div>
        )}
        <div className="relative rounded-xl transition-all" style={{background:'var(--ui-bg-4)',border:'1px solid var(--ui-border)'}}
          onFocusCapture={e => e.currentTarget.style.borderColor='var(--ui-primary)'}
          onBlurCapture={e => e.currentTarget.style.borderColor='var(--ui-border)'}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chatPlaceholder')}
            rows={3}
            disabled={isGenerating}
            className="w-full bg-transparent px-4 pt-3 pb-10 text-sm ui-text resize-none focus:outline-none leading-relaxed disabled:opacity-50"
            style={{caretColor:'var(--ui-primary)'}}
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <span className="text-xs ui-text-4">{t('sendHelp')}</span>
            {isGenerating ? (
              <button
                onClick={() => { abortRef.current = true; window.openslides.abortLLM?.(); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{background:'rgba(243,139,168,0.15)',color:'#f38ba8',border:'1px solid rgba(243,139,168,0.4)'}}
                onMouseEnter={e => e.currentTarget.style.background='rgba(243,139,168,0.28)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(243,139,168,0.15)'}
              >
                {t('stopGeneration')}
              </button>
            ) : thinking ? (
              <button
                onClick={() => { window.openslides.abortLLM?.(); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{background:'rgba(243,139,168,0.15)',color:'#f38ba8',border:'1px solid rgba(243,139,168,0.4)'}}
                onMouseEnter={e => e.currentTarget.style.background='rgba(243,139,168,0.28)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(243,139,168,0.15)'}
              >
                {t('stopGeneration')}
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || thinking}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-all"
                style={{background:'var(--ui-primary)'}}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background='var(--ui-primary-h)'; }}
                onMouseLeave={e => e.currentTarget.style.background='var(--ui-primary)'}
              >
                {thinking ? '…' : t('send')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
