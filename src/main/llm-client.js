const https = require('https');
const http = require('http');
const { URL } = require('url');

function request(url, options, body, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, ...options },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on('error', (err) => {
      if (err.code === 'ECONNRESET' || err.message === 'socket hang up') {
        reject(new DOMException('Aborted', 'AbortError'));
      } else {
        reject(err);
      }
    });
    if (signal) {
      signal.addEventListener('abort', () => { req.destroy(); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    }
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Streaming request that collects SSE chunks and returns the full text
function requestStream(url, options, body, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, ...options },
      (res) => {
        if (res.statusCode !== 200) {
          let errData = '';
          res.on('data', c => { errData += c; });
          res.on('end', () => {
            try { resolve({ status: res.statusCode, text: '', body: JSON.parse(errData) }); }
            catch { resolve({ status: res.statusCode, text: '', body: errData }); }
          });
          return;
        }
        let text = '';
        let buf = '';
        res.on('data', (chunk) => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop(); // keep incomplete line
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const evt = JSON.parse(data);
              // Anthropic stream event
              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                text += evt.delta.text;
              }
              // OpenAI stream event
              const delta = evt.choices?.[0]?.delta?.content;
              if (delta) text += delta;
            } catch { /* ignore malformed chunks */ }
          }
        });
        res.on('end', () => { resolve({ status: res.statusCode, text }); });
      }
    );
    req.on('error', (err) => {
      if (err.code === 'ECONNRESET' || err.message === 'socket hang up') {
        reject(new DOMException('Aborted', 'AbortError'));
      } else {
        reject(err);
      }
    });
    if (signal) {
      signal.addEventListener('abort', () => { req.destroy(); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    }
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function stripThinkingTags(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
}

async function callLLM(messages, settings, maxTokens = 4096, signal) {
  const { apiProvider, apiKey, baseUrl, modelName } = settings;
  const base = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');

  if (apiProvider === 'anthropic') {
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMessages = messages.filter((m) => m.role !== 'system');
    const body = {
      model: modelName || 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
      stream: true,
      messages: userMessages,
      ...(systemMsg ? { system: systemMsg.content } : {}),
    };
    const res = await requestStream(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    }, body, signal);
    if (res.status !== 200) throw new Error(`Anthropic API error ${res.status}: ${JSON.stringify(res.body)}`);
    return res.text ?? '';
  } else {
    const body = {
      model: modelName || 'gpt-4o',
      messages,
      max_tokens: maxTokens,
      stream: true,
    };
    const res = await requestStream(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    }, body, signal);
    if (res.status !== 200) throw new Error(`LLM API error ${res.status}: ${JSON.stringify(res.body)}`);
    return stripThinkingTags(res.text ?? '');
  }
}

function parseJSONResponse(text) {
  if (!text) return null;

  // Strip markdown fences if present (even unclosed ones)
  const stripped = text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();

  // Try the stripped text first
  try { return JSON.parse(stripped); } catch { /* fall through */ }

  // Extract outermost { ... } — first { to last }
  const tryExtract = (src) => {
    const first = src.indexOf('{');
    const last = src.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try { return JSON.parse(src.slice(first, last + 1)); } catch { /* fall through */ }
    }
    return null;
  };

  const result = tryExtract(stripped) || tryExtract(text);
  if (result) return result;

  // Last resort: if JSON parse failed due to soloHtml containing unescaped chars,
  // extract action + slideId + soloHtml by splitting on the known key boundary
  const soloMatch = stripped.match(/"action"\s*:\s*"update_slide"/) &&
                    stripped.match(/"slideId"\s*:\s*"([^"]+)"/);
  if (soloMatch) {
    const slideId = soloMatch[1];
    // Find soloHtml value: everything between "soloHtml": " and the last "}
    const htmlStart = stripped.indexOf('"soloHtml"');
    if (htmlStart !== -1) {
      const valStart = stripped.indexOf('"', htmlStart + 10) + 1;
      // Walk backwards from end to find the closing structure
      const jsonEnd = stripped.lastIndexOf('"}');
      if (valStart > 0 && jsonEnd > valStart) {
        // Unescape the extracted string value
        let html = stripped.slice(valStart, jsonEnd).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
        return { action: 'update_slide', slideId, slide: { soloHtml: html } };
      }
    }
  }

  return null;
}

module.exports = { callLLM, parseJSONResponse };
