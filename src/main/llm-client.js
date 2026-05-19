const https = require('https');
const http = require('http');
const { URL } = require('url');

function request(url, options, body) {
  return new Promise((resolve, reject) => {
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
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function callLLM(messages, settings) {
  const { apiProvider, apiKey, baseUrl, modelName } = settings;
  // Strip trailing /v1 so we can always append /v1/... ourselves
  const base = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');

  if (apiProvider === 'anthropic') {
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMessages = messages.filter((m) => m.role !== 'system');
    const body = {
      model: modelName || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: userMessages,
      ...(systemMsg ? { system: systemMsg.content } : {}),
    };
    const res = await request(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    }, body);
    if (res.status !== 200) throw new Error(`Anthropic API error ${res.status}: ${JSON.stringify(res.body)}`);
    return res.body.content?.[0]?.text ?? '';
  } else {
    // OpenAI / LiteLLM
    const body = {
      model: modelName || 'gpt-4o',
      messages,
      max_tokens: 4096,
    };
    const res = await request(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    }, body);
    if (res.status !== 200) throw new Error(`LLM API error ${res.status}: ${JSON.stringify(res.body)}`);
    return res.body.choices?.[0]?.message?.content ?? '';
  }
}

function parseJSONResponse(text) {
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (match) {
    try { return JSON.parse(match[1]); } catch { /* fall through */ }
  }
  try { return JSON.parse(text); } catch { return null; }
}

module.exports = { callLLM, parseJSONResponse };
