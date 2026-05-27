const { ipcMain, dialog, BrowserWindow, app, shell } = require('electron');
const store = require('./store');
const { callLLM, parseJSONResponse } = require('./llm-client');
const { genSlideWithAgent, genSoloSlideWithAgent } = require('./agent-client');
const { SYSTEM_PROMPT, genOutline, genSoloOutline, genTitle } = require('../core/orchestrate');
const { buildStandaloneHTML } = require('../core/export-html');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Global abort controller — replaced on each new request, triggered by llm:abort
let _abortController = new AbortController();
function getSignal() { return _abortController.signal; }
function resetAbort() { _abortController = new AbortController(); }

ipcMain.handle('llm:abort', () => {
  _abortController.abort();
});

ipcMain.handle('llm:outline', async (_event, userRequest, settings) => {
  resetAbort();
  try {
    return await genOutline(userRequest, settings, getSignal());
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('llm:gen-slide', async (_event, { outlineSlide, allOutline, userRequest, slideIndex, totalSlides }, settings) => {
  try {
    return await genSlideWithAgent({ outlineSlide, allOutline, userRequest, slideIndex, totalSlides }, settings, getSignal());
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('llm:solo-outline', async (_event, { text, settings, workspaceFiles }) => {
  resetAbort();
  try {
    return await genSoloOutline({ text, workspaceFiles }, settings, getSignal());
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('llm:solo-slide', async (_event, { outlineSlide, allOutline, userRequest, slideIndex, totalSlides, theme, settings, workspaceFiles }) => {
  try {
    return await genSoloSlideWithAgent({ outlineSlide, allOutline, userRequest, slideIndex, totalSlides, theme, workspaceFiles }, settings, getSignal());
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('session:gen-title', async (_event, { slideTitles, settings }) => {
  try {
    const title = await genTitle(slideTitles, settings);
    return { success: true, title };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('llm:chat', async (_event, messages, settings, genMode) => {
  resetAbort();
  try {
    const modeHint = genMode === 'solo'
      ? '\n\nCurrent mode: SOLO. If the user wants a new presentation, use {"action":"generate_presentation","request":"..."} — the system will generate free-form HTML slides.'
      : '\n\nCurrent mode: TEMPLATE. If the user wants a new presentation, use {"action":"generate_presentation","request":"..."} — the system will generate structured template slides.';
    const systemWithMode = { role: 'system', content: SYSTEM_PROMPT + modeHint };
    const allMessages = [systemWithMode, ...messages];
    const rawText = await callLLM(allMessages, settings, 4096, getSignal());
    const parsed = parseJSONResponse(rawText);
    if (!parsed && rawText.includes('soloHtml') && rawText.includes('update_slide')) {
      const slideIdM = rawText.match(/"slideId"\s*:\s*"([^"]+)"/);
      const htmlStartIdx = rawText.indexOf('"soloHtml"');
      if (slideIdM && htmlStartIdx !== -1) {
        const valQ = rawText.indexOf('"', htmlStartIdx + 10) + 1;
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
    petSpritesheetUrl: store.get('petSpritesheetUrl', ''),
  };
});

ipcMain.handle('settings:save', (_event, settings) => {
  store.set('apiProvider', settings.apiProvider);
  store.set('apiKey', settings.apiKey);
  store.set('baseUrl', settings.baseUrl);
  store.set('modelName', settings.modelName);
  store.set('petSpritesheetUrl', settings.petSpritesheetUrl || '');
  return true;
});

ipcMain.handle('models:list', async (_event, { apiProvider, apiKey, baseUrl }) => {
  try {
    const provider = (apiProvider || 'openai').toLowerCase();
    let url, headers;

    if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/models';
      headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'models-2023-06-01' };
    } else {
      const base = (baseUrl || 'https://api.openai.com').replace(/\/$/, '');
      url = base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`;
      headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    }

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return { success: false, error: `HTTP ${resp.status}: ${body.slice(0, 200)}` };
    }
    const json = await resp.json();

    const raw = Array.isArray(json) ? json : (json.data || []);
    const models = raw
      .map(m => typeof m === 'string' ? m : (m.id || m.name || ''))
      .filter(Boolean)
      .sort();
    return { success: true, models };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('logo:get', () => store.get('logo', null));
ipcMain.handle('logo:save', (_event, logo) => { store.set('logo', logo); return true; });

ipcMain.handle('pet:fetch-manifest', async () => {
  try {
    const resp = await fetch('https://petdex.crafter.run/api/manifest');
    if (!resp.ok) return { error: `HTTP ${resp.status}` };
    const data = await resp.json();
    return { data };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('presentation:save', (_event, data) => {
  store.set('presentation', data);
  return true;
});

ipcMain.handle('presentation:load', () => {
  return store.get('presentation') ?? null;
});

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

ipcMain.handle('workspace:pick-files', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Add to Workspace',
    filters: [
      { name: 'All Supported', extensions: ['png','jpg','jpeg','gif','webp','svg','txt','md','csv','json'] },
      { name: 'Images', extensions: ['png','jpg','jpeg','gif','webp','svg'] },
      { name: 'Text / Documents', extensions: ['txt','md','csv','json'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled || !filePaths.length) return { success: false, files: [] };
  const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','webp','svg']);
  const files = [];
  for (const fp of filePaths) {
    const ext = path.extname(fp).slice(1).toLowerCase();
    const name = path.basename(fp);
    try {
      if (IMAGE_EXTS.has(ext)) {
        const data = fs.readFileSync(fp);
        const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        const dataUrl = `data:${mime};base64,${data.toString('base64')}`;
        files.push({ name, type: 'image', mimeType: mime, dataUrl, filePath: fp });
      } else {
        const text = fs.readFileSync(fp, 'utf8');
        files.push({ name, type: 'text', mimeType: 'text/plain', text: text.slice(0, 20000) });
      }
    } catch (err) {
      // skip unreadable files
    }
  }
  return { success: true, files };
});

ipcMain.handle('workspace:describe-image', async (_event, { filePath }) => {
  const label = path.basename(filePath);
  console.log(`[ocr] start: ${label}`);
  const t0 = Date.now();
  try {
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('eng+chi_sim', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\r[ocr] ${label}: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    const { data: { text, confidence } } = await worker.recognize(filePath);
    await worker.terminate();
    process.stdout.write('\n');
    const trimmed = text.trim();
    console.log(`[ocr] done: ${label} — ${trimmed.length} chars, confidence ${Math.round(confidence)}% (${Date.now() - t0}ms)`);
    return { success: true, description: trimmed };
  } catch (err) {
    console.error(`[ocr] error: ${label} — ${err.message} (${Date.now() - t0}ms)`);
    return { success: false, error: err.message };
  }
});

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
