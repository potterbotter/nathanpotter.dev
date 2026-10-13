// Parse a JSON document that is still streaming in. Returns the largest valid prefix as a value:
// open strings are closed (so text "types out"), incomplete keys/values are dropped, and open
// arrays/objects are closed. Returns undefined if nothing usable has arrived yet.
export function parsePartialJson(text) {
  const s = String(text || '');
  const stack = []; // '{' or '['
  let inString = false, escaped = false, stringIsKey = false;
  let expectKey = false; // inside an object, waiting for a key
  let cut = -1, cutStack = null, cutCloseString = false; // last safe point

  const mark = (pos, closeString = false) => { cut = pos; cutStack = stack.slice(); cutCloseString = closeString; };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === '"') {
        inString = false;
        if (stringIsKey) { expectKey = false; } else { mark(i + 1); }
        continue;
      }
      // A partially streamed string value is a usable cut point (closed with a quote).
      if (!stringIsKey && c !== '\\') mark(i + 1, true);
      continue;
    }
    if (c === '"') { inString = true; stringIsKey = stack[stack.length - 1] === '{' && expectKey; if (!stringIsKey) mark(i, true); continue; }
    if (c === '{') { stack.push('{'); expectKey = true; mark(i + 1); continue; }
    if (c === '[') { stack.push('['); expectKey = false; mark(i + 1); continue; }
    if (c === '}' || c === ']') { stack.pop(); expectKey = false; mark(i + 1); continue; }
    if (c === ',') { expectKey = stack[stack.length - 1] === '{'; continue; }
    if (c === ':') { expectKey = false; continue; }
    if (/[-0-9.eE+tfalsenru]/.test(c)) {
      // literal or number: safe once it is followed by a delimiter
      const m = s.slice(i).match(/^(-?\d+(\.\d+)?([eE][-+]?\d+)?|true|false|null)/);
      if (m && i + m[0].length < s.length && /[\s,\]}]/.test(s[i + m[0].length])) { i += m[0].length - 1; mark(i + 1); }
      else if (m) i += m[0].length - 1;
    }
  }
  if (cut < 0) return undefined;
  let out = s.slice(0, cut);
  if (cutCloseString) {
    // drop a dangling backslash before closing the string
    out = out.replace(/\\+$/, (m) => (m.length % 2 ? m.slice(0, -1) : m)) + '"';
  }
  out = out.replace(/,\s*$/, '');
  for (let k = cutStack.length - 1; k >= 0; k--) out += cutStack[k] === '{' ? '}' : ']';
  // A trailing key with no value ("key": or "key") makes the object invalid; trim and retry.
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return JSON.parse(out); } catch {
      out = out.replace(/,?\s*"[^"]*"\s*:?\s*(?=[}\]]+$)/, '');
    }
  }
  return undefined;
}
