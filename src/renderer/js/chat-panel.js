// chat-panel.js — right pane: AI conversation interface

const QUICK_PROMPTS = [
  'Create a 5-slide intro presentation',
  'Add a summary slide',
  'Make the design more colorful',
  'Add a two-column comparison slide',
  'Suggest improvements',
];

// Keywords that signal a "generate full presentation" intent
function isPresentationRequest(text) {
  const t = text.toLowerCase();
  return (
    (t.includes('ppt') || t.includes('presentation') || t.includes('幻灯片') ||
     t.includes('slides') || t.includes('slideshow') || t.includes('slide deck') ||
     t.includes('生成') || t.includes('创建') || t.includes('制作')) &&
    (t.includes('ppt') || t.includes('presentation') || t.includes('幻灯片') ||
     t.includes('slides') || t.length > 120)
  );
}

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

// ── Step-by-step generation progress UI ───────────────────────────────────────
function GenerationProgress({ outline, currentStep, done, error }) {
  if (!outline) return null;
  return (
    <div className="mx-4 mb-3 rounded-xl bg-[#1a1a2a] border border-[#2a2a3a] overflow-hidden">
      <div className="px-3 py-2 border-b border-[#2a2a3a] flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${done ? 'bg-[#a6e3a1]' : 'bg-[#6366f1] animate-pulse'}`} />
        <span className="text-xs font-medium text-[#cdd6f4]">
          {done ? '生成完成' : `正在生成幻灯片 ${currentStep} / ${outline.length}`}
        </span>
        {error && <span className="text-xs text-[#f38ba8] ml-auto truncate">{error}</span>}
      </div>
      <div className="p-2 flex flex-col gap-1">
        {outline.map((s, i) => {
          const state = i < currentStep - 1 ? 'done' : i === currentStep - 1 ? 'active' : 'pending';
          return (
            <div key={s.id} className={`flex flex-col px-2 py-1.5 rounded-lg text-xs transition-colors ${state === 'active' ? 'bg-[#6366f1]/15' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                  state === 'done' ? 'bg-[#a6e3a1] text-black' :
                  state === 'active' ? 'bg-[#6366f1] text-white' :
                  'bg-[#2a2a3a] text-[#4a4a6a]'
                }`}>
                  {state === 'done' ? '✓' : i + 1}
                </span>
                <span className={`truncate flex-1 font-medium ${state === 'pending' ? 'text-[#4a4a6a]' : 'text-[#cdd6f4]'}`}>
                  {s.title}
                </span>
                <span className="text-[#4a4a6a] flex-shrink-0 text-[9px]">[{s.layout}]</span>
              </div>
              {state !== 'pending' && (s.kicker || s.contentType) && (
                <div className="ml-6 mt-0.5 text-[#6c7086] text-[10px] leading-snug">
                  {s.kicker && <span className="text-[#89b4fa] mr-1">{s.kicker}</span>}
                  {s.contentType && <span className="opacity-60">[{s.contentType}]</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-[#2a2a3a]">
        <div
          className="h-full bg-[#6366f1] transition-all duration-500"
          style={{ width: `${done ? 100 : Math.round(((currentStep - 1) / outline.length) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function ChatPanel({ slides, currentSlide, onApplyAction, settings, selectedElement, onClearSelection, messages, setMessages, onNewSession }) {
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [error, setError] = React.useState('');
  const [genOutline, setGenOutline] = React.useState(null);
  const [genStep, setGenStep] = React.useState(0);
  const [genDone, setGenDone] = React.useState(false);
  const [genError, setGenError] = React.useState('');
  const endRef = React.useRef(null);
  const textareaRef = React.useRef(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking, genOutline]);

  const buildContext = React.useCallback(() => {
    let ctx = `Current presentation has ${slides.length} slide(s). Current slide: ${JSON.stringify(currentSlide, null, 2)}`;
    if (selectedElement) {
      ctx += `\n\nThe user has selected this element on the slide: ${JSON.stringify(selectedElement, null, 2)}`;
    }
    return ctx;
  }, [slides, currentSlide, selectedElement]);

  const actionToMessage = (data) => {
    switch (data.action) {
      case 'replace_all': return `Created ${data.slides?.length || 0} slides.`;
      case 'add_slides': return `Added ${data.slides?.length || 0} slide(s).`;
      case 'update_slide': return 'Slide updated.';
      case 'delete_slide': return 'Slide deleted.';
      default: return 'Done!';
    }
  };

  // ── Step-by-step presentation generation ──────────────────────────────────
  const generatePresentation = React.useCallback(async (text) => {
    setThinking(true);
    setGenOutline(null);
    setGenDone(false);
    setGenError('');
    setError('');

    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      // Step 1: generate outline
      setMessages((prev) => [...prev, { role: 'assistant', content: '正在规划大纲…' }]);
      const outlineResult = await window.openslides.genOutline(text, settings);
      if (!outlineResult.success) throw new Error(outlineResult.error);
      const outline = outlineResult.data?.slides;
      if (!Array.isArray(outline) || !outline.length) throw new Error('无法生成大纲');

      // Update message to show outline summary
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: `大纲已确认，共 ${outline.length} 页：\n${outline.map((s, i) => `${i+1}. [${s.layout}] ${s.title}`).join('\n')}\n\n开始逐页生成…`,
        };
        return next;
      });

      setGenOutline(outline);
      setGenStep(1);
      setThinking(false);

      // Step 2: generate each slide one by one
      const allSlides = [];
      let errorCount = 0;

      for (let i = 0; i < outline.length; i++) {
        setGenStep(i + 1);
        const s = outline[i];
        const slideResult = await window.openslides.genSlide(
          { outlineSlide: s, allOutline: outline, userRequest: text, slideIndex: i, totalSlides: outline.length },
          settings
        );
        if (!slideResult.success || !slideResult.data?.slides?.length) {
          errorCount++;
          setGenError(`幻灯片 ${i + 1} 生成失败`);
          // Insert minimal fallback slide so deck stays complete
          allSlides.push({
            id: s.id || `slide-${i + 1}`,
            layout: s.layout || 'content',
            background: i % 2 === 0 ? '#0f0f1a' : '#13131f',
            transition: i === 0 ? 'fade' : 'slide',
            elements: [
              { type: 'kicker', text: s.kicker || 'SLIDE' },
              { type: 'heading', text: s.title || `Slide ${i + 1}`, gradient: true },
              { type: 'divider' },
              { type: 'body', text: slideResult.error || '生成失败，请重试' },
            ],
          });
        } else {
          allSlides.push(...slideResult.data.slides);
        }
        // Apply progressively so user sees slides appearing one by one
        onApplyAction({ action: 'replace_all', slides: [...allSlides] });
      }

      setGenStep(outline.length + 1);
      setGenDone(true);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: errorCount > 0
          ? `✓ ${outline.length} 页已生成，其中 ${errorCount} 页生成失败（已插入占位页）。`
          : `✓ 全部 ${outline.length} 页幻灯片已生成完成！`,
      }]);
    } catch (err) {
      setGenError(err.message);
      setError(err.message);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
      setThinking(false);
    }
  }, [settings, onApplyAction, setMessages]);

  // ── Regular single-turn chat ───────────────────────────────────────────────
  const sendMessage = React.useCallback(async (text) => {
    if (!text.trim() || thinking) return;

    // Route to step-by-step generator for presentation requests
    if (isPresentationRequest(text) && window.openslides?.genOutline) {
      return generatePresentation(text);
    }

    setError('');
    const userMsg = { role: 'user', content: text };
    const context = buildContext();
    const contextMsg = { role: 'user', content: `[Context] ${context}\n\n${text}` };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setThinking(true);

    try {
      const history = [...messages.slice(1).map((m) => ({ role: m.role, content: m.content })), contextMsg];
      const result = await window.openslides.sendChat(history, settings);

      if (!result.success) throw new Error(result.error);

      if (result.data) {
        onApplyAction(result.data);
        const reply = result.data.message || actionToMessage(result.data);
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: result.raw || 'Done!' }]);
      }
    } catch (err) {
      setError(err.message);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setThinking(false);
    }
  }, [messages, thinking, buildContext, onApplyAction, settings, setMessages, generatePresentation]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isGenerating = genOutline && !genDone;

  return (
    <div className="flex flex-col h-full bg-[#16161e] border-l border-[#2a2a3a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3a] flex-shrink-0 no-drag">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#6366f1] animate-pulse" />
          <span className="text-sm font-medium text-[#cdd6f4]">AI Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8888a8]">{settings?.modelName || 'No model set'}</span>
          <button
            onClick={onNewSession}
            title="New session"
            className="w-6 h-6 rounded flex items-center justify-center text-[#8888a8] hover:text-white hover:bg-[#2a2a3a] transition-colors text-xs"
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

      {/* Generation progress — shown between messages and input */}
      {genOutline && (
        <GenerationProgress
          outline={genOutline}
          currentStep={genStep}
          done={genDone}
          error={genError}
        />
      )}

      {/* Quick prompts */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => sendMessage(p)}
            disabled={thinking || isGenerating}
            className="text-xs px-3 py-1.5 rounded-full bg-[#1c1c28] border border-[#2a2a3a] text-[#8888a8] hover:text-[#cdd6f4] hover:border-[#4a4a6a] transition-all disabled:opacity-40"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0 no-drag">
        {/* Selected element chip */}
        {selectedElement && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-[#6366f1]/15 border border-[#6366f1]/40 text-xs text-[#a5b4fc]">
            <span className="opacity-60">Selected:</span>
            <span className="font-medium truncate flex-1">
              [{selectedElement.type}] {selectedElement.text || (selectedElement.items ? selectedElement.items.join(', ') : selectedElement.src || '')}
            </span>
            <button
              onClick={onClearSelection}
              className="ml-auto opacity-60 hover:opacity-100 transition-opacity text-[#a5b4fc] flex-shrink-0"
            >
              ✕
            </button>
          </div>
        )}
        <div className="relative bg-[#1c1c28] border border-[#2a2a3a] rounded-xl focus-within:border-[#6366f1] focus-within:ring-1 focus-within:ring-[#6366f1] transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你的演示文稿，或对当前幻灯片提出修改… (Enter 发送)"
            rows={3}
            disabled={isGenerating}
            className="w-full bg-transparent px-4 pt-3 pb-10 text-sm text-white placeholder-[#4a4a6a] resize-none focus:outline-none leading-relaxed disabled:opacity-50"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <span className="text-xs text-[#4a4a6a]">⏎ send · ⇧⏎ newline</span>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || thinking || isGenerating}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#6366f1] text-white disabled:opacity-40 hover:bg-[#5254cc] transition-all"
            >
              {thinking ? '…' : isGenerating ? '生成中' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

