const { ipcMain, dialog, BrowserWindow } = require('electron');
const store = require('./store');
const { callLLM, parseJSONResponse } = require('./llm-client');
const path = require('path');
const fs = require('fs');

const SYSTEM_PROMPT = `You are an AI presentation assistant. You create beautiful, modern slides using a rich design system.

Respond ONLY with valid JSON in one of these formats:

1. Replace all slides: {"action":"replace_all","slides":[...]}
2. Add slides:        {"action":"add_slides","slides":[...]}
3. Update one slide:  {"action":"update_slide","slideId":"<id>","slide":{...}}
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

// Per-slide prompt: generates one complete slide given its outline entry
const SLIDE_GEN_PROMPT = `You are a presentation slide designer. Generate ONE complete slide based on the outline entry provided.

Respond ONLY with valid JSON:
{"action":"add_slides","slides":[{ ... complete slide object ... }]}

The slide must:
- Use the id, layout, title, kicker, and contentType from the outline entry
- Extract relevant content from the USER'S ORIGINAL REQUEST — the outline only gives you the title/topic, you must fill in the actual body content from the request
- Follow the full element schema: start with kicker (if present), then heading with gradient:true, then divider, then rich body elements
- Use contentType to choose the main body element: cards→feature list, stats→KPI numbers, diagram→flow/chart, bullets→list items, quote→pull quote, body→prose, pills→tag cloud
- Be visually rich with actual data, numbers, names, and terminology drawn from the user request
- Match the design language: dark background, gradient headings, dividers after heading
- transition: "fade" for slide 1, "slide" for all others
- Generate ONLY this one slide, nothing else`;

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
    const bg = slideIndex % 2 === 0 ? '#0f0f1a' : '#13131f';
    const outlineJson = JSON.stringify(outlineSlide, null, 2);
    const prompt = `User's original request:
${userRequest}

Full presentation outline (${totalSlides} slides):
${allOutline.map((s, i) => `  Slide ${i+1}: [${s.layout}] ${s.title}${s.kicker ? ' · ' + s.kicker : ''}`).join('\n')}

Now generate slide ${slideIndex + 1} of ${totalSlides} using this outline entry:
${outlineJson}

Additional constraints:
- background: "${bg}"
- transition: "${slideIndex === 0 ? 'fade' : 'slide'}"
- Use the outline's title, kicker, subheading, content, and notes exactly — do not substitute or invent different content
- The notes field contains all the real text and data you should use
- transition: "${slideIndex === 0 ? 'fade' : 'slide'}"

Generate this slide with full rich content. Use the notes as a guide for what elements to include.`;

    const messages = [
      { role: 'system', content: SLIDE_GEN_PROMPT },
      { role: 'user', content: prompt },
    ];
    const rawText = await callLLM(messages, settings);
    const parsed = parseJSONResponse(rawText);
    return { success: true, data: parsed, raw: rawText };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('llm:chat', async (_event, messages, settings) => {
  try {
    const allMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
    const rawText = await callLLM(allMessages, settings);
    const parsed = parseJSONResponse(rawText);
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
        return `<div class="el-diagram">${buildStaticSVG(el)}</div>`;
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

// Inline CSS with fixed px fonts (no clamp/vw) so it works at any viewport size
const SLIDE_CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;}
.slide-container{
  width:100%;height:100%;
  display:flex;flex-direction:column;
  justify-content:center;align-items:center;
  padding:60px 80px;overflow:hidden;gap:0;
}
.layout-title{text-align:center;align-items:center;gap:20px;}
.layout-content{align-items:flex-start;gap:24px;}
.layout-section{text-align:center;align-items:center;justify-content:center;gap:16px;}
.layout-two-column{flex-direction:row;align-items:flex-start;gap:60px;}
.layout-two-column .col{flex:1;display:flex;flex-direction:column;gap:20px;min-width:0;}
.layout-big-quote{text-align:center;align-items:center;justify-content:center;gap:24px;padding:64px 120px;}
.layout-blank{align-items:flex-start;gap:20px;}
.el-kicker{font-size:14px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#89b4fa;opacity:0.9;}
.el-heading{font-size:72px;font-weight:800;line-height:1.05;letter-spacing:-0.03em;}
.el-subheading{font-size:38px;font-weight:300;line-height:1.5;opacity:0.8;}
.el-body{font-size:26px;line-height:1.75;opacity:0.8;max-width:80ch;}
.el-bullets{list-style:none;display:flex;flex-direction:column;gap:14px;width:100%;}
.el-bullets li{font-size:26px;line-height:1.5;padding-left:1.6em;position:relative;}
.el-bullets li::before{content:'▸';position:absolute;left:0;color:#89b4fa;opacity:0.8;}
.el-image-wrap{max-width:100%;}
.el-image{max-width:100%;object-fit:contain;border-radius:14px;display:block;}
.el-image-caption{font-size:13px;opacity:0.5;text-align:center;margin-top:6px;font-style:italic;}
.el-images-grid{display:grid;width:100%;align-self:stretch;}
.el-images-grid-item{display:flex;flex-direction:column;gap:4px;min-width:0;}
.el-images-grid-item .el-image{max-height:none;width:100%;}
.el-divider{height:3px;width:56px;background:#89b4fa;border-radius:2px;align-self:flex-start;}
.layout-title .el-divider,.layout-section .el-divider,.layout-big-quote .el-divider{align-self:center;}
.el-pills{display:flex;flex-wrap:wrap;gap:8px;align-self:flex-start;}
.layout-title .el-pills{align-self:center;}
.el-pill{display:inline-flex;align-items:center;padding:4px 14px;border-radius:999px;font-size:14px;font-weight:500;background:rgba(255,255,255,.07);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.12);}
.el-pill.accent{background:rgba(137,180,250,.15);color:#89b4fa;border-color:rgba(137,180,250,.35);}
.el-cards{display:grid;gap:16px;width:100%;align-self:stretch;}
.el-cards.cols-2{grid-template-columns:repeat(2,1fr);}
.el-cards.cols-3{grid-template-columns:repeat(3,1fr);}
.el-cards.cols-4{grid-template-columns:repeat(4,1fr);}
.el-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:24px 26px;display:flex;flex-direction:column;gap:10px;}
.el-card-accent{border-top:3px solid #89b4fa;}
.el-card .card-icon{font-size:28px;margin-bottom:4px;}
.el-card .card-title{font-size:22px;font-weight:600;letter-spacing:-0.01em;}
.el-card .card-body{font-size:18px;opacity:0.7;line-height:1.6;}
.el-stats{display:flex;gap:40px;align-self:flex-start;width:100%;}
.el-stat{display:flex;flex-direction:column;gap:4px;}
.el-stat .stat-label{font-size:14px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;opacity:0.5;}
.el-stat .stat-value{font-size:64px;font-weight:800;line-height:1;letter-spacing:-0.03em;}
.el-stat .stat-delta{font-size:15px;font-weight:500;color:#a6e3a1;}
.el-stat .stat-delta.down{color:#f38ba8;}
.el-quote{font-size:44px;font-weight:400;font-style:italic;line-height:1.45;text-align:center;max-width:75ch;position:relative;}
.el-quote::before{content:'\\201C';font-size:5em;line-height:0;vertical-align:-.45em;color:#89b4fa;opacity:0.5;margin-right:0.1em;}
.el-quote-author{font-size:16px;font-weight:500;letter-spacing:.06em;opacity:0.5;text-transform:uppercase;text-align:center;}
.el-section-num{font-size:180px;font-weight:900;line-height:1;opacity:0.15;position:absolute;top:50%;left:50%;transform:translate(-50%,-54%);pointer-events:none;user-select:none;}
.layout-section>:not(.el-section-num){position:relative;z-index:1;}
.el-diagram{width:100%;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;border-radius:14px;overflow:hidden;}
.el-diagram svg{max-width:100%;max-height:45%;}
`;

const STATIC_PALETTE = ['#89b4fa','#cba6f7','#f38ba8','#a6e3a1','#f9e2af','#fab387','#94e2d5'];

// Build a static SVG representation of a diagram for HTML export
function buildStaticSVG(el) {
  if (!el || el.kind === 'svg') return el.svgHtml || '';

  if (el.kind === 'bar') {
    const datasets = el.datasets || [];
    const labels = el.labels || [];
    const data = datasets[0]?.data || [];
    const max = Math.max(...data, 1);
    const W = 600, H = 320, padL = 48, padB = 40, padT = 30, padR = 20;
    const bw = Math.max(20, Math.floor((W - padL - padR) / (labels.length || 1) - 8));
    const bars = data.map((v, i) => {
      const barH = Math.round(((H - padT - padB) * v) / max);
      const x = padL + i * ((W - padL - padR) / labels.length) + 4;
      const y = H - padB - barH;
      const color = datasets[0]?.color || STATIC_PALETTE[i % STATIC_PALETTE.length];
      const label = labels[i] || '';
      return `<rect x="${x}" y="${y}" width="${bw}" height="${barH}" rx="4" fill="${color}" opacity="0.85"/>
<text x="${x + bw/2}" y="${H - padB + 16}" text-anchor="middle" fill="#a6adc8" font-size="11">${label}</text>`;
    }).join('');
    const title = el.title ? `<text x="${W/2}" y="20" text-anchor="middle" fill="#cdd6f4" font-size="14" font-weight="600">${el.title}</text>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;max-height:45%;">${title}${bars}</svg>`;
  }

  if (el.kind === 'pie' || el.kind === 'doughnut') {
    const datasets = el.datasets || [];
    const labels = el.labels || [];
    const data = (datasets[0]?.data || []);
    const total = data.reduce((s, v) => s + v, 0) || 1;
    const cx = 150, cy = 150, r = 120, ri = el.kind === 'doughnut' ? 60 : 0;
    let angle = -Math.PI / 2;
    const slices = data.map((v, i) => {
      const sa = angle, ea = angle + (v / total) * 2 * Math.PI;
      angle = ea;
      const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
      const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);
      const large = (v / total) > 0.5 ? 1 : 0;
      const color = STATIC_PALETTE[i % STATIC_PALETTE.length];
      const mid = (sa + ea) / 2, lr = r * 0.65;
      const lx = cx + lr * Math.cos(mid), ly = cy + lr * Math.sin(mid);
      const pct = Math.round(v / total * 100);
      const inner = ri > 0
        ? `M${cx+ri*Math.cos(sa)},${cy+ri*Math.sin(sa)} A${ri},${ri} 0 ${large} 0 ${cx+ri*Math.cos(ea)},${cy+ri*Math.sin(ea)} Z`
        : `M${cx},${cy}`;
      return `<path d="M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${cx},${cy} Z" fill="${color}" opacity="0.9"/>
<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="11" font-weight="600">${pct}%</text>`;
    }).join('');
    const legend = labels.map((l, i) => {
      const color = STATIC_PALETTE[i % STATIC_PALETTE.length];
      return `<rect x="310" y="${30 + i * 22}" width="12" height="12" rx="2" fill="${color}"/>
<text x="328" y="${40 + i * 22}" fill="#a6adc8" font-size="12">${l}</text>`;
    }).join('');
    const title = el.title ? `<text x="150" y="${cy + r + 24}" text-anchor="middle" fill="#cdd6f4" font-size="13" font-weight="600">${el.title}</text>` : '';
    return `<svg viewBox="0 0 480 330" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;max-height:45%;">${slices}${legend}${title}</svg>`;
  }

  if (el.kind === 'line') {
    const datasets = el.datasets || [];
    const labels = el.labels || [];
    const W = 600, H = 320, padL = 48, padB = 40, padT = 30, padR = 20;
    const allData = datasets.flatMap(d => d.data || []);
    const max = Math.max(...allData, 1), min = Math.min(...allData, 0);
    const lines = datasets.map((d, di) => {
      const data = d.data || [];
      const color = d.color || STATIC_PALETTE[di % STATIC_PALETTE.length];
      const pts = data.map((v, i) => {
        const x = padL + (i / Math.max(data.length - 1, 1)) * (W - padL - padR);
        const y = H - padB - ((v - min) / (max - min || 1)) * (H - padT - padB);
        return `${x},${y}`;
      }).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    }).join('');
    const axisLabels = labels.map((l, i) => {
      const x = padL + (i / Math.max(labels.length - 1, 1)) * (W - padL - padR);
      return `<text x="${x}" y="${H - padB + 16}" text-anchor="middle" fill="#a6adc8" font-size="11">${l}</text>`;
    }).join('');
    const title = el.title ? `<text x="${W/2}" y="20" text-anchor="middle" fill="#cdd6f4" font-size="14" font-weight="600">${el.title}</text>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;max-height:45%;">${title}${lines}${axisLabels}</svg>`;
  }

  if (el.kind === 'flow') {
    const nodes = el.nodes || [], edges = el.edges || [];
    const depth = {}, adj = {};
    nodes.forEach(n => { depth[n.id] = -1; adj[n.id] = []; });
    edges.forEach(e => { if (adj[e.from]) adj[e.from].push(e.to); });
    const roots = nodes.filter(n => !edges.some(e => e.to === n.id)).map(n => n.id);
    if (!roots.length && nodes.length) roots.push(nodes[0].id);
    const queue = [...roots];
    roots.forEach(r => { depth[r] = 0; });
    while (queue.length) {
      const id = queue.shift();
      (adj[id]||[]).forEach(nid => { if (depth[nid] < depth[id]+1) { depth[nid]=depth[id]+1; queue.push(nid); } });
    }
    nodes.forEach(n => { if (depth[n.id] < 0) depth[n.id] = 0; });
    const cols = {};
    nodes.forEach(n => { const d=depth[n.id]; if(!cols[d])cols[d]=[]; cols[d].push(n.id); });
    const numCols=Object.keys(cols).length, NW=130, NH=44, HG=90, VG=22;
    const maxPer=Math.max(...Object.values(cols).map(a=>a.length));
    const svgW=numCols*NW+(numCols-1)*HG+40, svgH=maxPer*NH+(maxPer-1)*VG+40;
    const pos={};
    Object.entries(cols).forEach(([d,ids])=>{
      const ch=ids.length*NH+(ids.length-1)*VG, sy=(svgH-ch)/2;
      ids.forEach((id,i)=>{ pos[id]={x:20+Number(d)*(NW+HG),y:sy+i*(NH+VG)}; });
    });
    const edgeSvg=edges.map(e=>{ const f=pos[e.from],t=pos[e.to]; if(!f||!t)return '';
      return `<line x1="${f.x+NW}" y1="${f.y+NH/2}" x2="${t.x}" y2="${t.y+NH/2}" stroke="#89b4fa" stroke-width="1.5" stroke-opacity="0.6" marker-end="url(#arr)"/>`; }).join('');
    const nodeSvg=nodes.map(n=>{ const p=pos[n.id]; if(!p)return '';
      return `<rect x="${p.x}" y="${p.y}" width="${NW}" height="${NH}" rx="7" fill="rgba(137,180,250,.12)" stroke="#89b4fa" stroke-width="1.5"/>
<text x="${p.x+NW/2}" y="${p.y+NH/2+1}" text-anchor="middle" dominant-baseline="middle" fill="#cdd6f4" font-size="12">${escHtml(n.label||n.id)}</text>`; }).join('');
    return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;max-height:45%;">
<defs><marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#89b4fa" opacity="0.8"/></marker></defs>
${edgeSvg}${nodeSvg}</svg>`;
  }

  if (el.kind === 'mindmap') {
    const root = el.root || 'Topic', children = el.children || [];
    const W=700,H=500,CX=W/2,CY=H/2;
    function countLeaves(n){return(!n.children||!n.children.length)?1:n.children.reduce((s,c)=>s+countLeaves(c),0);}
    const total=children.reduce((s,c)=>s+countLeaves(c),0)||1;
    const makeNode=(x,y,label,isRoot,ci)=>{
      const color=STATIC_PALETTE[ci%STATIC_PALETTE.length];
      const bw=Math.max(label.length*7+(isRoot?36:24),isRoot?80:60),bh=isRoot?36:28;
      return `<rect x="${x-bw/2}" y="${y-bh/2}" width="${bw}" height="${bh}" rx="${isRoot?10:7}" fill="${isRoot?'rgba(137,180,250,.2)':color+'22'}" stroke="${isRoot?'#89b4fa':color}" stroke-width="${isRoot?2:1.5}"/>
<text x="${x}" y="${y+1}" text-anchor="middle" dominant-baseline="middle" fill="#cdd6f4" font-size="${isRoot?13:11}" font-weight="${isRoot?700:500}">${escHtml(label)}</text>`;
    };
    const makeEdge=(x1,y1,x2,y2,color)=>`<path d="M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}" fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="0.5"/>`;
    let cursor=0, nodes=makeNode(CX,CY,root,true,0), edges='';
    children.forEach((child,ci)=>{
      const leaves=countLeaves(child), mid=cursor+leaves/2;
      const angle=((mid/total)*2*Math.PI)-Math.PI/2;
      const r1=160,cx2=CX+r1*Math.cos(angle),cy2=CY+r1*Math.sin(angle);
      const color=STATIC_PALETTE[ci%STATIC_PALETTE.length];
      edges+=makeEdge(CX,CY,cx2,cy2,color);
      nodes+=makeNode(cx2,cy2,child.label||'',false,ci);
      (child.children||[]).forEach((gc,gci)=>{
        const sub=child.children.length, subA=angle+((gci-(sub-1)/2)*0.35);
        const r2=110,gcx=cx2+r2*Math.cos(subA),gcy=cy2+r2*Math.sin(subA);
        edges+=makeEdge(cx2,cy2,gcx,gcy,color);
        nodes+=makeNode(gcx,gcy,gc.label||'',false,ci);
      });
      cursor+=leaves;
    });
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;max-height:45%;">${edges}${nodes}</svg>`;
  }

  return '';
}

function buildSlideDiv(slide, extraClass) {
  const bg = slide.background || '#1e1e2e';
  const color = slide.color || '#cdd6f4';
  const layout = slide.layout || 'content';
  const inner = renderElements(slide.elements, layout, slide.sectionNum);
  return `<div class="slide-container layout-${layout}${extraClass?' '+extraClass:''}" style="background:${bg};color:${color}">${inner}</div>`;
}

function buildStandaloneHTML(slides, title) {
  const slideBlocks = slides.map(s => buildSlideDiv(s, 'slide-page')).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1920,initial-scale=1.0"/>
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
</script>
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
    fs.writeFileSync(filePath, buildStandaloneHTML(slides, title), 'utf8');
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
  const tmpDir = require('os').tmpdir();

  // Use a VISIBLE but off-screen window — hidden windows don't paint in Electron 29
  const offscreen = new BrowserWindow({
    width: W,
    height: H,
    x: -W - 100,
    y: 0,
    frame: false,
    skipTaskbar: true,
    webPreferences: { contextIsolation: true },
  });
  offscreen.showInactive();

  try {
    const jpegs = [];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const html = buildSingleSlideHTML(slide, W, H);
      const tmpPath = path.join(tmpDir, `openslides-slide-${Date.now()}-${i}.html`);
      fs.writeFileSync(tmpPath, html, 'utf8');

      await new Promise((resolve, reject) => {
        const onFail = (_, code, desc) => reject(new Error(desc || 'load failed'));
        offscreen.webContents.once('did-finish-load', resolve);
        offscreen.webContents.once('did-fail-load', onFail);
        offscreen.loadFile(tmpPath);
      });

      // Wait for paint
      await new Promise(r => setTimeout(r, 300));

      const image = await offscreen.webContents.capturePage({ x: 0, y: 0, width: W, height: H });
      jpegs.push(image.toJPEG(92));

      try { fs.unlinkSync(tmpPath); } catch {}
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
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
${SLIDE_CSS}
html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;}
.slide-container{position:absolute;inset:0;}
</style></head>
<body><div class="slide-container layout-${layout}" style="background:${bg};color:${color}">${inner}</div></body>
</html>`;
}

// Minimal pure-JS PDF builder — embeds each JPEG as a full-page image
function buildPDFFromJPEGs(jpegs, w, h) {
  // PDF page size in points at 96 dpi: px * 72 / 96
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

    // Image object
    offsets[imgNum] = pos();
    const imgData = jpegs[i];
    add(`${imgNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} `
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
