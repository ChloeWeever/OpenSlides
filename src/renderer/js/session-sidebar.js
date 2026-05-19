// session-sidebar.js — chat session history sidebar

function SessionSidebar({ open, sessions, activeId, onSelect, onNew, onDelete, onClose }) {
  const [confirmDelete, setConfirmDelete] = React.useState(null);

  const handleDelete = (e, id) => {
    e.stopPropagation();
    setConfirmDelete(id);
  };

  const confirmAndDelete = (e) => {
    e.stopPropagation();
    onDelete(confirmDelete);
    setConfirmDelete(null);
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed left-0 top-0 bottom-0 z-40 w-72 bg-[#13131d] border-r border-[#2a2a3a] flex flex-col transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3a] flex-shrink-0">
          <span className="text-sm font-semibold text-white">Sessions</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#8888a8] hover:text-white hover:bg-[#2a2a3a] transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        {/* New session button */}
        <div className="px-3 py-2.5 flex-shrink-0">
          <button
            onClick={onNew}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#6366f1] hover:bg-[#5254cc] text-white text-sm font-medium transition-all"
          >
            <span className="text-base leading-none">+</span>
            New Presentation
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {sessions.length === 0 && (
            <div className="text-center text-xs text-[#4a4a6a] py-8">No saved sessions yet</div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => { onSelect(s.id); onClose(); }}
              className={`group relative flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                s.id === activeId
                  ? 'bg-[#6366f1]/20 border border-[#6366f1]/40'
                  : 'hover:bg-[#1c1c28] border border-transparent'
              }`}
            >
              {/* Icon */}
              <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 text-xs ${s.id === activeId ? 'bg-[#6366f1]/30 text-[#a5b4fc]' : 'bg-[#2a2a3a] text-[#8888a8]'}`}>
                ▦
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#cdd6f4] truncate font-medium">{s.title || 'Untitled'}</div>
                <div className="text-xs text-[#4a4a6a] mt-0.5 flex items-center gap-1.5">
                  <span>{s.slides?.length || 0} slides</span>
                  <span>·</span>
                  <span>{formatDate(s.updatedAt || s.createdAt)}</span>
                </div>
              </div>

              {/* Delete button */}
              {confirmDelete === s.id ? (
                <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={confirmAndDelete}
                    className="px-2 py-0.5 rounded text-xs bg-red-600 text-white hover:bg-red-500 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                    className="px-2 py-0.5 rounded text-xs bg-[#2a2a3a] text-[#8888a8] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => handleDelete(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-[#8888a8] hover:text-red-400 hover:bg-red-950/40 transition-all flex-shrink-0 text-xs"
                  title="Delete session"
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
