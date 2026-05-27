#!/usr/bin/env node
// openslides — CLI entry. Dispatches subcommands.

const { parseArgs } = require('./args');
const config = require('./config');

const HELP = `openslides — AI presentation editor (CLI)

Usage:
  openslides build  [options]
  openslides edit   <input.html> [options]
  openslides config [--config <path>]
  openslides --help | --version

Build options:
  -m, --message <text>      Inline prompt
  -f, --file <path>         Read prompt from a file (mutually exclusive with -m)
  -w, --workspace <dir>     Folder of images / text files to feed the agent
      --mode <solo|template>  Generation mode (default: solo)
      --ocr                 Run OCR on workspace images (requires tesseract.js)
  -o, --output <path>       Output .html path (default: ./<auto-title>.html)
      --title <text>        Override deck title (skip title-gen LLM call)
      --no-logo             Skip logo overlay even if config has one
      --config <path>       Override config file
      --verbose             Stream agent logs

Edit options:
  -m, --message <text>      Inline edit prompt
  -f, --file <path>         Edit prompt file
  -o, --output <path>       Output path (default: overwrite input)
      --config <path>

Config:
  ${config.DEFAULT_PATH}

Repo: https://github.com/ChloeWeever/OpenSlides
`;

async function main() {
  const argv = parseArgs(process.argv);
  const cmd = argv._[0];

  if (argv.flags.help || argv.flags.h || cmd === 'help' || (!cmd && process.argv.length <= 2)) {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv.flags.version || argv.flags.V) {
    const pkg = require('../../package.json');
    process.stdout.write(pkg.version + '\n');
    return 0;
  }

  switch (cmd) {
    case 'build':  return require('./build').run(argv);
    case 'edit':   return require('./edit').run(argv);
    case 'config': return runConfig(argv);
    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
      return 2;
  }
}

function runConfig(argv) {
  const cfg = config.load(argv.flags.config);
  process.stdout.write(config.maskedSummary(cfg) + '\n');
  return 0;
}

main()
  .then(code => process.exit(code || 0))
  .catch(err => {
    process.stderr.write(`error: ${err.message}\n`);
    if (process.env.OPENSLIDES_DEBUG) process.stderr.write(err.stack + '\n');
    process.exit(1);
  });
