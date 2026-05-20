// settings-modal.js — AI configuration dialog

function SettingsModal({ open, onClose, onSave, onHelp, lang }) {
  const [form, setForm] = React.useState({
    apiProvider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com',
    modelName: 'gpt-4o',
  });

  React.useEffect(() => {
    if (open && window.openslides) {
      window.openslides.getSettings().then((s) => {
        if (s) setForm((f) => ({ ...f, ...s }));
      });
    }
  }, [open]);

  const providerPresets = {
    openai:    { baseUrl: 'https://api.openai.com',  modelName: 'gpt-4o' },
    anthropic: { baseUrl: 'https://api.anthropic.com', modelName: 'claude-3-5-sonnet-20241022' },
    litellm:   { baseUrl: 'http://localhost:4000',   modelName: 'gpt-4o' },
  };

  const handleProviderChange = (provider) => {
    const preset = providerPresets[provider] || {};
    setForm((f) => ({ ...f, apiProvider: provider, ...preset }));
  };

  const handleSave = async () => {
    if (window.openslides) await window.openslides.saveSettings(form);
    onSave(form);
    onClose();
  };

  if (!open) return null;

  const inputCls = 'w-full ui-bg-4 border ui-border rounded-lg px-3 py-2 text-sm ui-text ui-text-4 focus:ui-primary-ring transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm no-drag">
      <div className="ui-bg-3 border ui-border rounded-xl shadow-2xl w-full max-w-md p-6 panel-enter" style={{borderWidth:1,borderStyle:'solid'}}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold ui-text">{t('aiSettings')}</h2>
            <p className="text-sm ui-text-3 mt-0.5">{t('configureProvider')}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center ui-text-3 hover:ui-text hover:ui-bg-5 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Provider */}
          <div>
            <label className="block text-sm font-medium ui-text-2 mb-1.5">{t('provider')}</label>
            <div className="grid grid-cols-3 gap-2">
              {['openai', 'anthropic', 'litellm'].map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    form.apiProvider === p
                      ? 'ui-primary'
                      : 'ui-bg-4 ui-border ui-text-3 hover:ui-text hover:ui-border-2'
                  }`}
                  style={form.apiProvider === p ? {borderWidth:1,borderStyle:'solid',borderColor:'var(--ui-primary)'} : {borderWidth:1,borderStyle:'solid'}}
                >
                  {p === 'openai' ? 'OpenAI' : p === 'anthropic' ? 'Anthropic' : 'LiteLLM'}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium ui-text-2 mb-1.5">{t('apiKey')}</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder="sk-..."
              className={inputCls}
              style={{outline:'none'}}
              onFocus={e => e.target.style.boxShadow='0 0 0 2px var(--ui-primary)'}
              onBlur={e => e.target.style.boxShadow=''}
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium ui-text-2 mb-1.5">{t('baseUrl')}</label>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              className={inputCls}
              style={{outline:'none'}}
              onFocus={e => e.target.style.boxShadow='0 0 0 2px var(--ui-primary)'}
              onBlur={e => e.target.style.boxShadow=''}
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium ui-text-2 mb-1.5">{t('model')}</label>
            <input
              type="text"
              value={form.modelName}
              onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
              placeholder="gpt-4o"
              className={inputCls}
              style={{outline:'none'}}
              onFocus={e => e.target.style.boxShadow='0 0 0 2px var(--ui-primary)'}
              onBlur={e => e.target.style.boxShadow=''}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => { onClose(); onHelp?.(); }}
            className="px-4 py-2 rounded-lg text-sm font-medium ui-bg-4 border ui-border ui-text-3 hover:ui-text hover:ui-border-2 transition-all"
            style={{borderWidth:1,borderStyle:'solid'}}
          >
            {t('help')}
          </button>
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
            {t('saveSettings')}
          </button>
        </div>
      </div>
    </div>
  );
}
