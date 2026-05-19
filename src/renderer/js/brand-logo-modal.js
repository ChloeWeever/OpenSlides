// brand-logo-modal.js — global brand logo settings

function BrandLogoModal({ open, onClose, onSave }) {
  const [form, setForm] = React.useState({
    dataUrl: null,
    position: 'bottom-right',
    width: 80,
    opacity: 1,
    enabled: true,
  });

  React.useEffect(() => {
    if (open && window.openslides) {
      window.openslides.getLogo().then((logo) => {
        if (logo) setForm(logo);
      });
    }
  }, [open]);

  const handlePickImage = async () => {
    const result = await window.openslides.pickImage();
    if (result.success) setForm((f) => ({ ...f, dataUrl: result.dataUrl }));
  };

  const handleRemove = () => setForm((f) => ({ ...f, dataUrl: null }));

  const handleSave = async () => {
    if (window.openslides) await window.openslides.saveLogo(form);
    onSave(form);
    onClose();
  };

  if (!open) return null;

  const POSITIONS = [
    { id: 'top-left',     label: '↖' },
    { id: 'top-right',    label: '↗' },
    { id: 'bottom-left',  label: '↙' },
    { id: 'bottom-right', label: '↘' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm no-drag">
      <div className="ui-bg-3 border ui-border rounded-xl shadow-2xl w-full max-w-sm p-6 panel-enter" style={{borderWidth:1,borderStyle:'solid'}}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold ui-text">{t('brandLogo')}</h2>
            <p className="text-sm ui-text-3 mt-0.5">{t('brandLogoDesc')}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center ui-text-3 hover:ui-text hover:ui-bg-5 transition-colors"
          >✕</button>
        </div>

        <div className="space-y-4">
          {/* Logo preview + upload */}
          <div>
            <label className="block text-sm font-medium ui-text-2 mb-2">{t('logoImage')}</label>
            <div className="flex items-center gap-3">
              <div
                className="w-16 h-16 rounded-lg border ui-border flex items-center justify-center ui-bg-4 flex-shrink-0 overflow-hidden"
                style={{borderWidth:1,borderStyle:'solid'}}
              >
                {form.dataUrl
                  ? <img src={form.dataUrl} alt="logo" style={{width:'100%',height:'100%',objectFit:'contain'}} />
                  : <span className="text-xl ui-text-4">🖼</span>
                }
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <button
                  onClick={handlePickImage}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border ui-border ui-text-3 hover:ui-text hover:ui-border-2 ui-bg-4 transition-all"
                  style={{borderWidth:1,borderStyle:'solid'}}
                >
                  {t('uploadLogo')}
                </button>
                {form.dataUrl && (
                  <button
                    onClick={handleRemove}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                    style={{borderWidth:1,borderStyle:'solid',borderColor:'var(--ui-danger,#f38ba8)',color:'var(--ui-danger,#f38ba8)'}}
                  >
                    {t('removeLogo')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Position */}
          <div>
            <label className="block text-sm font-medium ui-text-2 mb-2">{t('logoPosition')}</label>
            <div className="grid grid-cols-2 gap-2">
              {POSITIONS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setForm((f) => ({ ...f, position: p.id }))}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                    form.position === p.id ? 'ui-primary' : 'ui-bg-4 ui-border ui-text-3 hover:ui-text hover:ui-border-2'
                  }`}
                  style={form.position === p.id
                    ? {borderWidth:1,borderStyle:'solid',borderColor:'var(--ui-primary)'}
                    : {borderWidth:1,borderStyle:'solid'}
                  }
                >
                  {p.label} {t(p.id.replace('-', ''))}
                </button>
              ))}
            </div>
          </div>

          {/* Width */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium ui-text-2">{t('logoWidth')}</label>
              <span className="text-xs ui-text-3">{form.width}px</span>
            </div>
            <input
              type="range" min="20" max="300" step="4"
              value={form.width}
              onChange={(e) => setForm((f) => ({ ...f, width: Number(e.target.value) }))}
              className="w-full"
            />
          </div>

          {/* Opacity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium ui-text-2">{t('logoOpacity')}</label>
              <span className="text-xs ui-text-3">{Math.round(form.opacity * 100)}%</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.05"
              value={form.opacity}
              onChange={(e) => setForm((f) => ({ ...f, opacity: Number(e.target.value) }))}
              className="w-full"
            />
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium ui-text-2">{t('logoEnabled')}</span>
            <button
              onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
              className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
              style={{background: form.enabled ? 'var(--ui-primary)' : 'var(--ui-bg-5,#4a4a5a)'}}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{transform: form.enabled ? 'translateX(22px)' : 'translateX(2px)'}}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium ui-bg-4 border ui-border ui-text-3 hover:ui-text hover:ui-border-2 transition-all"
            style={{borderWidth:1,borderStyle:'solid'}}
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
            style={{background:'var(--ui-primary)'}}
            onMouseEnter={e => e.currentTarget.style.background='var(--ui-primary-h)'}
            onMouseLeave={e => e.currentTarget.style.background='var(--ui-primary)'}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
