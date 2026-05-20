// export-modal.js — export dialog

function ExportModal({ open, onClose, slides, title, lang }) {
  const [exporting, setExporting] = React.useState(false);
  const [result, setResult] = React.useState(null);

  React.useEffect(() => {
    if (open) setResult(null);
  }, [open]);

  const doExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      const res = await window.openslides.exportHtml({ slides, title });
      setResult(res);
    } catch (e) {
      setResult({ success: false, error: e.message });
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm no-drag">
      <div className="ui-bg-3 border ui-border rounded-xl shadow-2xl w-full max-w-sm p-6 panel-enter" style={{borderWidth:1,borderStyle:'solid'}}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold ui-text">{t('exportPresentation')}</h2>
            <p className="text-xs ui-text-3 mt-0.5">{slides.length} {t('slides')}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center ui-text-3 hover:ui-text hover:ui-bg-5 transition-colors">✕</button>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl ui-bg-4 border ui-border" style={{borderWidth:1,borderStyle:'solid'}}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{background:'rgba(208,64,0,0.15)',color:'#D04000'}}>
            &lt;/&gt;
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium ui-text">HTML</div>
            <div className="text-xs ui-text-3 mt-0.5">{t('exportHtmlDesc')}</div>
          </div>
          <button
            onClick={doExport}
            disabled={exporting}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-50 flex-shrink-0"
            style={{background:'var(--ui-primary)'}}
            onMouseEnter={e => e.currentTarget.style.background='var(--ui-primary-h)'}
            onMouseLeave={e => e.currentTarget.style.background='var(--ui-primary)'}
          >
            {exporting ? t('exporting') : t('export').replace('↑ ', '')}
          </button>
        </div>

        {result && (
          <div className={`mt-4 px-4 py-3 rounded-lg text-xs ${result.success ? 'bg-green-950/40 border border-green-800/50 text-green-400' : 'bg-red-950/40 border border-red-800/50 text-red-400'}`}>
            {result.success ? t('savedTo', result.filePath) : t('exportError', result.error)}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 rounded-lg text-sm ui-text-3 hover:ui-text hover:ui-bg-5 border ui-border transition-all"
          style={{borderWidth:1,borderStyle:'solid'}}
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
