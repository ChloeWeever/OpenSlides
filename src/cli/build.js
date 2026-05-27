// build.js — `openslides build` command
const fs = require('fs');
const path = require('path');

const config = require('./config');
const { flag } = require('./args');
const { step, inline, inlineDone, fmtDur } = require('./progress');
const { loadWorkspace } = require('./workspace');
const { genOutline, genSoloOutline, genTitle } = require('../core/orchestrate');
const { genSlideWithAgent, genSoloSlideWithAgent } = require('../main/agent-client');
const { buildStandaloneHTML } = require('../core/export-html');

function readPrompt(argv) {
  const message = flag(argv, 'message', 'm');
  const file = flag(argv, 'file', 'f');
  if (message && file) throw new Error('Use either -m or -f, not both.');
  if (message && typeof message === 'string') return message;
  if (file) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) throw new Error(`Prompt file not found: ${abs}`);
    return fs.readFileSync(abs, 'utf8').trim();
  }
  throw new Error('No prompt provided. Use -m "<prompt>" or -f <file>.');
}

function safeFilename(s) {
  return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'presentation';
}

async function run(argv) {
  const cfg = config.load(flag(argv, 'config'));
  const useLogo = !(argv.flags['no-logo'] === true || argv.flags.logo === false);
  const logo = useLogo ? cfg.logo : null;

  const mode = (flag(argv, 'mode') || 'solo').toLowerCase();
  if (mode !== 'solo' && mode !== 'template') {
    throw new Error(`Invalid --mode "${mode}". Use solo | template.`);
  }

  const userRequest = readPrompt(argv);

  // Workspace folder (optional)
  let workspaceFiles = [];
  const wsDir = flag(argv, 'workspace', 'w');
  if (wsDir) {
    const ocr = argv.flags.ocr === true;
    step(`workspace: loading ${path.resolve(wsDir)}${ocr ? ' (OCR enabled)' : ''}`);
    workspaceFiles = await loadWorkspace(wsDir, { ocr });
    step(`workspace: ${workspaceFiles.length} file(s) ready`);
  }

  // SIGINT abort
  const ctrl = new AbortController();
  const onSig = () => { step('\naborting…'); ctrl.abort(); };
  process.on('SIGINT', onSig);
  const signal = ctrl.signal;

  try {
    // 1) Outline
    step(`mode: ${mode}`);
    step('outline: generating…');
    const t0 = Date.now();
    const outlineRes = mode === 'solo'
      ? await genSoloOutline({ text: userRequest, workspaceFiles }, cfg.settings, signal)
      : await genOutline(userRequest, cfg.settings, signal);
    if (!outlineRes.success) throw new Error(outlineRes.error);
    const outline = outlineRes.data.slides;
    const theme = outlineRes.data.theme || null;
    step(`outline: ${outline.length} slide(s) (${fmtDur(Date.now() - t0)})`);
    outline.forEach((s, i) => step(`  ${i + 1}. ${s.title || s.id}${s.layout ? ` [${s.layout}]` : ''}`));

    // 2) Per-slide generation
    const finalSlides = [];
    let errors = 0;
    for (let i = 0; i < outline.length; i++) {
      if (signal.aborted) throw new Error('aborted');
      const s = outline[i];
      const label = `[${i + 1}/${outline.length}] ${s.title || s.id}`;
      inline(label + ' …');
      const start = Date.now();
      try {
        const res = mode === 'solo'
          ? await genSoloSlideWithAgent(
              { outlineSlide: s, allOutline: outline, userRequest, slideIndex: i, totalSlides: outline.length, theme, workspaceFiles },
              cfg.settings, signal)
          : await genSlideWithAgent(
              { outlineSlide: s, allOutline: outline, userRequest, slideIndex: i, totalSlides: outline.length },
              cfg.settings, signal);
        if (!res.success) throw new Error(res.error || 'unknown');

        if (mode === 'solo') {
          finalSlides.push({ id: s.id || `slide-${i + 1}`, soloHtml: res.data.html });
        } else {
          const slide = res.data.slides[0];
          finalSlides.push(slide);
        }
        inlineDone(`${label} ✓ (${fmtDur(Date.now() - start)})`);
      } catch (err) {
        errors++;
        inlineDone(`${label} ✗ ${err.message}`);
      }
    }

    if (!finalSlides.length) throw new Error('No slides were generated successfully.');

    // 3) Title
    let title = flag(argv, 'title');
    if (!title) {
      step('title: generating…');
      try {
        title = await genTitle(finalSlides.map((s, i) => outline[i]?.title || `Slide ${i + 1}`), cfg.settings, signal);
      } catch (e) {
        title = outline[0]?.title || 'Presentation';
      }
    }
    step(`title: ${title}`);

    // 4) Export HTML
    const out = flag(argv, 'output', 'o') || `${safeFilename(title)}.html`;
    const outAbs = path.resolve(out);
    fs.writeFileSync(outAbs, buildStandaloneHTML(finalSlides, title, logo), 'utf8');
    step(`done: ${outAbs}${errors ? ` (${errors} slide error(s))` : ''}`);
    return errors ? 1 : 0;
  } finally {
    process.off('SIGINT', onSig);
  }
}

module.exports = { run };
