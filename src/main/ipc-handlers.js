const { ipcMain, dialog, BrowserWindow } = require('electron');
const store = require('./store');
const { callLLM, parseJSONResponse } = require('./llm-client');
const path = require('path');
const fs = require('fs');

const SYSTEM_PROMPT = `You are an AI presentation assistant. You help users create and edit HTML-based slide presentations.

Respond ONLY with valid JSON in one of these formats:

1. To replace all slides:
{"action":"replace_all","slides":[...]}

2. To add slides:
{"action":"add_slides","slides":[...]}

3. To update a single slide:
{"action":"update_slide","slideId":"<id>","slide":{...}}

4. To delete a slide:
{"action":"delete_slide","slideId":"<id>"}

5. To send a message (no slides change):
{"action":"message","message":"<text>"}

Slide object schema:
{
  "id": "unique-string",
  "layout": "title" | "content" | "two-column" | "blank",
  "background": "#hexcolor",
  "color": "#hexcolor",
  "transition": "slide" | "fade" | "zoom" | "none",
  "elements": [
    {"type":"heading","text":"..."},
    {"type":"subheading","text":"..."},
    {"type":"body","text":"..."},
    {"type":"bullets","items":["...","..."]},
    {"type":"image","src":"https://...","alt":"..."}
  ]
}

Always use attractive colors and engaging content. Default background is #1e1e2e, default color is #cdd6f4.`;

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

function renderElements(elements, layout) {
  const renderEl = (el) => {
    switch (el.type) {
      case 'heading':    return `<h1 class="el-heading">${escHtml(el.text)}</h1>`;
      case 'subheading': return `<h2 class="el-subheading">${escHtml(el.text)}</h2>`;
      case 'body':       return `<p class="el-body">${escHtml(el.text)}</p>`;
      case 'bullets':
        return `<ul class="el-bullets">${(el.items||[]).map(i=>`<li>${escHtml(i)}</li>`).join('')}</ul>`;
      case 'image':
        return `<img class="el-image" src="${escHtml(el.src)}" alt="${escHtml(el.alt||'')}"/>`;
      default: return '';
    }
  };
  if (layout === 'two-column') {
    const half = Math.ceil((elements||[]).length / 2);
    return `<div class="col">${(elements||[]).slice(0,half).map(renderEl).join('')}</div>`
         + `<div class="col">${(elements||[]).slice(half).map(renderEl).join('')}</div>`;
  }
  return (elements||[]).map(renderEl).join('');
}

// Inline CSS with fixed px fonts (no clamp/vw) so it works at any viewport size
const SLIDE_CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;}
.slide-container{
  width:100%;height:100%;
  display:flex;flex-direction:column;
  justify-content:center;align-items:center;
  padding:60px 80px;overflow:hidden;
}
.layout-title{text-align:center;gap:20px;}
.layout-content{align-items:flex-start;gap:24px;}
.layout-two-column{flex-direction:row;align-items:flex-start;gap:60px;}
.layout-two-column .col{flex:1;display:flex;flex-direction:column;gap:20px;}
.layout-blank{gap:20px;}
.el-heading{font-size:64px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;}
.el-subheading{font-size:38px;font-weight:400;line-height:1.4;opacity:0.85;}
.el-body{font-size:26px;line-height:1.7;opacity:0.8;max-width:80ch;}
.el-bullets{list-style:none;display:flex;flex-direction:column;gap:14px;width:100%;}
.el-bullets li{font-size:26px;line-height:1.5;opacity:0.85;padding-left:1.5em;position:relative;}
.el-bullets li::before{content:'▸';position:absolute;left:0;opacity:0.6;}
.el-image{max-width:100%;max-height:45%;object-fit:contain;border-radius:8px;}
`;

function buildSlideDiv(slide, extraClass) {
  const bg = slide.background || '#1e1e2e';
  const color = slide.color || '#cdd6f4';
  const layout = slide.layout || 'content';
  const inner = renderElements(slide.elements, layout);
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
  const inner = renderElements(slide.elements, layout);
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
