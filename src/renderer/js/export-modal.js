// export-modal.js — export to HTML / PDF dialog

function ExportModal({ open, onClose, slides, title }) {
  const [exporting, setExporting] = React.useState(null); // 'html' | 'pdf' | null
  const [result, setResult] = React.useState(null); // { success, filePath, error }

  React.useEffect(() => {
    if (open) setResult(null);
  }, [open]);

  const doExport = async (format) => {
    setExporting(format);
    setResult(null);
    try {
      const fn = format === 'html' ? window.openslides.exportHtml : window.openslides.exportPdf;
      const res = await fn({ slides, title });
      setResult(res);
    } catch (e) {
      setResult({ success: false, error: e.message });
    } finally {
      setExporting(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm no-drag">
      <div className="bg-[#16161e] border border-[#2a2a3a] rounded-xl shadow-2xl w-full max-w-sm p-6 panel-enter">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Export Presentation</h2>
            <p className="text-xs text-[#8888a8] mt-0.5">{slides.length} slide{slides.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8888a8] hover:text-white hover:bg-[#2a2a3a] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Format cards */}
        <div className="space-y-3">
          {/* HTML */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-[#1c1c28] border border-[#2a2a3a] hover:border-[#4a4a6a] transition-all">
            <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-400 text-lg flex-shrink-0">
              &lt;/&gt;
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">HTML</div>
              <div className="text-xs text-[#8888a8] mt-0.5">Self-contained file, works in any browser</div>
            </div>
            <button
              onClick={() => doExport('html')}
              disabled={!!exporting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/80 hover:bg-orange-500 text-white transition-all disabled:opacity-50 flex-shrink-0"
            >
              {exporting === 'html' ? '…' : 'Export'}
            </button>
          </div>

          {/* PDF */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-[#1c1c28] border border-[#2a2a3a] hover:border-[#4a4a6a] transition-all">
            <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center text-red-400 text-lg flex-shrink-0">
              PDF
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">PDF</div>
              <div className="text-xs text-[#8888a8] mt-0.5">16:9 pages, print-ready, 1280×720 px</div>
            </div>
            <button
              onClick={() => doExport('pdf')}
              disabled={!!exporting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/80 hover:bg-red-500 text-white transition-all disabled:opacity-50 flex-shrink-0"
            >
              {exporting === 'pdf' ? '…' : 'Export'}
            </button>
          </div>
        </div>

        {/* Result feedback */}
        {result && (
          <div className={`mt-4 px-4 py-3 rounded-lg text-xs ${result.success ? 'bg-green-950/40 border border-green-800/50 text-green-400' : 'bg-red-950/40 border border-red-800/50 text-red-400'}`}>
            {result.success
              ? `✓ Saved to: ${result.filePath}`
              : `✕ Error: ${result.error}`}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 rounded-lg text-sm text-[#8888a8] hover:text-white hover:bg-[#2a2a3a] border border-[#2a2a3a] transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
}
