// agent-client.js — LangGraph ReAct agent for gen-slide; direct HTTP for solo-slide

const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { callLLM } = require('./llm-client');

// ── Prompt constants (mirrors ipc-handlers.js) ────────────────────────────────

const SLIDE_GEN_SYSTEM = `You are a presentation slide designer. Use the generate_slide tool to output ONE complete slide.

## Slide schema
{
  "id": "slide-N",
  "layout": "title|content|section|two-column|big-quote|blank",
  "background": "#hexcolor",
  "transition": "slide|fade|zoom|none",
  "elements": [ ...element objects... ]
}

## All element types — use EXACTLY these schemas:
{"type":"kicker","text":"LABEL"}
{"type":"heading","text":"Title","gradient":true}
{"type":"subheading","text":"Subtitle"}
{"type":"body","text":"Paragraph text."}
{"type":"divider"}
{"type":"bullets","items":["Point one","Point two","Point three"]}
{"type":"pills","items":["Tag A","Tag B",{"text":"Accent","accent":true}]}
{"type":"quote","text":"Quote text.","author":"Name, Title"}
{"type":"stats","items":[{"label":"METRIC","value":"42K","delta":"+12%"},{"label":"ANOTHER","value":"$1.2M"}]}
{"type":"cards","cols":3,"items":[{"icon":"🚀","title":"Title","body":"Description","accent":true},{"icon":"💡","title":"Title","body":"Description"}]}
{"type":"diagram","kind":"bar","title":"Chart title","labels":["A","B","C"],"datasets":[{"label":"Series","data":[10,20,30],"color":"#89b4fa"}]}
{"type":"diagram","kind":"line","title":"Trend","labels":["Q1","Q2","Q3"],"datasets":[{"label":"Series","data":[100,150,200]}]}
{"type":"diagram","kind":"pie","title":"Share","labels":["A","B","C"],"datasets":[{"data":[40,35,25]}]}
{"type":"diagram","kind":"flow","nodes":[{"id":"a","label":"Start"},{"id":"b","label":"Step"},{"id":"c","label":"End"}],"edges":[{"from":"a","to":"b"},{"from":"b","to":"c"}]}
{"type":"diagram","kind":"mindmap","root":"Topic","children":[{"label":"Branch A","children":[{"label":"Leaf"}]},{"label":"Branch B"}]}

## Layout → element pattern
- "title":     kicker → heading(gradient:true) → subheading → divider → pills
- "content":   kicker → heading(gradient:true) → divider → [bullets|cards|stats|diagram|body]
- "section":   kicker → heading(gradient:true) → subheading
- "two-column": kicker → heading → divider → body (left) and bullets/stats/image (right)
- "big-quote": quote with author
- "blank":     any elements freely

## Rules
- ALWAYS start content/title slides with kicker → heading(gradient:true) → divider
- Use the contentType hint to pick the main body element
- Fill in REAL content from the user's original request — actual numbers, names, terms
- Do NOT use placeholder text like "Description here" or "Your content"
- Call generate_slide ONCE with the complete slide object`;

const SOLO_SLIDE_SYSTEM = `You are a presentation designer. Output ONE slide as a self-contained HTML document.

STRICT RULES:
- Complete <!DOCTYPE html> document
- ONLY inline CSS — no external stylesheets, no CDN, no @import
- body { margin:0; padding:0; width:1920px; height:1080px; overflow:hidden; }
- NO JavaScript
- Output ONLY raw HTML — no markdown fences, no explanation
- Follow the design theme colors and font provided in the user message EXACTLY

DEFAULT VISUAL STYLE — Anthropic Claude Light:
Unless the theme overrides these, use this design language:
- Background: #f9f7f4 (warm off-white); card/panel surfaces: #ffffff with subtle box-shadow 0 2px 12px rgba(0,0,0,.07)
- Primary text: #1a1714 (near-black); secondary text: #6b6560; muted: #9e9891
- Accent: #d97757 (warm coral-orange) — use for highlights, underlines, icons, key numbers
- Accent hover variant: #c4623e; light accent tint for backgrounds: #fdf1ec
- Border/divider: #e8e3de (1px solid)
- Font: system-ui, -apple-system, "Segoe UI", sans-serif; heading weight 700; body weight 400
- Generous padding: 80–120px margins; breathing room between sections
- Typography scale: hero headline 96–120px, section heading 64–72px, body 28–32px, caption 22px
- Layout: clean grid, strong typographic hierarchy, minimal decoration
- Decorative accents: thin coral left-border on blockquotes, coral underline on key headings, subtle warm gradients (not dark neon)
- NO drop shadows on text, NO glassmorphism, NO neon glows — keep it crisp and editorial

CONCISENESS — your output MUST fit in ~3000 tokens:
- Use a <style> block in <head> for shared styles; avoid repeating inline styles
- CSS shorthand aggressively (font: bold 64px/1.2 Arial)
- No comments in the HTML/CSS
- Limit total element count — a clean slide needs 5–15 elements, not 50`;

// ── Tool definitions ──────────────────────────────────────────────────────────

const elementSchema = z.record(z.any()).describe('Slide element object');

const generateSlideTool = tool(
  async (input) => JSON.stringify(input.slide),
  {
    name: 'generate_slide',
    description: 'Output the complete slide object for a single presentation slide. Call this ONCE with the fully populated slide.',
    schema: z.object({
      slide: z.object({
        id: z.string().describe('Slide ID, e.g. slide-1'),
        layout: z.enum(['title', 'content', 'section', 'two-column', 'big-quote', 'blank']),
        background: z.string().optional().describe('Background hex color, e.g. #0f0f1a'),
        color: z.string().optional().describe('Text color override'),
        transition: z.enum(['slide', 'fade', 'zoom', 'none']).optional(),
        elements: z.array(elementSchema).describe('Array of slide elements'),
      }),
    }),
  }
);

const generateSoloHtmlTool = tool(
  async (input) => input.html,
  {
    name: 'generate_solo_html',
    description: 'Output a complete self-contained HTML document for a single 1920x1080px presentation slide. Call this ONCE.',
    schema: z.object({
      html: z.string().describe('Complete <!DOCTYPE html> document with inline CSS only, no external resources, no JavaScript. Body must be exactly 1920x1080px.'),
    }),
  }
);

// ── Logger ────────────────────────────────────────────────────────────────────

const log = {
  info:  (...a) => console.log ('[agent]', ...a),
  warn:  (...a) => console.warn ('[agent]', ...a),
  error: (...a) => console.error('[agent]', ...a),
};

// ── Model factory ─────────────────────────────────────────────────────────────

function buildPlainModel(settings, maxTokens = 8192) {
  const provider = (settings.apiProvider || 'openai').toLowerCase();
  if (provider === 'anthropic') {
    const cleanModel = (settings.modelName || 'claude-3-5-sonnet-20241022').replace(/^anthropic[-/]+/i, '');
    log.info(`buildPlainModel: anthropic model="${cleanModel}"`);
    return new ChatAnthropic({
      anthropicApiKey: settings.apiKey,
      model: cleanModel,
      maxTokens,
      thinking: { type: 'disabled' },
      streaming: true,
    });
  }
  // openai / litellm
  const defaultOpenAI = /^https?:\/\/api\.openai\.com\/?$/i.test(settings.baseUrl || '');
  const baseUrl = (settings.baseUrl || '').replace(/\/$/, '');
  const configuration = defaultOpenAI || !baseUrl
    ? {}
    : { baseURL: baseUrl.endsWith('/v1') ? baseUrl : baseUrl + '/v1' };
  log.info(`buildPlainModel: openai model="${settings.modelName || 'gpt-4o'}" baseUrl="${baseUrl || '(default)'}"`);
  return new ChatOpenAI({
    apiKey: settings.apiKey,
    model: settings.modelName || 'gpt-4o',
    maxTokens,
    ...(Object.keys(configuration).length ? { configuration } : {}),
  });
}

function buildChatModel(settings, tools, maxTokens = 8192) {
  const provider = (settings.apiProvider || 'openai').toLowerCase();

  if (provider === 'anthropic') {
    const rawModel = settings.modelName || 'claude-3-5-sonnet-20241022';
    const cleanModel = rawModel.replace(/^anthropic[-/]+/i, '');
    log.info(`buildChatModel: anthropic model="${cleanModel}" (raw="${rawModel}")`);
    const model = new ChatAnthropic({
      anthropicApiKey: settings.apiKey,
      model: cleanModel,
      maxTokens,
      thinking: { type: 'disabled' },
      streaming: true,
    });
    return model.bindTools(tools, { tool_choice: { type: 'any' } });
  }

  // openai / litellm
  const defaultOpenAI = /^https?:\/\/api\.openai\.com\/?$/i.test(settings.baseUrl || '');
  const baseUrl = (settings.baseUrl || '').replace(/\/$/, '');
  const configuration = defaultOpenAI || !baseUrl
    ? {}
    : { baseURL: baseUrl.endsWith('/v1') ? baseUrl : baseUrl + '/v1' };
  log.info(`buildChatModel: openai model="${settings.modelName || 'gpt-4o'}" baseUrl="${baseUrl || '(default)'}"`);

  const model = new ChatOpenAI({
    apiKey: settings.apiKey,
    model: settings.modelName || 'gpt-4o',
    maxTokens,
    ...(Object.keys(configuration).length ? { configuration } : {}),
  });
  return model.bindTools(tools, { tool_choice: 'required' });
}

// ── Direct tool-call runner (no ReAct loop) ───────────────────────────────────
// For single-turn, single-tool calls we don't need a full agent graph.
// We call the model once; it must return a tool_use block (forced by tool_choice).

async function invokeWithTool(llm, messages, toolName, label, t0, signal) {
  log.info(`  invokeWithTool: calling model for "${toolName}"...`);
  const response = await llm.invoke(messages, { signal });
  log.info(`  invokeWithTool: response type=${response._getType?.() ?? typeof response}, tool_calls=${response.tool_calls?.length ?? 0}`);

  // Log raw additional_kwargs to see what LiteLLM actually returned
  if (response.additional_kwargs?.tool_calls?.length) {
    response.additional_kwargs.tool_calls.forEach((tc, i) => {
      const fnArgs = tc.function?.arguments ?? '(none)';
      log.info(`    raw tool_call[${i}]: ${tc.function?.name}, args size=${fnArgs.length}, args preview: ${fnArgs.slice(0, 300)}`);
    });
  }

  if (response.tool_calls?.length) {
    response.tool_calls.forEach(tc =>
      log.info(`    parsed tool_call: ${tc.name}, args keys: [${Object.keys(tc.args || {}).join(', ')}], size: ${JSON.stringify(tc.args).length}`)
    );
  }

  const tc = response.tool_calls?.find(t => t.name === toolName);
  if (!tc) {
    const preview = typeof response.content === 'string'
      ? response.content.slice(0, 200)
      : JSON.stringify(response.content).slice(0, 200);
    log.error(`  invokeWithTool: no "${toolName}" tool call in response. Content: ${preview}`);
    throw new Error(`${label}: model did not call ${toolName} tool`);
  }

  // If args is empty but raw additional_kwargs has the data, parse it directly
  if ((!tc.args || Object.keys(tc.args).length === 0) && response.additional_kwargs?.tool_calls?.length) {
    const rawTc = response.additional_kwargs.tool_calls.find(r => r.function?.name === toolName);
    if (rawTc?.function?.arguments) {
      log.warn(`  invokeWithTool: args empty from LangChain parser, falling back to raw JSON parse`);
      try {
        const parsed = JSON.parse(rawTc.function.arguments);
        log.info(`  invokeWithTool: raw parse succeeded, keys: [${Object.keys(parsed).join(', ')}]`);
        return parsed;
      } catch (e) {
        log.error(`  invokeWithTool: raw JSON parse failed: ${e.message}`);
      }
    }
  }

  return tc.args;
}

// ── Agent runners ─────────────────────────────────────────────────────────────

async function genSlideWithAgent({ outlineSlide, allOutline, userRequest, slideIndex, totalSlides }, settings, signal) {
  const label = `slide ${slideIndex + 1}/${totalSlides} [${outlineSlide.layout || 'content'}] "${outlineSlide.title}"`;
  log.info(`▶ genSlide ${label} — model: ${settings.modelName || 'gpt-4o'}`);
  const t0 = Date.now();

  const bg = slideIndex % 2 === 0 ? '#0f0f1a' : '#13131f';
  const transition = slideIndex === 0 ? 'fade' : 'slide';
  const userPrompt = `User's original request:
${userRequest}

Full outline (${totalSlides} slides total):
${allOutline.map((s, i) => `  ${i + 1}. [${s.layout || 'content'}] ${s.title}${s.kicker ? ' · ' + s.kicker : ''}${s.contentType ? ' [' + s.contentType + ']' : ''}`).join('\n')}

Generate slide ${slideIndex + 1} of ${totalSlides}:
${JSON.stringify(outlineSlide)}

Required: background="${bg}", transition="${transition}"
Fill ALL body content with real information from the user's original request above.
Call the generate_slide tool with the complete slide object.`;

  const llm = buildChatModel(settings, [generateSlideTool], 4096);
  const messages = [
    { role: 'system', content: SLIDE_GEN_SYSTEM },
    { role: 'user', content: userPrompt },
  ];

  let args;
  try {
    args = await invokeWithTool(llm, messages, 'generate_slide', label, t0, signal);
  } catch (err) {
    log.error(`✗ genSlide ${label} — failed (${Date.now() - t0}ms):`, err.message);
    throw err;
  }

  const slide = args.slide;
  if (!slide) {
    log.error(`✗ genSlide ${label} — args.slide missing, args keys: ${Object.keys(args).join(', ')}`);
    throw new Error(`Slide ${slideIndex + 1}: tool args missing slide field`);
  }

  log.info(`✓ genSlide ${label} — ${slide.elements?.length ?? 0} elements (${Date.now() - t0}ms)`);
  return { success: true, data: { action: 'add_slides', slides: [slide] } };
}

async function genSoloSlideWithAgent({ outlineSlide, allOutline, userRequest, slideIndex, totalSlides, theme, workspaceFiles }, settings, signal) {
  const label = `solo slide ${slideIndex + 1}/${totalSlides} "${outlineSlide.title}"`;
  log.info(`▶ genSoloSlide ${label} — model: ${settings.modelName || 'gpt-4o'}`);
  const t0 = Date.now();

  const themeBlock = theme ? `
Design theme (apply consistently):
- Background: ${theme.bg || '#0f0f1a'}
- Accent color: ${theme.accent || '#6c63ff'}
- Text color: ${theme.text || '#ffffff'}
- Subtext color: ${theme.subtext || '#a0a0b8'}
- Font: ${theme.font || 'Inter, Arial, sans-serif'}
- Style: ${theme.style || 'dark modern'}
` : '';

  const userPrompt = `${themeBlock}Slide title: ${outlineSlide.title || ''}
Content brief: ${outlineSlide.notes || outlineSlide.title || ''}
Slide style: ${outlineSlide.style || 'content slide'}
This is slide ${slideIndex + 1} of ${totalSlides}
${(() => {
  const lines = [];
  // Assigned image for this slide (from outline planning)
  if (outlineSlide.imageRef && workspaceFiles?.length) {
    const img = workspaceFiles.find(f => f.type === 'image' && f.name === outlineSlide.imageRef);
    if (img) {
      const dims = (img.width && img.height) ? ` (${img.width}×${img.height}px, aspect ratio ${(img.width/img.height).toFixed(2)})` : '';
      lines.push(`\nAssigned image: use <img src="workspace://${img.name}"> to embed it in this slide.`);
      lines.push(`Image dimensions: ${img.width && img.height ? `${img.width}×${img.height}px` : 'unknown'}${dims ? ` — maintain this aspect ratio when sizing the <img> element` : ''}`);
      if (img.description) lines.push(`OCR text from image: "${img.description.slice(0, 500)}"`);
    }
  }
  // Text reference documents (available to all slides)
  const txts = workspaceFiles?.filter(f => f.type === 'text') || [];
  if (txts.length) {
    lines.push('\n--- Reference documents ---');
    txts.forEach(f => lines.push(`[${f.name}]:\n${f.text.slice(0, 2000)}`));
  }
  return lines.join('\n');
})()}
Output the complete HTML document now.`;

  const systemSize = SOLO_SLIDE_SYSTEM.length;
  const promptSize = userPrompt.length;
  log.info(`  prompt sizes: system=${systemSize} chars, user=${promptSize} chars (~${Math.round((systemSize + promptSize) / 4)} tokens est.)`);
  log.info(`  calling model...`);

  let html;
  try {
    html = await callLLM([
      { role: 'system', content: SOLO_SLIDE_SYSTEM },
      { role: 'user', content: userPrompt },
    ], settings, 32000, signal);
  } catch (err) {
    log.error(`✗ genSoloSlide ${label} — model invoke failed (${Date.now() - t0}ms):`, err.message);
    throw err;
  }

  // Strip markdown fences if model wrapped the HTML
  html = html.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '').trim();

  // Replace workspace:// placeholders with actual dataUrls
  if (workspaceFiles?.length) {
    const imgMap = {};
    workspaceFiles.filter(f => f.type === 'image').forEach(f => { imgMap[f.name] = f.dataUrl; });
    html = html.replace(/workspace:\/\/([^\s"']+)/g, (match, name) => imgMap[name] || match);
  }

  // If truncated (no closing tags), patch it so the browser can at least render what's there
  if (html && !html.includes('</html>')) {
    log.warn(`  genSoloSlide: HTML appears truncated (no </html>) — patching`);
    if (!html.includes('</body>')) html += '\n</body>';
    html += '\n</html>';
  }

  if (!html || !html.includes('<')) {
    log.error(`✗ genSoloSlide ${label} — empty or invalid HTML (${html?.length ?? 0} chars), preview: ${html?.slice(0, 200)}`);
    throw new Error(`Solo slide ${slideIndex + 1}: empty HTML returned`);
  }

  log.info(`✓ genSoloSlide ${label} — ${html.length} chars (${Date.now() - t0}ms)`);
  return { success: true, data: { action: 'solo_slide', html } };
}

module.exports = { genSlideWithAgent, genSoloSlideWithAgent };
