// args.js — minimal argv parser. Supports:
//   subcommand positional, --long, --long=val, --long val, -s, -s val, -sval, --no-flag
// No deps.

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { _: [], flags: {} };
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '--') {
      out._.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const body = a.slice(2);
      const eq = body.indexOf('=');
      if (eq !== -1) {
        out.flags[body.slice(0, eq)] = body.slice(eq + 1);
        i++;
        continue;
      }
      if (body.startsWith('no-')) {
        out.flags[body.slice(3)] = false;
        i++;
        continue;
      }
      const next = args[i + 1];
      if (next == null || next.startsWith('-')) {
        out.flags[body] = true;
        i++;
      } else {
        out.flags[body] = next;
        i += 2;
      }
    } else if (a.startsWith('-') && a.length > 1) {
      const body = a.slice(1);
      // -m"value" or -mvalue or -m value
      if (body.length > 1) {
        out.flags[body[0]] = body.slice(1);
        i++;
        continue;
      }
      const next = args[i + 1];
      if (next == null || next.startsWith('-')) {
        out.flags[body] = true;
        i++;
      } else {
        out.flags[body] = next;
        i += 2;
      }
    } else {
      out._.push(a);
      i++;
    }
  }
  return out;
}

// Pull a flag by any of its aliases; first match wins.
function flag(parsed, ...aliases) {
  for (const k of aliases) {
    if (Object.prototype.hasOwnProperty.call(parsed.flags, k)) return parsed.flags[k];
  }
  return undefined;
}

module.exports = { parseArgs, flag };
