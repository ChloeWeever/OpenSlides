// progress.js — small terminal helpers
const isTTY = !!(process.stderr.isTTY);

function step(msg) {
  process.stderr.write(msg + '\n');
}

function inline(msg) {
  if (isTTY) {
    process.stderr.write('\r' + ' '.repeat(80) + '\r' + msg);
  } else {
    process.stderr.write(msg + '\n');
  }
}

function inlineDone(msg) {
  if (isTTY) {
    process.stderr.write('\r' + ' '.repeat(80) + '\r' + msg + '\n');
  } else {
    process.stderr.write(msg + '\n');
  }
}

function fmtDur(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

module.exports = { step, inline, inlineDone, fmtDur };
