const { ipcMain, dialog, BrowserWindow } = require('electron');
const store = require('./store');
const { callLLM, parseJSONResponse } = require('./llm-client');
const { genSlideWithAgent, genSoloSlideWithAgent } = require('./agent-client');
const path = require('path');
const fs = require('fs');

// Load diagram renderer assets once at startup (used in HTML/PDF export)
const SLIDE_FRAME_DIR = path.join(__dirname, '../renderer/slide-frame');
let _chartJS = '';
let _diagramRendererJS = '';
try {
  _chartJS = fs.readFileSync(path.join(SLIDE_FRAME_DIR, 'chart.min.js'), 'utf8');
  const slideFrameSrc = fs.readFileSync(path.join(SLIDE_FRAME_DIR, 'slide-frame.js'), 'utf8');
  // Extract CHART_PALETTE + renderDiagram/renderChartJS/renderFlow/renderMindmap
  const start = slideFrameSrc.indexOf('// ── Diagram renderers');
  const end   = slideFrameSrc.indexOf('\n// ─────────────────────', start);
  _diagramRendererJS = start >= 0 ? slideFrameSrc.slice(start, end) : '';
} catch (e) {
  console.warn('Could not load diagram renderer assets:', e.message);
}

// Glue script for exported HTML: reads data-diagram attrs and initialises diagrams.
// themeColors must be a top-level var so renderChartJS/renderFlow/renderMindmap can see it.
const DIAGRAM_INIT_JS = `
var themeColors = { text1:'#cdd6f4', text2:'#a6adc8', text3:'#6c7086', accent:'#89b4fa', border:'rgba(255,255,255,.08)' };
function _resolveThemeColors(container) {
  var cs = getComputedStyle(container);
  var get = function(v, fb) { return cs.getPropertyValue(v).trim() || fb; };
  themeColors = {
    text1:  get('--text-1','#cdd6f4'),
    text2:  get('--text-2','#a6adc8'),
    text3:  get('--text-3','#6c7086'),
    accent: get('--accent','#89b4fa'),
    border: get('--border','rgba(255,255,255,.08)'),
  };
}
document.querySelectorAll('.el-diagram[data-diagram]').forEach(function(el) {
  try {
    var spec = JSON.parse(el.getAttribute('data-diagram'));
    _resolveThemeColors(el.closest('.slide-container') || el);
    renderDiagram(el, spec);
  } catch(e) { console.warn('diagram init error', e); }
});
console.log('__ready__');
`;

const SYSTEM_PROMPT = `You are an AI presentation assistant. You create beautiful, modern slides using a rich design system.

Respond ONLY with valid JSON in one of these formats:

1. Replace all slides: {"action":"replace_all","slides":[...]}
2. Add slides:        {"action":"add_slides","slides":[...]}
3. Update one slide:  {"action":"update_slide","slideId":"<id>","slide":{...}}
   - For Solo slides (soloHtml present): {"action":"update_slide","slideId":"<id>","slide":{"soloHtml":"<complete updated html>"}}
4. Delete a slide:    {"action":"delete_slide","slideId":"<id>"}
5. Chat only:         {"action":"message","message":"<text>"}

## Slide schema
{
  "id": "unique-string",
  "layout": "title" | "content" | "section" | "two-column" | "big-quote" | "blank",
  "background": "#hexcolor",   // default: omit (uses dark theme token)
  "color": "#hexcolor",        // default: omit
  "transition": "slide" | "fade" | "zoom" | "none",
  "sectionNum": 1,             // optional: large watermark number for "section" layout
  "elements": [ ... ]
}

## Element types
{"type":"kicker","text":"EYEBROW LABEL"}
{"type":"heading","text":"Main Title","gradient":true}   // gradient:true for gradient text
{"type":"subheading","text":"Supporting headline"}
{"type":"body","text":"Paragraph text"}
{"type":"bullets","items":["Point one","Point two","Point three"]}
{"type":"divider"}
{"type":"pills","items":["Tag A","Tag B",{"text":"Accent","accent":true}]}
{"type":"image","src":"https://...","alt":"description",
  "width":"60%","height":"300px","align":"center","float":"left",
  "objectFit":"cover","radius":12,"caption":"Figure 1"}
{"type":"images","cols":3,"gap":16,"height":200,"objectFit":"cover","radius":8,"items":[
  {"src":"https://...","alt":"...","caption":"optional"},
  {"src":"https://...","alt":"..."}
]}
{"type":"quote","text":"Inspiring words here.","author":"Name, Title"}
{"type":"stats","items":[
  {"label":"METRIC","value":"42K","delta":"+12%"},
  {"label":"ANOTHER","value":"$1.2M"}
]}
{"type":"cards","cols":3,"items":[
  {"icon":"🚀","title":"Card Title","body":"Card description","accent":true},
  {"icon":"💡","title":"Card Title","body":"Card description"}
]}
{"type":"diagram","kind":"bar","title":"Sales Q1","labels":["Jan","Feb","Mar"],"datasets":[{"label":"Revenue","data":[120,180,90],"color":"#89b4fa"}]}
{"type":"diagram","kind":"line","title":"Growth Trend","labels":["Q1","Q2","Q3","Q4"],"datasets":[{"label":"Users","data":[100,150,210,280]}]}
{"type":"diagram","kind":"pie","title":"Market Share","labels":["Product A","Product B","Product C"],"datasets":[{"data":[45,35,20]}]}
{"type":"diagram","kind":"flow","nodes":[{"id":"a","label":"Start"},{"id":"b","label":"Process"},{"id":"c","label":"End"}],"edges":[{"from":"a","to":"b"},{"from":"b","to":"c"}]}
{"type":"diagram","kind":"mindmap","root":"Main Topic","children":[{"label":"Branch A","children":[{"label":"Sub 1"},{"label":"Sub 2"}]},{"label":"Branch B"},{"label":"Branch C"}]}
{"type":"diagram","kind":"svg","svgHtml":"<svg viewBox='0 0 600 400'>...</svg>"}

## Layout guidance
- "title": center-aligned, use kicker + heading (gradient) + subheading + divider + pills
- "content": left-aligned, use heading + bullets or body or stats or diagram
- "section": full-bleed section break, use kicker + heading + optional sectionNum watermark
- "two-column": splits elements 50/50; great for comparison or text+image
- "big-quote": centered, large quote + author
- "blank": freeform

## Design defaults
Default background: #1e1e2e (dark). Default text: #cdd6f4.
Always create visually rich, well-structured slides. Use gradient headings on title/section slides.
Use kickers to label slide topics. Use dividers to add visual rhythm.
Prefer cards for feature lists, stats for KPI dashboards, pills for tags/tech stacks.
Use the "section" layout with sectionNum for chapter dividers in long presentations.
For diagrams: use bar/line/pie for data visualization, flow for process/architecture, mindmap for concept maps.
When the user asks for a chart, graph, flowchart, architecture diagram, or mind map — use the diagram element.
Use kind:"svg" only as a last resort when none of the built-in kinds fit.`;

// Outline-only prompt: returns a minimal slide list with id/layout/title/notes
const OUTLINE_PROMPT = `You are a presentation planning assistant. Given the user's request, output a minimal slide outline as JSON.

Respond ONLY with raw JSON — no markdown, no explanation:
{"action":"outline","slides":[
  {"id":"slide-1","layout":"title","title":"Slide Title","kicker":"EYEBROW","contentType":"bullets"}
]}

Rules:
- id: "slide-1", "slide-2", … (sequential)
- layout: title | content | section | two-column | big-quote | blank
- title: the real heading text for this slide (not a placeholder)
- kicker: 2-4 ALL-CAPS words (topic label)
- contentType: bullets | cards | stats | diagram | quote | body | pills
- Each slide is ONE short JSON object on ONE line — no extra fields, no nesting
- Do NOT add notes, subheading, contentHint, or any other field
- Aim for 6-12 slides unless the request clearly needs more or fewer`;

ipcMain.handle('llm:outline', async (_event, userRequest, settings) => {
  try {
    const messages = [
      { role: 'system', content: OUTLINE_PROMPT },
      { role: 'user', content: userRequest },
    ];
    const rawText = await callLLM(messages, settings, 16000);
    const parsed = parseJSONResponse(rawText);
    if (!parsed) return { success: false, error: `JSON解析失败，原始响应：${rawText.slice(0, 300)}` };
    const slides = parsed.slides || parsed;
    if (!Array.isArray(slides) || !slides.length) {
      return { success: false, error: `大纲格式错误，原始响应：${rawText.slice(0, 300)}` };
    }
    return { success: true, data: { action: 'outline', slides }, raw: rawText };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('llm:gen-slide', async (_event, { outlineSlide, allOutline, userRequest, slideIndex, totalSlides }, settings) => {
  try {
    return await genSlideWithAgent({ outlineSlide, allOutline, userRequest, slideIndex, totalSlides }, settings);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

const SOLO_OUTLINE_PROMPT = `You are a presentation planning assistant. Given the user's request, output a slide outline as JSON.

Respond ONLY with raw JSON — no markdown, no explanation:
{
  "action": "outline",
  "theme": {
    "bg": "#0f0f1a",
    "accent": "#6c63ff",
    "text": "#ffffff",
    "subtext": "#a0a0b8",
    "font": "Inter, Arial, sans-serif",
    "style": "dark modern gradient"
  },
  "slides": [
    {
      "id": "slide-1",
      "title": "Slide Title",
      "notes": "Key points and content for this slide",
      "style": "hero — large headline, bold accent color, minimal elements"
    }
  ]
}

Rules:
- theme: ONE consistent design system for the whole deck. Choose colors and font that suit the topic. style = 2-4 descriptive words (e.g. "dark tech minimal", "bright clean corporate", "bold colorful startup")
- id: "slide-1", "slide-2", … (sequential)
- title: the real heading text for this slide
- notes: 1-3 sentences describing what this slide should cover
- style (per slide): layout + mood hint for the designer, e.g. "hero full-bleed", "two-column data", "big quote centered", "icon grid", "timeline horizontal", "chart + callout"
- Aim for 6-12 slides unless the request clearly needs more or fewer`;

// solo-slide generation is handled by agent-client.js (LangGraph tool calling)

ipcMain.handle('llm:solo-outline', async (_event, { text, settings }) => {
  try {
    const messages = [
      { role: 'system', content: SOLO_OUTLINE_PROMPT },
      { role: 'user', content: text },
    ];
    const rawText = await callLLM(messages, settings, 16000);
    const parsed = parseJSONResponse(rawText);
    if (!parsed) return { success: false, error: `JSON parse failed: ${rawText.slice(0, 300)}` };
    const slides = parsed.slides || parsed;
    if (!Array.isArray(slides) || !slides.length) {
      return { success: false, error: `Outline format error: ${rawText.slice(0, 300)}` };
    }
    const theme = parsed.theme || null;
    return { success: true, data: { action: 'outline', slides, theme }, raw: rawText };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('llm:solo-slide', async (_event, { outlineSlide, allOutline, userRequest, slideIndex, totalSlides, theme, settings }) => {
  try {
    return await genSoloSlideWithAgent({ outlineSlide, allOutline, userRequest, slideIndex, totalSlides, theme }, settings);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('llm:chat', async (_event, messages, settings) => {
  try {
    const allMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
    const rawText = await callLLM(allMessages, settings);
    const parsed = parseJSONResponse(rawText);
    // If still null but rawText looks like an update_slide with soloHtml, try harder
    if (!parsed && rawText.includes('soloHtml') && rawText.includes('update_slide')) {
      const slideIdM = rawText.match(/"slideId"\s*:\s*"([^"]+)"/);
      const htmlStartIdx = rawText.indexOf('"soloHtml"');
      if (slideIdM && htmlStartIdx !== -1) {
        // Find the opening quote of the value
        const valQ = rawText.indexOf('"', htmlStartIdx + 10) + 1;
        // The html value ends at the last }" in the response
        const tailIdx = rawText.lastIndexOf('"}');
        if (valQ > 0 && tailIdx > valQ) {
          const rawVal = rawText.slice(valQ, tailIdx);
          const html = rawVal.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
          return { success: true, data: { action: 'update_slide', slideId: slideIdM[1], slide: { soloHtml: html } }, raw: rawText };
        }
      }
    }
    return { success: true, data: parsed, raw: rawText };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings:get', () => {
  return {
    apiProvider: store.get('apiProvider'),
    apiKey: store.get('apiKey'),
    baseUrl: store.get('baseUrl'),
    modelName: store.get('modelName'),
  };
});

ipcMain.handle('settings:save', (_event, settings) => {
  store.set('apiProvider', settings.apiProvider);
  store.set('apiKey', settings.apiKey);
  store.set('baseUrl', settings.baseUrl);
  store.set('modelName', settings.modelName);
  return true;
});

ipcMain.handle('logo:get', () => store.get('logo', null));
ipcMain.handle('logo:save', (_event, logo) => { store.set('logo', logo); return true; });

ipcMain.handle('presentation:save', (_event, data) => {
  store.set('presentation', data);
  return true;
});

ipcMain.handle('presentation:load', () => {
  return store.get('presentation') ?? null;
});

// Sessions: list of { id, title, createdAt, slides, messages }
ipcMain.handle('sessions:list', () => {
  return store.get('sessions') ?? [];
});

ipcMain.handle('sessions:save', (_event, session) => {
  const sessions = store.get('sessions') ?? [];
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  store.set('sessions', sessions);
  return true;
});

ipcMain.handle('sessions:delete', (_event, id) => {
  const sessions = (store.get('sessions') ?? []).filter((s) => s.id !== id);
  store.set('sessions', sessions);
  return true;
});

ipcMain.handle('image:pick', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Select Image',
    filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','gif','webp','svg'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { success: false };
  try {
    const data = fs.readFileSync(filePaths[0]);
    const ext = path.extname(filePaths[0]).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    const dataUrl = `data:${mime};base64,${data.toString('base64')}`;
    return { success: true, dataUrl, name: path.basename(filePaths[0]) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});



function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderElements(elements, layout, sectionNum) {
  const renderEl = (el) => {
    switch (el.type) {
      case 'kicker':
        return `<div class="el-kicker">${escHtml(el.text)}</div>`;
      case 'heading':
        return `<h1 class="el-heading${el.gradient?' gradient':''}">${escHtml(el.text)}</h1>`;
      case 'subheading':
        return `<h2 class="el-subheading">${escHtml(el.text)}</h2>`;
      case 'body':
        return `<p class="el-body">${escHtml(el.text)}</p>`;
      case 'bullets':
        return `<ul class="el-bullets">${(el.items||[]).map(i=>`<li>${escHtml(i)}</li>`).join('')}</ul>`;
      case 'image': {
        const iw = el.width  ? ` width="${escHtml(String(el.width))}"` : '';
        const ih = el.height ? ` height="${escHtml(String(el.height))}"` : '';
        const ir = el.radius != null ? ` style="border-radius:${escHtml(String(el.radius))}${typeof el.radius==='number'?'px':''};object-fit:${el.objectFit||'contain'}"` : el.objectFit ? ` style="object-fit:${el.objectFit}"` : '';
        const align = el.align || 'center';
        const float = el.float;
        const wrapStyle = float
          ? `float:${float};margin:0 ${float==='left'?'16px 8px 0':'0 8px 0 16px'};`
          : `display:flex;flex-direction:column;align-items:${align==='left'?'flex-start':align==='right'?'flex-end':'center'};width:${el.width||'100%'};`;
        const img = `<img class="el-image" src="${escHtml(el.src)}" alt="${escHtml(el.alt||'')}"${iw}${ih}${ir}/>`;
        const cap = el.caption ? `<div class="el-image-caption">${escHtml(el.caption)}</div>` : '';
        return `<div class="el-image-wrap" style="${wrapStyle}">${img}${cap}</div>`;
      }
      case 'images': {
        const cols = el.cols || (el.items||[]).length || 2;
        const gap = el.gap != null ? (typeof el.gap==='number'?`${el.gap}px`:el.gap) : '12px';
        const items = (el.items||[]).map(item => {
          const h = item.height || el.height;
          const hStyle = h ? `height:${typeof h==='number'?`${h}px`:h};` : '';
          const r = item.radius ?? el.radius;
          const rStyle = r != null ? `border-radius:${typeof r==='number'?`${r}px`:r};` : '';
          const fit = item.objectFit || el.objectFit || 'cover';
          const cap2 = item.caption ? `<div class="el-image-caption">${escHtml(item.caption)}</div>` : '';
          return `<div class="el-images-grid-item"><img class="el-image" src="${escHtml(item.src)}" alt="${escHtml(item.alt||'')}" style="width:100%;object-fit:${fit};${hStyle}${rStyle}"/>${cap2}</div>`;
        }).join('');
        return `<div class="el-images-grid" style="grid-template-columns:repeat(${Math.min(cols,6)},1fr);gap:${gap};">${items}</div>`;
      }      case 'divider':
        return `<div class="el-divider"></div>`;
      case 'pills': {
        const pills = (el.items||[]).map(item => {
          const text = typeof item === 'string' ? item : item.text;
          const cls = (typeof item === 'object' && item.accent) ? 'el-pill accent' : 'el-pill';
          return `<span class="${cls}">${escHtml(text)}</span>`;
        }).join('');
        return `<div class="el-pills">${pills}</div>`;
      }
      case 'quote':
        return `<blockquote class="el-quote">${escHtml(el.text)}</blockquote>`
          + (el.author ? `<div class="el-quote-author">— ${escHtml(el.author)}</div>` : '');
      case 'stats': {
        const stats = (el.items||[]).map(s => {
          const delta = s.delta != null
            ? `<div class="stat-delta${String(s.delta).startsWith('-')?' down':''}">${escHtml(String(s.delta))}</div>` : '';
          return `<div class="el-stat">`
            + (s.label ? `<div class="stat-label">${escHtml(s.label)}</div>` : '')
            + `<div class="stat-value">${escHtml(String(s.value))}</div>${delta}</div>`;
        }).join('');
        return `<div class="el-stats">${stats}</div>`;
      }
      case 'cards': {
        const cols = el.cols || (el.items||[]).length || 3;
        const cards = (el.items||[]).map(card => {
          const cls = card.accent ? 'el-card el-card-accent' : 'el-card';
          return `<div class="${cls}">`
            + (card.icon ? `<div class="card-icon">${escHtml(card.icon)}</div>` : '')
            + (card.title ? `<div class="card-title">${escHtml(card.title)}</div>` : '')
            + (card.body ? `<div class="card-body">${escHtml(card.body)}</div>` : '')
            + `</div>`;
        }).join('');
        return `<div class="el-cards cols-${Math.min(cols,4)}">${cards}</div>`;
      }
      case 'diagram':
        return `<div class="el-diagram" data-diagram='${JSON.stringify(el).replace(/'/g, '&#39;')}'></div>`;
      default: return '';
    }
  };

  const sectionNumHtml = (layout === 'section' && sectionNum != null)
    ? `<div class="el-section-num">${escHtml(String(sectionNum))}</div>` : '';

  if (layout === 'two-column') {
    const half = Math.ceil((elements||[]).length / 2);
    return sectionNumHtml
      + `<div class="col">${(elements||[]).slice(0,half).map(renderEl).join('')}</div>`
      + `<div class="col">${(elements||[]).slice(half).map(renderEl).join('')}</div>`;
  }
  return sectionNumHtml + (elements||[]).map(renderEl).join('');
}

// Shared CSS for HTML/PDF export — uses CSS variables so themes are respected
const SLIDE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700;800;900&family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --accent:#89b4fa;--accent-2:#cba6f7;--accent-3:#f38ba8;
  --grad:linear-gradient(135deg,#89b4fa,#cba6f7 55%,#f38ba8);
  --grad-soft:linear-gradient(135deg,rgba(137,180,250,.15),rgba(203,166,247,.12) 55%,rgba(243,139,168,.1));
  --surface:rgba(137,180,250,.08);--surface-2:rgba(203,166,247,.08);
  --border:rgba(255,255,255,.08);
  --text-1:#cdd6f4;--text-2:#a6adc8;--text-3:#6c7086;
  --good:#a6e3a1;--bad:#f38ba8;--radius:14px;
}
body{font-family:'Inter','Noto Sans SC',system-ui,sans-serif;-webkit-font-smoothing:antialiased;color:var(--text-1);}
.slide-container{
  width:100%;height:100%;
  display:flex;flex-direction:column;
  justify-content:center;align-items:center;
  padding:56px 80px;overflow:hidden;gap:0;
}
.layout-title{text-align:center;align-items:center;gap:20px;}
.layout-content{align-items:flex-start;gap:22px;}
.layout-section{text-align:center;align-items:center;justify-content:center;gap:16px;}
.layout-two-column{flex-direction:row;align-items:flex-start;gap:56px;}
.layout-two-column .col{flex:1;display:flex;flex-direction:column;gap:18px;min-width:0;}
.layout-big-quote{text-align:center;align-items:center;justify-content:center;gap:24px;padding:64px 120px;}
.layout-blank{align-items:flex-start;gap:20px;}
.el-kicker{font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);opacity:0.9;}
.el-heading{font-size:clamp(36px,6vw,72px);font-weight:800;line-height:1.05;letter-spacing:-0.03em;color:var(--text-1);}
.el-heading.gradient{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.el-subheading{font-size:clamp(18px,2.4vw,30px);font-weight:300;line-height:1.5;color:var(--text-2);}
.el-body{font-size:clamp(15px,1.7vw,20px);line-height:1.75;color:var(--text-2);max-width:80ch;}
.el-bullets{list-style:none;display:flex;flex-direction:column;gap:10px;width:100%;align-self:flex-start;}
.el-bullets li{font-size:clamp(14px,1.7vw,20px);line-height:1.55;color:var(--text-1);padding-left:1.6em;position:relative;}
.el-bullets li::before{content:'▸';position:absolute;left:0;color:var(--accent);opacity:0.8;}
.el-image-wrap{max-width:100%;}
.el-image{max-width:100%;object-fit:contain;border-radius:var(--radius);display:block;}
.el-image-caption{font-size:11px;color:var(--text-3);text-align:center;margin-top:6px;font-style:italic;}
.el-images-grid{display:grid;width:100%;align-self:stretch;}
.el-images-grid-item{display:flex;flex-direction:column;gap:4px;min-width:0;}
.el-images-grid-item .el-image{max-height:none;width:100%;}
.el-divider{height:3px;width:56px;background:var(--accent);border-radius:2px;align-self:flex-start;}
.layout-title .el-divider,.layout-section .el-divider,.layout-big-quote .el-divider{align-self:center;}
.el-pills{display:flex;flex-wrap:wrap;gap:8px;align-self:flex-start;}
.layout-title .el-pills{align-self:center;}
.el-pill{display:inline-flex;align-items:center;padding:4px 14px;border-radius:999px;font-size:12px;font-weight:500;background:var(--surface-2);color:var(--text-2);border:1px solid var(--border);}
.el-pill.accent{background:var(--surface);color:var(--accent);border-color:var(--accent);}
.el-cards{display:grid;gap:16px;width:100%;align-self:stretch;}
.el-cards.cols-2{grid-template-columns:repeat(2,1fr);}
.el-cards.cols-3{grid-template-columns:repeat(3,1fr);}
.el-cards.cols-4{grid-template-columns:repeat(4,1fr);}
.el-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px 22px;display:flex;flex-direction:column;gap:8px;}
.el-card-accent{border-top:3px solid var(--accent);}
.el-card .card-icon{font-size:24px;margin-bottom:4px;}
.el-card .card-title{font-size:clamp(14px,1.6vw,18px);font-weight:600;color:var(--text-1);letter-spacing:-0.01em;}
.el-card .card-body{font-size:clamp(12px,1.3vw,15px);color:var(--text-2);line-height:1.6;}
.el-stats{display:flex;gap:32px;align-self:flex-start;width:100%;}
.el-stat{display:flex;flex-direction:column;gap:4px;}
.el-stat .stat-label{font-size:12px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);}
.el-stat .stat-value{font-size:clamp(36px,5vw,60px);font-weight:800;line-height:1;letter-spacing:-0.03em;color:var(--text-1);}
.el-stat .stat-delta{font-size:13px;font-weight:500;color:var(--good);}
.el-stat .stat-delta.down{color:var(--bad);}
.el-quote{font-size:clamp(22px,3.5vw,44px);font-weight:400;font-style:italic;line-height:1.45;color:var(--text-1);text-align:center;max-width:75ch;position:relative;}
.el-quote::before{content:'\\201C';font-size:5em;line-height:0;vertical-align:-.45em;color:var(--accent);opacity:0.5;margin-right:0.1em;}
.el-quote-author{font-size:clamp(13px,1.4vw,16px);font-weight:500;letter-spacing:.06em;color:var(--text-3);text-transform:uppercase;text-align:center;}
.el-section-num{font-size:clamp(80px,14vw,160px);font-weight:900;line-height:1;background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;opacity:0.25;position:absolute;top:50%;left:50%;transform:translate(-50%,-54%);pointer-events:none;user-select:none;}
.layout-section>:not(.el-section-num){position:relative;z-index:1;}
.el-diagram{width:100%;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;border-radius:var(--radius);overflow:hidden;}
.el-diagram svg{max-width:100%;max-height:45%;}
`;



function themeVarsStyle(tv) {
  if (!tv) return '';
  return [
    tv.accent    ? `--accent:${tv.accent}`     : '',
    tv.accent2   ? `--accent-2:${tv.accent2}`  : '',
    tv.accent3   ? `--accent-3:${tv.accent3}`  : '',
    tv.grad      ? `--grad:${tv.grad}`          : '',
    tv.gradSoft  ? `--grad-soft:${tv.gradSoft}` : '',
    tv.surface   ? `--surface:${tv.surface}`    : '',
    tv.surface2  ? `--surface-2:${tv.surface2}` : '',
    tv.border    ? `--border:${tv.border}`      : '',
    tv.text1     ? `--text-1:${tv.text1}`       : '',
    tv.text2     ? `--text-2:${tv.text2}`       : '',
    tv.text3     ? `--text-3:${tv.text3}`       : '',
  ].filter(Boolean).join(';');
}

function buildSlideDiv(slide, extraClass, logo) {
  if (slide.soloHtml) {
    const escaped = slide.soloHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const cls = extraClass && extraClass !== 'slide-page' ? ` ${extraClass}` : '';
    return `<div class="slide-page${cls}" style="padding:0;overflow:hidden;align-items:center;justify-content:center;">`
      + `<iframe class="solo-iframe" srcdoc="${escaped}" style="width:1920px;height:1080px;border:none;display:block;flex-shrink:0;transform-origin:center center;" sandbox="allow-scripts allow-same-origin"></iframe>`
      + `</div>`;
  }
  const bg = slide.background || '#1e1e2e';
  const color = slide.color || '#cdd6f4';
  const layout = slide.layout || 'content';
  const inner = renderElements(slide.elements, layout, slide.sectionNum);
  const tv = themeVarsStyle(slide.themeVars);
  const style = `background:${bg};color:${color}${tv ? ';' + tv : ''}`;
  const logoHtml = (logo?.enabled && logo?.dataUrl) ? buildLogoHtml(logo) : '';
  return `<div class="slide-container layout-${layout}${extraClass?' '+extraClass:''}" style="${style}">${inner}${logoHtml}</div>`;
}

function buildLogoHtml(logo) {
  const pos = logo.position || 'bottom-right';
  const pad = '16px';
  const top  = pos.includes('top')  ? `top:${pad}`  : `bottom:${pad}`;
  const side = pos.includes('left') ? `left:${pad}` : `right:${pad}`;
  return `<img src="${logo.dataUrl}" style="position:absolute;z-index:10;pointer-events:none;width:${logo.width||80}px;opacity:${logo.opacity??1};${top};${side};" alt="logo"/>`;
}

function buildStandaloneHTML(slides, title, logo) {
  const slideBlocks = slides.map(s => buildSlideDiv(s, 'slide-page', logo)).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${escHtml(title||'Presentation')}</title>
<style>
${SLIDE_CSS}
html,body{width:100%;height:100%;overflow:hidden;background:#000;}
.slide-page{display:none;position:fixed;inset:0;}
.slide-page.active{display:flex;}
#controls{
  position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
  display:flex;align-items:center;gap:12px;
  background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);
  border:1px solid rgba(255,255,255,0.15);border-radius:999px;
  padding:8px 20px;z-index:100;transition:opacity 0.3s;
}
#controls.hidden{opacity:0;pointer-events:none;}
#controls button{
  background:rgba(255,255,255,0.1);border:none;color:#fff;
  width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;
  display:flex;align-items:center;justify-content:center;transition:background 0.15s;
}
#controls button:hover{background:rgba(255,255,255,0.25);}
#controls button:disabled{opacity:0.3;cursor:not-allowed;}
#counter{color:rgba(255,255,255,0.75);font-family:monospace;font-size:13px;min-width:52px;text-align:center;}
#progress{position:fixed;bottom:0;left:0;right:0;height:3px;display:flex;gap:2px;padding:0 2px;z-index:99;}
.prog-seg{flex:1;background:rgba(255,255,255,0.2);border-radius:2px;cursor:pointer;transition:background 0.2s;}
.prog-seg.active{background:rgba(255,255,255,0.9);}
</style>
</head>
<body>
${slideBlocks}
<div id="progress">${slides.map((_,i)=>`<div class="prog-seg" onclick="goTo(${i})"></div>`).join('')}</div>
<div id="controls">
  <button id="btn-prev" onclick="prev()">&#8249;</button>
  <span id="counter">1 / ${slides.length}</span>
  <button id="btn-next" onclick="next()">&#8250;</button>
</div>
<script>
var idx=0,total=${slides.length},hideTimer;
var pages=document.querySelectorAll('.slide-page');
var segs=document.querySelectorAll('.prog-seg');
var ctrl=document.getElementById('controls');
function show(i){
  pages.forEach(function(p,j){p.classList.toggle('active',j===i);});
  segs.forEach(function(s,j){s.classList.toggle('active',j===i);});
  document.getElementById('counter').textContent=(i+1)+' / '+total;
  document.getElementById('btn-prev').disabled=(i===0);
  document.getElementById('btn-next').disabled=(i===total-1);
}
function next(){if(idx<total-1){idx++;show(idx);}}
function prev(){if(idx>0){idx--;show(idx);}}
function goTo(i){idx=i;show(idx);}
function resetHide(){
  ctrl.classList.remove('hidden');
  clearTimeout(hideTimer);
  hideTimer=setTimeout(function(){ctrl.classList.add('hidden');},3000);
}
document.addEventListener('mousemove',resetHide);
document.addEventListener('keydown',function(e){
  if(e.key==='ArrowRight'||e.key==='ArrowDown'||e.key===' '||e.key==='PageDown'){e.preventDefault();next();}
  else if(e.key==='ArrowLeft'||e.key==='ArrowUp'||e.key==='PageUp'){e.preventDefault();prev();}
});
document.addEventListener('click',function(e){
  if(e.target.closest('#controls')||e.target.closest('#progress'))return;
  if(e.clientX>window.innerWidth*0.6)next();
  else if(e.clientX<window.innerWidth*0.4)prev();
});
show(0);resetHide();
function scaleSoloIframes(){
  var iframes=document.querySelectorAll('.solo-iframe');
  var s=Math.min(window.innerWidth/1920,window.innerHeight/1080);
  iframes.forEach(function(f){f.style.transform='scale('+s+')';});
}
scaleSoloIframes();
window.addEventListener('resize',scaleSoloIframes);
</script>
${_chartJS ? `<script>${_chartJS}</script>` : ''}
${_diagramRendererJS ? `<script>${_diagramRendererJS}\n${DIAGRAM_INIT_JS}</script>` : ''}
</body>
</html>`;
}

ipcMain.handle('export:html', async (_event, { slides, title }) => {
  const win = BrowserWindow.getFocusedWindow();
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Export as HTML',
    defaultPath: `${title||'presentation'}.html`,
    filters: [{ name: 'HTML File', extensions: ['html'] }],
  });
  if (canceled || !filePath) return { success: false };
  try {
    const logo = store.get('logo', null);
    fs.writeFileSync(filePath, buildStandaloneHTML(slides, title, logo), 'utf8');
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export:pdf', async (_event, { slides, title }) => {
  const win = BrowserWindow.getFocusedWindow();
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Export as PDF',
    defaultPath: `${title||'presentation'}.pdf`,
    filters: [{ name: 'PDF File', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { success: false };

  const W = 1920, H = 1080;

  // Single offscreen window, single page load for all slides
  const offscreen = new BrowserWindow({
    width: W, height: H,
    x: -W - 100, y: 0,
    frame: false, skipTaskbar: true,
    webPreferences: { contextIsolation: true, deviceScaleFactor: 1 },
  });
  offscreen.showInactive();

  try {
    // Build one HTML containing every slide; show only one at a time
    const html = buildAllSlidesHTML(slides, W, H);
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);

    // Wait for page load + diagram init signal
    await new Promise((resolve, reject) => {
      let settled = false;
      const onConsole = (_e, _level, message) => {
        if (message === '__ready__' && !settled) { settled = true; cleanup(); resolve(); }
      };
      const onLoad = () => {
        if (!settled) setTimeout(() => { if (!settled) { settled = true; cleanup(); resolve(); } }, 300);
      };
      const onFail = (_, code, desc) => { cleanup(); reject(new Error(desc || 'load failed')); };
      function cleanup() {
        offscreen.webContents.removeListener('console-message', onConsole);
        offscreen.webContents.removeListener('did-finish-load', onLoad);
        offscreen.webContents.removeListener('did-fail-load', onFail);
      }
      offscreen.webContents.on('console-message', onConsole);
      offscreen.webContents.once('did-finish-load', onLoad);
      offscreen.webContents.once('did-fail-load', onFail);
      offscreen.loadURL(dataUrl);
    });

    // Capture each slide by showing it and screenshotting
    const jpegs = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (slide.soloHtml) {
        // Solo slide: open a dedicated offscreen window, load the full HTML document,
        // wait for did-finish-load, then capturePage — same approach as template slides.
        const soloWin = new BrowserWindow({
          width: W, height: H,
          x: -W - 100, y: 0,
          frame: false, skipTaskbar: true,
          webPreferences: { contextIsolation: true, deviceScaleFactor: 1 },
        });
        soloWin.showInactive();
        try {
          await new Promise((resolve, reject) => {
            let settled = false;
            const done = () => { if (!settled) { settled = true; resolve(); } };
            soloWin.webContents.once('did-finish-load', () => setTimeout(done, 120));
            soloWin.webContents.once('did-fail-load', (_, code, desc) => reject(new Error(desc || 'solo load failed')));
            setTimeout(() => reject(new Error('solo slide load timeout')), 10000);
            soloWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(slide.soloHtml));
          });
          const image = await soloWin.webContents.capturePage({ x: 0, y: 0, width: W, height: H });
          jpegs.push(image.toJPEG(92));
        } finally {
          soloWin.destroy();
        }
      } else {
        await offscreen.webContents.executeJavaScript(`
          document.querySelectorAll('.slide-page').forEach(function(el, j) {
            el.style.display = j === ${i} ? 'flex' : 'none';
          });
        `);
        await offscreen.webContents.executeJavaScript(
          'new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); })'
        );
        const image = await offscreen.webContents.capturePage({ x: 0, y: 0, width: W, height: H });
        jpegs.push(image.toJPEG(92));
      }
    }

    const pdfBytes = buildPDFFromJPEGs(jpegs, W, H);
    fs.writeFileSync(filePath, pdfBytes);
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    offscreen.destroy();
  }
});

// Render a single slide as a full-page HTML
function buildSingleSlideHTML(slide, w, h) {
  const bg = slide.background || '#1e1e2e';
  const color = slide.color || '#cdd6f4';
  const layout = slide.layout || 'content';
  const inner = renderElements(slide.elements, layout, slide.sectionNum);
  const tv = themeVarsStyle(slide.themeVars);
  const style = `background:${bg};color:${color}${tv ? ';' + tv : ''}`;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
${SLIDE_CSS}
html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;}
.slide-container{position:absolute;inset:0;}
</style></head>
<body>
<div class="slide-container layout-${layout}" style="${style}">${inner}</div>
${_chartJS ? `<script>${_chartJS}</script>` : ''}
${_diagramRendererJS ? `<script>${_diagramRendererJS}\n${DIAGRAM_INIT_JS}</script>` : ''}
</body>
</html>`;
}

// Single HTML with all slides — used by PDF export to avoid reloading per slide
function buildAllSlidesHTML(slides, w, h) {
  const pages = slides.map((s, i) => {
    const display = `display:${i === 0 ? 'flex' : 'none'};position:absolute;inset:0;`;
    if (s.soloHtml) {
      const escaped = s.soloHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      return `<div class="slide-page" style="${display}">`
        + `<iframe srcdoc="${escaped}" style="width:${w}px;height:${h}px;border:none;display:block;" sandbox="allow-scripts allow-same-origin"></iframe>`
        + `</div>`;
    }
    const bg = s.background || '#1e1e2e';
    const color = s.color || '#cdd6f4';
    const layout = s.layout || 'content';
    const inner = renderElements(s.elements, layout, s.sectionNum);
    const tv = themeVarsStyle(s.themeVars);
    const style = `background:${bg};color:${color}${tv ? ';' + tv : ''}`;
    return `<div class="slide-page" style="${display}">`
      + `<div class="slide-container layout-${layout}" style="${style}">${inner}</div>`
      + `</div>`;
  }).join('\n');

  // DIAGRAM_INIT_JS already ends with console.log('__ready__')
  const diagScript = _diagramRendererJS
    ? `<script>${_diagramRendererJS}\n${DIAGRAM_INIT_JS}</script>`
    : `<script>console.log('__ready__');</script>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
${SLIDE_CSS}
html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;background:#000;}
</style></head>
<body>
${pages}
${_chartJS ? `<script>${_chartJS}</script>` : ''}
${diagScript}
</body>
</html>`;
}

// Read actual pixel dimensions from a JPEG buffer (SOF marker)
function jpegDimensions(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    const segLen = buf.readUInt16BE(i + 2);
    // SOF markers: 0xC0–0xC3, 0xC5–0xC7, 0xC9–0xCB, 0xCD–0xCF
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + segLen;
  }
  return null;
}

// Minimal pure-JS PDF builder — embeds each JPEG as a full-page image
function buildPDFFromJPEGs(jpegs, w, h) {
  // PDF page size in points — use 16:9 at 72 dpi (presentation standard)
  const pw = Math.round(w * 72 / 96);  // 1440
  const ph = Math.round(h * 72 / 96);  // 810

  const parts = [];
  const offsets = [];

  const add = (str) => parts.push(Buffer.isBuffer(str) ? str : Buffer.from(str, 'latin1'));
  const pos = () => parts.reduce((s, b) => s + b.length, 0);

  add('%PDF-1.4\n');

  const imageObjNums = [];
  const pageObjNums = [];
  const catalogObjNum = 1;
  const pagesObjNum = 2;
  let nextObj = 3;

  // Write image + page objects for each slide
  for (let i = 0; i < jpegs.length; i++) {
    const imgNum = nextObj++;
    const pageNum = nextObj++;
    imageObjNums.push(imgNum);
    pageObjNums.push(pageNum);

    // Read actual pixel dimensions from JPEG — capturePage on HiDPI returns 2x pixels
    const imgData = jpegs[i];
    const dims = jpegDimensions(imgData);
    const iw = dims ? dims.w : w;
    const ih = dims ? dims.h : h;

    // Image object
    offsets[imgNum] = pos();
    add(`${imgNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} `
      + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgData.length} >>\nstream\n`);
    add(imgData);
    add('\nendstream\nendobj\n');

    // Page object
    offsets[pageNum] = pos();
    add(`${pageNum} 0 obj\n`
      + `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${pw} ${ph}] `
      + `/Resources << /XObject << /Im${i} ${imgNum} 0 R >> >> `
      + `/Contents ${pageNum + 1} 0 R >>\nendobj\n`);

    // Content stream: draw image filling the page
    const contentNum = nextObj++;
    const stream = `q ${pw} 0 0 ${ph} 0 0 cm /Im${i} Do Q`;
    offsets[contentNum] = pos();
    add(`${contentNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  }

  // Catalog
  offsets[catalogObjNum] = pos();
  add(`${catalogObjNum} 0 obj\n<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>\nendobj\n`);

  // Pages
  offsets[pagesObjNum] = pos();
  add(`${pagesObjNum} 0 obj\n<< /Type /Pages /Kids [`
    + pageObjNums.map(n => `${n} 0 R`).join(' ')
    + `] /Count ${pageObjNums.length} >>\nendobj\n`);

  // xref
  const xrefPos = pos();
  const totalObjs = nextObj;
  add(`xref\n0 ${totalObjs}\n`);
  add('0000000000 65535 f \n');
  for (let i = 1; i < totalObjs; i++) {
    add(String(offsets[i] || 0).padStart(10, '0') + ' 00000 n \n');
  }
  add(`trailer\n<< /Size ${totalObjs} /Root ${catalogObjNum} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  return Buffer.concat(parts);
}
