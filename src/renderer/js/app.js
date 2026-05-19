// app.js — root component, entry point

const INIT_MESSAGES = [
  {
    role: 'assistant',
    content: "Hi! I'm your AI presentation assistant. Describe the presentation you'd like to create, or ask me to modify the current slides.",
  },
];

function newSessionId() {
  return 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

function newSession(slides) {
  const id = newSessionId();
  return {
    id,
    title: 'New Presentation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    slides: slides || null,
    messages: INIT_MESSAGES,
  };
}

function App() {
  const slideManager = useSlideManager();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [settings, setSettings] = React.useState({
    apiProvider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com',
    modelName: 'gpt-4o',
  });
  const [selectedElement, setSelectedElement] = React.useState(null);

  // Session state
  const [sessions, setSessions] = React.useState([]);
  const [activeSessionId, setActiveSessionId] = React.useState(null);
  const [messages, setMessages] = React.useState(INIT_MESSAGES);

  // Load settings + sessions on mount
  React.useEffect(() => {
    if (!window.openslides) return;
    window.openslides.getSettings().then((s) => { if (s) setSettings(s); });
    window.openslides.listSessions().then((savedSessions) => {
      if (savedSessions?.length) {
        setSessions(savedSessions);
        // Restore latest session
        const latest = savedSessions[0];
        setActiveSessionId(latest.id);
        setMessages(latest.messages?.length ? latest.messages : INIT_MESSAGES);
        if (latest.slides?.length) {
          slideManager.loadFromSlides(latest.slides);
        }
      } else {
        // First launch: create a default session
        const s = newSession();
        setSessions([s]);
        setActiveSessionId(s.id);
        persistSession(s, INIT_MESSAGES, slideManager.slides);
      }
    });
  }, []);

  // Auto-save current session whenever slides or messages change (debounced)
  const saveTimer = React.useRef(null);
  React.useEffect(() => {
    if (!activeSessionId) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistSession({ id: activeSessionId }, messages, slideManager.slides);
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [slideManager.slides, messages, activeSessionId]);

  function persistSession(partial, msgs, slds) {
    if (!window.openslides) return;
    setSessions((prev) => {
      const existing = prev.find((s) => s.id === partial.id) || {};
      const updated = {
        ...existing,
        ...partial,
        messages: msgs,
        slides: slds,
        updatedAt: Date.now(),
        title: deriveTitleFromMessages(msgs) || existing.title || 'Untitled',
      };
      const rest = prev.filter((s) => s.id !== partial.id);
      const next = [updated, ...rest];
      window.openslides.saveSession(updated);
      return next;
    });
  }

  function deriveTitleFromMessages(msgs) {
    const first = msgs.find((m) => m.role === 'user');
    if (!first) return null;
    return first.content.slice(0, 40) + (first.content.length > 40 ? '…' : '');
  }

  // Switch to an existing session
  const handleSelectSession = React.useCallback((id) => {
    // Save current first
    if (activeSessionId) {
      persistSession({ id: activeSessionId }, messages, slideManager.slides);
    }
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    setActiveSessionId(id);
    setMessages(target.messages?.length ? target.messages : INIT_MESSAGES);
    setSelectedElement(null);
    if (target.slides?.length) {
      slideManager.loadFromSlides(target.slides);
    } else {
      slideManager.loadFromSlides(null);
    }
  }, [activeSessionId, messages, sessions, slideManager]);

  // Create a new session
  const handleNewSession = React.useCallback(() => {
    if (activeSessionId) {
      persistSession({ id: activeSessionId }, messages, slideManager.slides);
    }
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    setMessages(INIT_MESSAGES);
    setSelectedElement(null);
    slideManager.loadFromSlides(null);
    if (window.openslides) window.openslides.saveSession(s);
    setSidebarOpen(false);
  }, [activeSessionId, messages, slideManager]);

  // Delete a session
  const handleDeleteSession = React.useCallback((id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (window.openslides) window.openslides.deleteSession(id);
      // If deleting active session, switch to next or create fresh
      if (id === activeSessionId) {
        const other = next[0];
        if (other) {
          setActiveSessionId(other.id);
          setMessages(other.messages?.length ? other.messages : INIT_MESSAGES);
          if (other.slides?.length) slideManager.loadFromSlides(other.slides);
          else slideManager.loadFromSlides(null);
        } else {
          const fresh = newSession();
          setActiveSessionId(fresh.id);
          setMessages(INIT_MESSAGES);
          slideManager.loadFromSlides(null);
          if (window.openslides) window.openslides.saveSession(fresh);
          return [fresh];
        }
      }
      return next;
    });
  }, [activeSessionId, slideManager]);

  // Clear selection on slide navigation
  React.useEffect(() => {
    setSelectedElement(null);
  }, [slideManager.currentIndex]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        slideManager.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        slideManager.redo();
        return;
      }
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        slideManager.goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        slideManager.goPrev();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [slideManager]);

  const handleSettingsSave = (newSettings) => setSettings(newSettings);
  const needsSetup = !settings.apiKey;

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] overflow-hidden">
      {/* Session sidebar */}
      <SessionSidebar
        open={sidebarOpen}
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={handleSelectSession}
        onNew={handleNewSession}
        onDelete={handleDeleteSession}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Title bar / header */}
      <header className="flex items-center h-9 px-4 bg-[#1a1a1a] border-b border-[#2a2a3a] flex-shrink-0">
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          title="Sessions"
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#8888a8] hover:text-white hover:bg-[#2a2a3a] transition-colors mr-2 text-xs"
        >
          ☰
        </button>
        <span className="text-sm font-semibold text-white tracking-tight">OpenSlides</span>
        <span className="text-xs text-[#4a4a6a] ml-2 truncate max-w-[200px]">
          {sessions.find((s) => s.id === activeSessionId)?.title || 'AI Presentation Editor'}
        </span>
        <div className="flex-1" />
        {needsSetup && (
          <span className="text-xs text-amber-400 mr-3">⚠ Configure AI settings to get started</span>
        )}
        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs text-[#8888a8] hover:text-white hover:bg-[#2a2a3a] transition-colors"
        >
          ↑ Export
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs text-[#8888a8] hover:text-white hover:bg-[#2a2a3a] transition-colors"
        >
          ⚙ Settings
        </button>
      </header>

      {/* Main two-pane layout */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[3] min-w-0 overflow-hidden">
          <PreviewPanel
            slides={slideManager.slides}
            currentIndex={slideManager.currentIndex}
            currentSlide={slideManager.currentSlide}
            direction={slideManager.direction}
            onNext={slideManager.goNext}
            onPrev={slideManager.goPrev}
            onGoTo={slideManager.goTo}
            onSave={slideManager.savePresentation}
            onElementSelected={(el) => setSelectedElement(el)}
            canUndo={slideManager.canUndo}
            canRedo={slideManager.canRedo}
            onUndo={slideManager.undo}
            onRedo={slideManager.redo}
          />
        </div>
        <div className="flex-[2] min-w-0 overflow-hidden" style={{ minWidth: 320, maxWidth: 480 }}>
          <ChatPanel
            slides={slideManager.slides}
            currentSlide={slideManager.currentSlide}
            onApplyAction={slideManager.applyAction}
            settings={settings}
            selectedElement={selectedElement}
            onClearSelection={() => setSelectedElement(null)}
            messages={messages}
            setMessages={setMessages}
            onNewSession={handleNewSession}
          />
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSettingsSave}
      />
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        slides={slideManager.slides}
        title={sessions.find((s) => s.id === activeSessionId)?.title || 'presentation'}
      />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
