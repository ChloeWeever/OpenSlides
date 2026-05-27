// config.js — load & validate ~/.openslides/config.yaml
const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const DEFAULT_PATH = path.join(os.homedir(), '.openslides', 'config.yaml');

const PROVIDER_DEFAULT_BASE = {
  openai:    'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  litellm:   '',
};

const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','webp','svg']);

function inlineLogo(logo, configDir) {
  if (!logo || !logo.enabled) return logo;
  if (logo.dataUrl) return logo;
  if (!logo.path) return logo;
  const absPath = path.isAbsolute(logo.path) ? logo.path : path.join(configDir, logo.path);
  if (!fs.existsSync(absPath)) {
    throw new Error(`logo.path not found: ${absPath}`);
  }
  const ext = path.extname(absPath).slice(1).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) throw new Error(`logo.path unsupported extension: ${ext}`);
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  const data = fs.readFileSync(absPath);
  return { ...logo, dataUrl: `data:${mime};base64,${data.toString('base64')}` };
}

function resolveConfigPath(override) {
  if (override) return path.resolve(override);
  return DEFAULT_PATH;
}

function load(override) {
  const file = resolveConfigPath(override);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Config file not found: ${file}\n` +
      `Create one at ~/.openslides/config.yaml. Example:\n\n` +
      `provider: openai\napiKey: sk-...\nmodel: gpt-4o\n`
    );
  }
  let raw;
  try { raw = yaml.load(fs.readFileSync(file, 'utf8')) || {}; }
  catch (e) { throw new Error(`Failed to parse ${file}: ${e.message}`); }

  const provider = (raw.provider || 'openai').toLowerCase();
  if (!['openai', 'anthropic', 'litellm'].includes(provider)) {
    throw new Error(`Invalid provider "${provider}". Use openai | anthropic | litellm.`);
  }
  if (!raw.apiKey) throw new Error(`Missing apiKey in ${file}`);
  if (!raw.model)  throw new Error(`Missing model in ${file}`);

  const settings = {
    apiProvider: provider,
    apiKey: raw.apiKey,
    baseUrl: raw.baseUrl || PROVIDER_DEFAULT_BASE[provider] || '',
    modelName: raw.model,
  };

  const logo = inlineLogo(raw.logo, path.dirname(file));

  return { configPath: file, settings, logo };
}

function maskedSummary({ configPath, settings, logo }) {
  const masked = settings.apiKey
    ? settings.apiKey.slice(0, 4) + '…' + settings.apiKey.slice(-3)
    : '(none)';
  const lines = [
    `config:   ${configPath}`,
    `provider: ${settings.apiProvider}`,
    `apiKey:   ${masked}`,
    `baseUrl:  ${settings.baseUrl || '(provider default)'}`,
    `model:    ${settings.modelName}`,
  ];
  if (logo?.enabled) {
    lines.push(`logo:     ${logo.position || 'bottom-right'}, width=${logo.width||80}, opacity=${logo.opacity??1}`);
  }
  return lines.join('\n');
}

module.exports = { load, resolveConfigPath, maskedSummary, DEFAULT_PATH };
