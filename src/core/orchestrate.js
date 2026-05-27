// orchestrate.js — pure prompts + outline/title helpers shared by Electron app and CLI.
// Extracted from src/main/ipc-handlers.js with no behavior change.

const { callLLM, parseJSONResponse } = require('../main/llm-client');

const SYSTEM_PROMPT = `You are an AI presentation assistant. You create beautiful, modern slides using a rich design system.

Respond ONLY with valid JSON in one of these formats:

1. Replace all slides: {"action":"replace_all","slides":[...]}
2. Add slides:        {"action":"add_slides","slides":[...]}
3. Update one slide:  {"action":"update_slide","slideId":"<id>","slide":{...}}
   - For Solo slides (soloHtml present): {"action":"update_slide","slideId":"<id>","slide":{"soloHtml":"<complete updated html>"}}
4. Delete a slide:    {"action":"delete_slide","slideId":"<id>"}
5. Chat only:         {"action":"message","message":"<text>"}
6. Generate full deck:{"action":"generate_presentation","request":"<user's original request text>"}

## Slide schema
{
  "id": "unique-string",
  "layout": "title" | "content" | "section" | "two-column" | "big-quote" | "blank",
  "background": "#hexcolor",
  "color": "#hexcolor",
  "transition": "slide" | "fade" | "zoom" | "none",
  "sectionNum": 1,
  "elements": [ ... ]
}

## Element types
{"type":"kicker","text":"EYEBROW LABEL"}
{"type":"heading","text":"Main Title","gradient":true}
{"type":"subheading","text":"Supporting headline"}
{"type":"body","text":"Paragraph text"}
{"type":"bullets","items":["Point one","Point two","Point three"]}
{"type":"divider"}
{"type":"pills","items":["Tag A","Tag B",{"text":"Accent","accent":true}]}
{"type":"image","src":"https://...","alt":"description","width":"60%","height":"300px","align":"center","float":"left","objectFit":"cover","radius":12,"caption":"Figure 1"}
{"type":"images","cols":3,"gap":16,"height":200,"objectFit":"cover","radius":8,"items":[{"src":"https://...","alt":"...","caption":"optional"},{"src":"https://...","alt":"..."}]}
{"type":"quote","text":"Inspiring words here.","author":"Name, Title"}
{"type":"stats","items":[{"label":"METRIC","value":"42K","delta":"+12%"},{"label":"ANOTHER","value":"$1.2M"}]}
{"type":"cards","cols":3,"items":[{"icon":"🚀","title":"Card Title","body":"Card description","accent":true},{"icon":"💡","title":"Card Title","body":"Card description"}]}
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
Use kind:"svg" only as a last resort when none of the built-in kinds fit.

## When to use generate_presentation
Use {"action":"generate_presentation","request":"..."} when the user wants to create a NEW multi-slide presentation from scratch (e.g. "create a presentation about X", "make me a 10-slide deck on Y", "生成一个关于X的PPT").
Do NOT use it for editing, updating, or adding to existing slides — use replace_all / add_slides / update_slide instead.`;

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

const SOLO_OUTLINE_PROMPT = `You are a presentation planning assistant. Given the user's request, output a slide outline as JSON.

Respond ONLY with raw JSON — no markdown, no explanation:
{
  "action": "outline",
  "theme": {
    "bg": "#f9f7f4",
    "accent": "#d97757",
    "text": "#1a1714",
    "subtext": "#6b6560",
    "font": "system-ui, -apple-system, 'Segoe UI', sans-serif",
    "style": "clean light editorial"
  },
  "slides": [
    {
      "id": "slide-1",
      "title": "Slide Title",
      "notes": "Key points and content for this slide",
      "style": "hero — large headline, bold accent color, minimal elements",
      "imageRef": null
    }
  ]
}

Rules:
- theme: ONE consistent design system for the whole deck. Default is Anthropic Claude light style (warm off-white bg, coral accent, dark text) — override only when the topic clearly calls for a different style (e.g. tech dark theme, bold startup colors). style = 2-4 descriptive words (e.g. "clean light editorial", "dark tech minimal", "bold colorful startup")
- id: "slide-1", "slide-2", … (sequential)
- title: the real heading text for this slide
- notes: 1-3 sentences describing what this slide should cover
- style (per slide): layout + mood hint for the designer, e.g. "hero full-bleed", "two-column data", "big quote centered", "icon grid", "timeline horizontal", "chart + callout"
- imageRef: if workspace images are provided, assign EACH image to AT MOST ONE slide where it fits best — use the exact filename (e.g. "app_ui.png"). Set to null for slides that need no image. Never assign the same image to more than one slide.
- Aim for 6-12 slides unless the request clearly needs more or fewer`;

async function genOutline(userRequest, settings, signal) {
  const messages = [
    { role: 'system', content: OUTLINE_PROMPT },
    { role: 'user', content: userRequest },
  ];
  const rawText = await callLLM(messages, settings, 16000, signal);
  const parsed = parseJSONResponse(rawText);
  if (!parsed) return { success: false, error: `JSON parse failed: ${rawText.slice(0, 300)}` };
  const slides = parsed.slides || parsed;
  if (!Array.isArray(slides) || !slides.length) {
    return { success: false, error: `Outline format error: ${rawText.slice(0, 300)}` };
  }
  return { success: true, data: { action: 'outline', slides }, raw: rawText };
}

async function genSoloOutline({ text, workspaceFiles }, settings, signal) {
  let userContent = text;
  let systemContent = SOLO_OUTLINE_PROMPT;

  if (workspaceFiles?.length) {
    const textFiles = workspaceFiles.filter(f => f.type === 'text');
    const imageFiles = workspaceFiles.filter(f => f.type === 'image');
    if (imageFiles.length) {
      systemContent += `\n\nAvailable workspace images (assign each to at most one slide via imageRef):\n` +
        imageFiles.map(f => {
          const dims = (f.width && f.height) ? ` ${f.width}×${f.height}px` : '';
          const ocr  = f.description ? ` — OCR: "${f.description.slice(0, 300)}"` : '';
          return `  - "${f.name}"${dims}${ocr}`;
        }).join('\n');
    }
    if (textFiles.length) {
      userContent += '\n\n--- Reference documents ---\n' +
        textFiles.map(f => `[${f.name}]\n${f.text}`).join('\n\n');
    }
  }

  const messages = [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ];
  const rawText = await callLLM(messages, settings, 16000, signal);
  const parsed = parseJSONResponse(rawText);
  if (!parsed) return { success: false, error: `JSON parse failed: ${rawText.slice(0, 300)}` };
  const slides = parsed.slides || parsed;
  if (!Array.isArray(slides) || !slides.length) {
    return { success: false, error: `Outline format error: ${rawText.slice(0, 300)}` };
  }
  const theme = parsed.theme || null;
  return { success: true, data: { action: 'outline', slides, theme }, raw: rawText };
}

async function genTitle(slideTitles, settings, signal) {
  const list = slideTitles.slice(0, 8).map((t, i) => `${i + 1}. ${t}`).join('\n');
  const messages = [
    { role: 'system', content: 'You are a concise naming assistant. Given a list of slide titles, output ONLY a short presentation title (5-8 words, no punctuation, no quotes). Nothing else.' },
    { role: 'user', content: `Slide titles:\n${list}\n\nPresentation title:` },
  ];
  const raw = await callLLM(messages, settings, 32, signal);
  return raw.trim().replace(/^["']|["']$/g, '').slice(0, 60);
}

module.exports = {
  SYSTEM_PROMPT,
  OUTLINE_PROMPT,
  SOLO_OUTLINE_PROMPT,
  genOutline,
  genSoloOutline,
  genTitle,
};
