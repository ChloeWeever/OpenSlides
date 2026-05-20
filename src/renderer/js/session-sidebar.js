// session-sidebar.js — chat session history sidebar

function SessionSidebar({ open, sessions, activeId, onSelect, onNew, onDelete, onClose, disabled, lang }) {
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
    if (diff < 60000) return t('justNow');
    if (diff < 3600000) return t('mAgo', Math.floor(diff / 60000));
    if (diff < 86400000) return t('hAgo', Math.floor(diff / 3600000));
    return d.toLocaleDateString();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose} />
      )}

      <div
        className={`fixed left-0 top-0 bottom-0 z-40 w-72 ui-bg-3 flex flex-col transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{borderRight:'1px solid var(--ui-border)'}}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{borderBottom:'1px solid var(--ui-border)'}}>
          <span className="text-sm font-semibold ui-text">{t('sessionsSidebar')}</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center ui-text-3 hover:ui-text hover:ui-bg-5 transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        {/* New session button */}
        <div className="px-3 py-2.5 flex-shrink-0">
          <button
            onClick={onNew}
            disabled={disabled}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{background:'var(--ui-primary)'}}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background='var(--ui-primary-h)'; }}
            onMouseLeave={e => e.currentTarget.style.background='var(--ui-primary)'}
          >
            {t('newPresentation')}
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {sessions.length === 0 && (
            <div className="text-center text-xs ui-text-4 py-8">{t('noSessions')}</div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => { onSelect(s.id); onClose(); }}
              className={`group relative flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                s.id === activeId
                  ? 'border'
                  : 'hover:ui-bg-4 border border-transparent'
              }`}
              style={s.id === activeId ? {
                background: 'rgba(var(--ui-primary-rgb, 208,64,0), 0.12)',
                border: '1px solid rgba(var(--ui-primary-rgb, 208,64,0), 0.35)',
              } : {}}
            >
              {/* Icon */}
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 text-xs"
                style={s.id === activeId
                  ? {background:'rgba(208,64,0,0.25)', color:'var(--ui-primary)'}
                  : {background:'var(--ui-bg-5)', color:'var(--ui-text-3)'}}
              >
                ▦
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="text-sm ui-text-2 truncate font-medium">{s.title || t('untitled')}</div>
                <div className="text-xs ui-text-4 mt-0.5 flex items-center gap-1.5">
                  <span>{s.slides?.length || 0} {t('slides')}</span>
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
                    {t('deleteConfirm')}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                    className="px-2 py-0.5 rounded text-xs ui-bg-5 ui-text-3 hover:ui-text transition-colors"
                  >
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => handleDelete(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center ui-text-3 hover:text-red-400 transition-all flex-shrink-0 text-xs"
                  style={{':hover':{background:'rgba(220,38,38,0.15)'}}}
                  title={t('deleteSession')}
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
