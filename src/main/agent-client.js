// agent-client.js — LangGraph ReAct agent for gen-slide and solo-slide

const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');

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

const SOLO_SLIDE_SYSTEM = `You are a world-class presentation designer. Use the generate_solo_html tool to output ONE complete slide as a self-contained HTML document.

Rules for the HTML:
- Must be a complete <!DOCTYPE html> document
- Use ONLY inline CSS — no external stylesheets, no CDN links, no @import
- Slide canvas: body { margin:0; padding:0; width:1920px; height:1080px; overflow:hidden; }
- Design guidelines: bold typography, generous whitespace, strong color contrast
- You may freely use SVG elements, CSS gradients, CSS shapes, CSS animations
- Do NOT use any JavaScript
- Call generate_solo_html ONCE with the complete HTML string`;

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

function buildChatModel(settings, tools, maxTokens = 8192) {
  const provider = (settings.apiProvider || 'openai').toLowerCase();

  if (provider === 'anthropic') {
    const rawModel = settings.modelName || 'claude-3-5-sonnet-20241022';
    const cleanModel = rawModel.replace(/^anthropic[-/]+/i, '');
    log.info(`buildChatModel: anthropic model="${cleanModel}" (raw="${rawModel}")`);
    const model = new ChatAnthropic({
      apiKey: settings.apiKey,
      model: cleanModel,
      maxTokens,
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

async function invokeWithTool(llm, messages, toolName, label, t0) {
  log.info(`  invokeWithTool: calling model for "${toolName}"...`);
  const response = await llm.invoke(messages);
  log.info(`  invokeWithTool: response type=${response._getType?.() ?? typeof response}, tool_calls=${response.tool_calls?.length ?? 0}`);

  if (response.tool_calls?.length) {
    response.tool_calls.forEach(tc =>
      log.info(`    tool_call: ${tc.name}, args keys: ${Object.keys(tc.args || {}).join(', ')}, size: ${JSON.stringify(tc.args).length}`)
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
  return tc.args;
}

// ── Agent runners ─────────────────────────────────────────────────────────────

async function genSlideWithAgent({ outlineSlide, allOutline, userRequest, slideIndex, totalSlides }, settings) {
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
    args = await invokeWithTool(llm, messages, 'generate_slide', label, t0);
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

async function genSoloSlideWithAgent({ outlineSlide, allOutline, userRequest, slideIndex, totalSlides }, settings) {
  const label = `solo slide ${slideIndex + 1}/${totalSlides} "${outlineSlide.title}"`;
  log.info(`▶ genSoloSlide ${label} — model: ${settings.modelName || 'gpt-4o'}`);
  const t0 = Date.now();

  const userPrompt = `Slide title: ${outlineSlide.title || ''}
Content brief: ${outlineSlide.notes || outlineSlide.title || ''}
Overall topic: ${userRequest}
This is slide ${slideIndex + 1} of ${totalSlides}

Call the generate_solo_html tool with the complete HTML document.`;

  const llm = buildChatModel(settings, [generateSoloHtmlTool], 8192);
  const messages = [
    { role: 'system', content: SOLO_SLIDE_SYSTEM },
    { role: 'user', content: userPrompt },
  ];

  let args;
  try {
    args = await invokeWithTool(llm, messages, 'generate_solo_html', label, t0);
  } catch (err) {
    log.error(`✗ genSoloSlide ${label} — failed (${Date.now() - t0}ms):`, err.message);
    throw err;
  }

  const html = typeof args.html === 'string' ? args.html : String(args.html ?? '');
  if (!html || !html.includes('<')) {
    log.error(`✗ genSoloSlide ${label} — empty or invalid HTML (${html?.length ?? 0} chars)`);
    throw new Error(`Solo slide ${slideIndex + 1}: empty HTML returned`);
  }

  log.info(`✓ genSoloSlide ${label} — ${html.length} chars (${Date.now() - t0}ms)`);
  return { success: true, data: { action: 'solo_slide', html } };
}

module.exports = { genSlideWithAgent, genSoloSlideWithAgent };
