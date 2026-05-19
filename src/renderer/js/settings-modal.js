// settings-modal.js — AI configuration dialog (shadcn-style)

function SettingsModal({ open, onClose, onSave }) {
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
    openai: { baseUrl: 'https://api.openai.com', modelName: 'gpt-4o' },
    anthropic: { baseUrl: 'https://api.anthropic.com', modelName: 'claude-3-5-sonnet-20241022' },
    litellm: { baseUrl: 'http://localhost:4000', modelName: 'gpt-4o' },
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm no-drag">
      <div className="bg-[#16161e] border border-[#2a2a3a] rounded-xl shadow-2xl w-full max-w-md p-6 panel-enter">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">AI Settings</h2>
            <p className="text-sm text-[#8888a8] mt-0.5">Configure your LLM provider</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8888a8] hover:text-white hover:bg-[#2a2a3a] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-[#cdd6f4] mb-1.5">Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {['openai', 'anthropic', 'litellm'].map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    form.apiProvider === p
                      ? 'bg-[#6366f1] border-[#6366f1] text-white'
                      : 'bg-[#1c1c28] border-[#2a2a3a] text-[#8888a8] hover:text-white hover:border-[#4a4a6a]'
                  }`}
                >
                  {p === 'openai' ? 'OpenAI' : p === 'anthropic' ? 'Anthropic' : 'LiteLLM'}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-[#cdd6f4] mb-1.5">API Key</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder="sk-..."
              className="w-full bg-[#1c1c28] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a4a6a] focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-all"
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-[#cdd6f4] mb-1.5">Base URL</label>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              className="w-full bg-[#1c1c28] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a4a6a] focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-all"
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-[#cdd6f4] mb-1.5">Model</label>
            <input
              type="text"
              value={form.modelName}
              onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
              placeholder="gpt-4o"
              className="w-full bg-[#1c1c28] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a4a6a] focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[#1c1c28] border border-[#2a2a3a] text-[#8888a8] hover:text-white hover:border-[#4a4a6a] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[#6366f1] text-white hover:bg-[#5254cc] transition-all"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
