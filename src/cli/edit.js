// edit.js — `openslides edit` command
// Strategy: parse exported HTML back into slide objects (solo path), call llm:chat
// equivalent with the SYSTEM_PROMPT, apply the action, re-export.

const fs = require('fs');
const path = require('path');

const config = require('./config');
const { flag } = require('./args');
const { step, fmtDur } = require('./progress');
const { SYSTEM_PROMPT } = require('../core/orchestrate');
const { callLLM, parseJSONResponse } = require('../main/llm-client');
const { buildStandaloneHTML, FONT_IMPORT, SLIDE_CSS } = require('../core/export-html');

// Reverse of HTML attribute escaping used in the exporter:
//   slide.soloHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
function unescapeAttr(s) {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

// Read the prompt — same convention as build
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

// Walk through the document body and pull out every top-level slide-page div.
// Both shapes are produced by the exporter:
//   Template: <div class="slide-container layout-X slide-page" style="…">…</div>
//   Solo:     <div class="slide-page" style="…"><iframe class="solo-iframe" srcdoc="…">…</iframe></div>
// We only depend on this deterministic shape, not a full HTML parser.
function extractSlidePages(html) {
  const pages = [];
  const re = /<div\s+class="[^"]*\bslide-page\b[^"]*"[^>]*>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const start = m.index;
    const openEnd = m.index + m[0].length;
    // Walk forward, tracking nested <div> depth, until we close this slide-page
    let depth = 1;
    let i = openEnd;
    while (i < html.length && depth > 0) {
      const next = html.indexOf('<', i);
      if (next === -1) break;
      // <iframe class="solo-iframe" srcdoc="…"…> — its content is in an attribute, not nested,
      // so we just need to skip past the self-closing-ish tag plus its </iframe>.
      if (html.startsWith('<iframe', next)) {
        const end = html.indexOf('</iframe>', next);
        if (end === -1) break;
        i = end + '</iframe>'.length;
        continue;
      }
      if (html.startsWith('<div', next)) {
        // Move past the entire opening tag
        const tagEnd = html.indexOf('>', next);
        if (tagEnd === -1) break;
        depth++;
        i = tagEnd + 1;
        continue;
      }
      if (html.startsWith('</div', next)) {
        depth--;
        const tagEnd = html.indexOf('>', next);
        if (tagEnd === -1) break;
        i = tagEnd + 1;
        if (depth === 0) {
          pages.push(html.slice(start, i));
          // resume outer search after this slide
          re.lastIndex = i;
          break;
        }
        continue;
      }
      // Some other tag, skip past its '>'
      const tagEnd = html.indexOf('>', next);
      if (tagEnd === -1) break;
      i = tagEnd + 1;
    }
  }
  return pages;
}

// Pull the title from the document's <title> element
function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1] : 'Presentation';
}

// Wrap a template slide's slide-container div into a synthetic standalone HTML document
// so the LLM can edit it like a solo slide. Reuses the exporter's SLIDE_CSS so styling is preserved.
// We keep the slide-container div intact (with its layout-X class and inline style) — that's
// what carries the visual identity. Only the trailing `slide-page` class is stripped because
// the synthetic doc does its own sizing.
function templatePageToSoloHtml(slidePageHtml) {
  // Drop only the cosmetic `slide-page` token from the class list; keep layout-X and slide-container.
  const cleaned = slidePageHtml.replace(
    /(<div\s+class="[^"]*?)\s*\bslide-page\b\s*([^"]*")/,
    '$1$2',
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
${FONT_IMPORT}
<style>
${SLIDE_CSS}
html,body{width:1920px;height:1080px;margin:0;padding:0;overflow:hidden;background:#000;}
.slide-container{width:1920px;height:1080px;}
</style>
</head>
<body>
${cleaned}
</body>
</html>`;
}

// Parse the exported HTML into [{ id, soloHtml }]
function parseDeck(html) {
  const pages = extractSlidePages(html);
  const slides = [];
  pages.forEach((page, i) => {
    const id = `slide-${i + 1}`;
    const iframeMatch = page.match(/<iframe[^>]*\bsrcdoc="([\s\S]*?)"\s*[^>]*sandbox=/);
    if (iframeMatch) {
      slides.push({ id, soloHtml: unescapeAttr(iframeMatch[1]) });
    } else {
      // Template slide — wrap into a synthetic solo document.
      slides.push({ id, soloHtml: templatePageToSoloHtml(page) });
    }
  });
  return slides;
}

// Heuristic: pull the first heading or title-ish line from a soloHtml document for the LLM context
function summarizeSlide(soloHtml) {
  const heading =
    soloHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    soloHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
    soloHtml.match(/<title>([\s\S]*?)<\/title>/i);
  if (!heading) return '(no heading)';
  return heading[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function applyAction(slides, action) {
  if (!action) return { slides, ok: false, msg: 'No action returned.' };
  switch (action.action) {
    case 'update_slide': {
      const idx = slides.findIndex(s => s.id === action.slideId);
      if (idx === -1) return { slides, ok: false, msg: `slideId not found: ${action.slideId}` };
      const next = slides.slice();
      const slide = action.slide || {};
      next[idx] = slide.soloHtml ? { id: slides[idx].id, soloHtml: slide.soloHtml } : { ...slides[idx], ...slide, id: slides[idx].id };
      return { slides: next, ok: true, msg: `updated ${action.slideId}` };
    }
    case 'add_slides': {
      const adds = (action.slides || []).map((s, i) => {
        const id = s.id || `slide-${slides.length + i + 1}`;
        return s.soloHtml ? { id, soloHtml: s.soloHtml } : { ...s, id };
      });
      return { slides: slides.concat(adds), ok: true, msg: `added ${adds.length} slide(s)` };
    }
    case 'delete_slide': {
      const next = slides.filter(s => s.id !== action.slideId);
      if (next.length === slides.length) return { slides, ok: false, msg: `slideId not found: ${action.slideId}` };
      return { slides: next, ok: true, msg: `deleted ${action.slideId}` };
    }
    case 'replace_all': {
      const next = (action.slides || []).map((s, i) => {
        const id = s.id || `slide-${i + 1}`;
        return s.soloHtml ? { id, soloHtml: s.soloHtml } : { ...s, id };
      });
      return { slides: next, ok: true, msg: `replaced with ${next.length} slide(s)` };
    }
    case 'message':
      return { slides, ok: false, msg: `model: ${action.message || '(empty)'}` };
    default:
      return { slides, ok: false, msg: `unsupported action: ${action.action}` };
  }
}

// Same recovery logic as ipc-handlers.js for soloHtml responses that don't parse cleanly
function parseChatResponse(rawText) {
  const parsed = parseJSONResponse(rawText);
  if (parsed) return parsed;
  if (rawText.includes('soloHtml') && rawText.includes('update_slide')) {
    const slideIdM = rawText.match(/"slideId"\s*:\s*"([^"]+)"/);
    const htmlStartIdx = rawText.indexOf('"soloHtml"');
    if (slideIdM && htmlStartIdx !== -1) {
      const valQ = rawText.indexOf('"', htmlStartIdx + 10) + 1;
      const tailIdx = rawText.lastIndexOf('"}');
      if (valQ > 0 && tailIdx > valQ) {
        const html = rawText.slice(valQ, tailIdx)
          .replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
        return { action: 'update_slide', slideId: slideIdM[1], slide: { soloHtml: html } };
      }
    }
  }
  return null;
}

async function run(argv) {
  const cfg = config.load(flag(argv, 'config'));
  const inputPath = argv._[1];
  if (!inputPath) throw new Error('Usage: openslides edit <input.html> -m "<prompt>"');
  const inputAbs = path.resolve(inputPath);
  if (!fs.existsSync(inputAbs)) throw new Error(`Input file not found: ${inputAbs}`);
  const editPrompt = readPrompt(argv);
  const outAbs = path.resolve(flag(argv, 'output', 'o') || inputAbs);

  const html = fs.readFileSync(inputAbs, 'utf8');
  const title = extractTitle(html);
  const slides = parseDeck(html);
  if (!slides.length) throw new Error('No slide-pages found in input. Is this a deck exported by OpenSlides?');
  step(`parsed: ${slides.length} slide(s) from "${title}"`);

  // Build a slides summary for the LLM. Each entry shows the slide id, a heading,
  // and a truncated soloHtml so the model can reason about edits without seeing the entire deck.
  const summary = slides.map(s => ({
    id: s.id,
    heading: summarizeSlide(s.soloHtml),
    soloHtml: s.soloHtml.length > 4000 ? s.soloHtml.slice(0, 4000) + '\n<!-- …truncated… -->' : s.soloHtml,
  }));

  const userMsg = `Edit this presentation. Each slide is an HTML document (soloHtml).

Current slides:
${JSON.stringify(summary, null, 2)}

Edit request:
${editPrompt}

Respond with ONE of: update_slide / add_slides / delete_slide / replace_all.
For update_slide, return the COMPLETE new soloHtml (full <!DOCTYPE html> document).
For add_slides, each new slide must be { "id": "slide-N", "soloHtml": "<full html>" }.`;

  const ctrl = new AbortController();
  const onSig = () => { step('\naborting…'); ctrl.abort(); };
  process.on('SIGINT', onSig);

  step('edit: calling model…');
  const t0 = Date.now();
  let raw;
  try {
    raw = await callLLM(
      [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
      cfg.settings, 16000, ctrl.signal,
    );
  } finally {
    process.off('SIGINT', onSig);
  }
  step(`edit: model responded (${fmtDur(Date.now() - t0)}, ${raw.length} chars)`);

  const action = parseChatResponse(raw);
  const result = applyAction(slides, action);
  if (!result.ok) {
    process.stderr.write(`edit failed: ${result.msg}\n`);
    if (process.env.OPENSLIDES_DEBUG) process.stderr.write(raw.slice(0, 2000) + '\n');
    return 1;
  }
  step(`edit: ${result.msg}`);

  fs.writeFileSync(outAbs, buildStandaloneHTML(result.slides, title, cfg.logo), 'utf8');
  step(`done: ${outAbs}`);
  return 0;
}

module.exports = { run };
