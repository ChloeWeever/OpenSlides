// onboarding-modal.js — first-launch welcome guide

function OnboardingModal({ open, onClose, lang }) {
  const [dontShow, setDontShow] = React.useState(false);

  const handleClose = () => {
    if (dontShow) localStorage.setItem('openslides-onboarding-done', '1');
    onClose();
  };

  if (!open) return null;

  const steps = [
    { title: t('onboardingStep1Title'), desc: t('onboardingStep1Desc'), icon: '⚙' },
    { title: t('onboardingStep2Title'), desc: t('onboardingStep2Desc'), icon: '✦' },
    { title: t('onboardingStep3Title'), desc: t('onboardingStep3Desc'), icon: '↑' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm no-drag">
      <div className="ui-bg-3 border ui-border rounded-xl shadow-2xl w-full max-w-lg p-6 panel-enter" style={{borderWidth:1,borderStyle:'solid'}}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold ui-text">{t('onboardingTitle')}</h2>
            <p className="text-xs ui-text-3 mt-1">{t('onboardingSubtitle')}</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center ui-text-3 hover:ui-text hover:ui-bg-5 transition-colors flex-shrink-0 ml-4"
          >✕</button>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-3 mb-5">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-xl ui-bg-4 border ui-border" style={{borderWidth:1,borderStyle:'solid'}}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                style={{background:'rgba(208,64,0,0.12)',color:'var(--ui-primary)'}}>
                {step.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold ui-text mb-0.5">{step.title}</div>
                <div className="text-xs ui-text-3 leading-relaxed">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={e => setDontShow(e.target.checked)}
              className="w-3.5 h-3.5 accent-[color:var(--ui-primary)]"
            />
            <span className="text-xs ui-text-3">{t('onboardingDontShow')}</span>
          </label>
          <button
            onClick={handleClose}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all"
            style={{background:'var(--ui-primary)'}}
            onMouseEnter={e => e.currentTarget.style.background='var(--ui-primary-h)'}
            onMouseLeave={e => e.currentTarget.style.background='var(--ui-primary)'}
          >
            {t('onboardingClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
