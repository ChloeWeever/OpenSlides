// agent-client.js — LangGraph ReAct agent for gen-slide and solo-slide

const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { tool } = require('@langchain/core/tools');
const { createReactAgent } = require('@langchain/langgraph/prebuilt');
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

// ── Model factory ─────────────────────────────────────────────────────────────

function buildChatModel(settings, tools, maxTokens = 8192) {
  const provider = (settings.apiProvider || 'openai').toLowerCase();

  if (provider === 'anthropic') {
    const model = new ChatAnthropic({
      apiKey: settings.apiKey,
      model: settings.modelName || 'claude-3-5-sonnet-20241022',
      maxTokens,
    });
    return model.bindTools(tools);
  }

  // openai / litellm
  // Only override baseURL for non-default endpoints (LiteLLM or custom proxy)
  const defaultOpenAI = /^https?:\/\/api\.openai\.com\/?$/i.test(settings.baseUrl || '');
  const baseUrl = (settings.baseUrl || '').replace(/\/$/, '');
  const configuration = defaultOpenAI || !baseUrl
    ? {}
    : { baseURL: baseUrl.endsWith('/v1') ? baseUrl : baseUrl + '/v1' };

  const model = new ChatOpenAI({
    apiKey: settings.apiKey,
    model: settings.modelName || 'gpt-4o',
    maxTokens,
    ...(Object.keys(configuration).length ? { configuration } : {}),
  });
  return model.bindTools(tools);
}

// ── Logger ────────────────────────────────────────────────────────────────────

const log = {
  info:  (...a) => console.log ('[agent]', ...a),
  warn:  (...a) => console.warn ('[agent]', ...a),
  error: (...a) => console.error('[agent]', ...a),
};

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
  const agent = createReactAgent({ llm, tools: [generateSlideTool] });

  let result;
  try {
    result = await agent.invoke({
      messages: [
        { role: 'system', content: SLIDE_GEN_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    });
  } catch (err) {
    log.error(`✗ genSlide ${label} — invoke failed (${Date.now() - t0}ms):`, err.message);
    throw err;
  }

  // Log all messages for debugging
  result.messages.forEach((m, i) => {
    const role = m._getType ? m._getType() : (m.role || m.constructor?.name || 'msg');
    const preview = typeof m.content === 'string'
      ? m.content.slice(0, 120).replace(/\n/g, '↵')
      : JSON.stringify(m.content).slice(0, 120);
    log.info(`  [${i}] ${role}: ${preview}`);
    if (m.tool_calls?.length) {
      m.tool_calls.forEach(tc => log.info(`       → tool_call: ${tc.name}`, JSON.stringify(tc.args).slice(0, 200)));
    }
  });

  const toolMsg = result.messages.slice().reverse().find(m => m.name === 'generate_slide');
  if (!toolMsg) {
    log.error(`✗ genSlide ${label} — no generate_slide tool message found`);
    throw new Error(`Slide ${slideIndex + 1}: agent did not call generate_slide tool`);
  }

  const raw = typeof toolMsg.content === 'string' ? toolMsg.content : JSON.stringify(toolMsg.content);
  let slide;
  try {
    slide = JSON.parse(raw);
  } catch (err) {
    log.error(`✗ genSlide ${label} — JSON.parse failed:`, raw.slice(0, 300));
    throw new Error(`Slide ${slideIndex + 1}: failed to parse tool result as JSON`);
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
  const agent = createReactAgent({ llm, tools: [generateSoloHtmlTool] });

  let result;
  try {
    result = await agent.invoke({
      messages: [
        { role: 'system', content: SOLO_SLIDE_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    });
  } catch (err) {
    log.error(`✗ genSoloSlide ${label} — invoke failed (${Date.now() - t0}ms):`, err.message);
    throw err;
  }

  result.messages.forEach((m, i) => {
    const role = m._getType ? m._getType() : (m.role || m.constructor?.name || 'msg');
    const preview = typeof m.content === 'string'
      ? m.content.slice(0, 80).replace(/\n/g, '↵')
      : JSON.stringify(m.content).slice(0, 80);
    log.info(`  [${i}] ${role}: ${preview}`);
    if (m.tool_calls?.length) {
      m.tool_calls.forEach(tc => log.info(`       → tool_call: ${tc.name}, html length: ${tc.args?.html?.length ?? 'n/a'}`));
    }
  });

  const toolMsg = result.messages.slice().reverse().find(m => m.name === 'generate_solo_html');
  if (!toolMsg) {
    log.error(`✗ genSoloSlide ${label} — no generate_solo_html tool message found`);
    throw new Error(`Solo slide ${slideIndex + 1}: agent did not call generate_solo_html tool`);
  }

  const html = typeof toolMsg.content === 'string' ? toolMsg.content : String(toolMsg.content);
  if (!html || !html.includes('<')) {
    log.error(`✗ genSoloSlide ${label} — empty or invalid HTML (${html?.length ?? 0} chars)`);
    throw new Error(`Solo slide ${slideIndex + 1}: empty HTML returned`);
  }

  log.info(`✓ genSoloSlide ${label} — ${html.length} chars (${Date.now() - t0}ms)`);
  return { success: true, data: { action: 'solo_slide', html } };
}

module.exports = { genSlideWithAgent, genSoloSlideWithAgent };
