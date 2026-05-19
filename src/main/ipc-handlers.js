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
{"type":"image","src":"https://...","alt":"description"}
{"type":"quote","text":"Inspiring words here.","author":"Name, Title"}
{"type":"stats","items":[
  {"label":"METRIC","value":"42K","delta":"+12%"},
  {"label":"ANOTHER","value":"$1.2M"}
]}
{"type":"cards","cols":3,"items":[
  {"icon":"🚀","title":"Card Title","body":"Card description","accent":true},
  {"icon":"💡","title":"Card Title","body":"Card description"}
]}

## Layout guidance
- "title": center-aligned, use kicker + heading (gradient) + subheading + divider + pills
- "content": left-aligned, use heading + bullets or body or stats
- "section": full-bleed section break, use kicker + heading + optional sectionNum watermark
- "two-column": splits elements 50/50; great for comparison or text+image
- "big-quote": centered, large quote + author
- "blank": freeform

## Design defaults
Default background: #1e1e2e (dark). Default text: #cdd6f4.
Always create visually rich, well-structured slides. Use gradient headings on title/section slides.
Use kickers to label slide topics. Use dividers to add visual rhythm.
Prefer cards for feature lists, stats for KPI dashboards, pills for tags/tech stacks.
Use the "section" layout with sectionNum for chapter dividers in long presentations.`;

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

// ── Export ────────────────────────────────────────────────────────────────────

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
      case 'image':
        return `<img class="el-image" src="${escHtml(el.src)}" alt="${escHtml(el.alt||'')}"/>`;
      case 'divider':
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
.el-image{max-width:100%;max-height:45%;object-fit:contain;border-radius:14px;}
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
`;

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
