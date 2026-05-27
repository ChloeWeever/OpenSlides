// workspace.js — Build the workspaceFiles array (matching the renderer's shape)
// from a folder on disk. Top-level files only, mirroring the web app's flat upload.

const fs = require('fs');
const path = require('path');

const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','webp','svg']);
const TEXT_EXTS  = new Set(['txt','md','csv','json']);

function mimeForExt(ext) {
  if (ext === 'svg')   return 'image/svg+xml';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return `image/${ext}`;
}

async function getImageDimensions(absPath, ext) {
  // SVG: pull from <svg width="..." height="..."> if present.
  if (ext === 'svg') {
    try {
      const head = fs.readFileSync(absPath, 'utf8').slice(0, 2000);
      const w = head.match(/\bwidth=["'](\d+)(?:px)?["']/i);
      const h = head.match(/\bheight=["'](\d+)(?:px)?["']/i);
      if (w && h) return { width: +w[1], height: +h[1] };
      const vb = head.match(/\bviewBox=["']\s*[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)/i);
      if (vb) return { width: Math.round(+vb[1]), height: Math.round(+vb[2]) };
    } catch { /* fall through */ }
    return { width: null, height: null };
  }
  try {
    // Dynamic require so the bundler doesn't try to inline the native binary.
    const sharp = eval('require')('sharp');
    const meta = await sharp(absPath).metadata();
    return { width: meta.width || null, height: meta.height || null };
  } catch {
    return { width: null, height: null };
  }
}

async function ocrImage(absPath, label) {
  try {
    // Dynamic require — tesseract.js spawns workers and downloads language data,
    // both of which can fail inside a packaged exe. Loading at runtime keeps the
    // dep optional: install tesseract.js in a sibling node_modules to enable OCR.
    const { createWorker } = eval('require')('tesseract.js');
    const worker = await createWorker('eng+chi_sim', 1, {
      logger: m => {
        if (m.status === 'recognizing text' && process.stderr.isTTY) {
          process.stderr.write(`\r[ocr] ${label}: ${Math.round(m.progress * 100)}%   `);
        }
      },
    });
    const { data: { text } } = await worker.recognize(absPath);
    await worker.terminate();
    if (process.stderr.isTTY) process.stderr.write(`\r${' '.repeat(60)}\r`);
    return text.trim();
  } catch (e) {
    process.stderr.write(`[ocr] ${label} failed: ${e.message}\n`);
    return '';
  }
}

async function loadWorkspace(dir, { ocr = false } = {}) {
  const abs = path.resolve(dir);
  const stat = fs.statSync(abs);
  if (!stat.isDirectory()) throw new Error(`Workspace path is not a directory: ${abs}`);
  const entries = fs.readdirSync(abs, { withFileTypes: true });
  const files = [];

  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const name = ent.name;
    const fullPath = path.join(abs, name);
    const ext = path.extname(name).slice(1).toLowerCase();

    if (IMAGE_EXTS.has(ext)) {
      const data = fs.readFileSync(fullPath);
      const mime = mimeForExt(ext);
      const dataUrl = `data:${mime};base64,${data.toString('base64')}`;
      const { width, height } = await getImageDimensions(fullPath, ext);
      let description = '';
      if (ocr && ext !== 'svg') {
        process.stderr.write(`[ocr] ${name}: starting…\n`);
        description = await ocrImage(fullPath, name);
        process.stderr.write(`[ocr] ${name}: ${description.length} chars\n`);
      }
      files.push({
        name, type: 'image', mimeType: mime, dataUrl, filePath: fullPath,
        width, height, description,
      });
    } else if (TEXT_EXTS.has(ext)) {
      try {
        const text = fs.readFileSync(fullPath, 'utf8').slice(0, 20000);
        files.push({ name, type: 'text', mimeType: 'text/plain', text });
      } catch (e) {
        process.stderr.write(`[ws] skipping ${name}: ${e.message}\n`);
      }
    } else {
      process.stderr.write(`[ws] skipping ${name} (unsupported extension .${ext})\n`);
    }
  }

  return files;
}

module.exports = { loadWorkspace };
