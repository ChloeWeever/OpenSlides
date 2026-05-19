// chat-panel.js — right pane: AI conversation interface

const QUICK_PROMPTS = [
  'Create a 5-slide intro presentation',
  'Add a summary slide',
  'Make the design more colorful',
  'Add a two-column comparison slide',
  'Suggest improvements',
];

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

function ChatPanel({ slides, currentSlide, onApplyAction, settings, selectedElement, onClearSelection, messages, setMessages, onNewSession }) {
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [error, setError] = React.useState('');
  const endRef = React.useRef(null);
  const textareaRef = React.useRef(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

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
  }, [messages, thinking, buildContext, onApplyAction, settings, setMessages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

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

      {/* Quick prompts */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => sendMessage(p)}
            disabled={thinking}
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
            placeholder="Describe your presentation or ask for changes… (Enter to send)"
            rows={3}
            className="w-full bg-transparent px-4 pt-3 pb-10 text-sm text-white placeholder-[#4a4a6a] resize-none focus:outline-none leading-relaxed"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <span className="text-xs text-[#4a4a6a]">⏎ send · ⇧⏎ newline</span>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || thinking}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#6366f1] text-white disabled:opacity-40 hover:bg-[#5254cc] transition-all"
            >
              {thinking ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
