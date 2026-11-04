import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import sql from 'highlight.js/lib/languages/sql';
import java from 'highlight.js/lib/languages/java';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import php from 'highlight.js/lib/languages/php';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import kotlin from 'highlight.js/lib/languages/kotlin';
import swift from 'highlight.js/lib/languages/swift';
import ruby from 'highlight.js/lib/languages/ruby';
import diff from 'highlight.js/lib/languages/diff';
import { esc } from './util-esc.js';

const LIBS = {
  javascript,
  typescript,
  python,
  bash,
  json,
  css,
  xml,
  sql,
  java,
  go,
  rust,
  php,
  c,
  cpp,
  csharp,
  yaml,
  markdown,
  dockerfile,
  kotlin,
  swift,
  ruby,
  diff,
};
Object.entries(LIBS).forEach(([name, def]) => hljs.registerLanguage(name, def));

/** [id, label, file extension] — id is what goes after the ``` fence */
export const LANGUAGES = [
  ['javascript', 'JavaScript', 'js'],
  ['typescript', 'TypeScript', 'ts'],
  ['python', 'Python', 'py'],
  ['html', 'HTML', 'html'],
  ['css', 'CSS', 'css'],
  ['json', 'JSON', 'json'],
  ['bash', 'Shell / Bash', 'sh'],
  ['sql', 'SQL', 'sql'],
  ['java', 'Java', 'java'],
  ['kotlin', 'Kotlin', 'kt'],
  ['swift', 'Swift', 'swift'],
  ['go', 'Go', 'go'],
  ['rust', 'Rust', 'rs'],
  ['php', 'PHP', 'php'],
  ['ruby', 'Ruby', 'rb'],
  ['c', 'C', 'c'],
  ['cpp', 'C++', 'cpp'],
  ['csharp', 'C#', 'cs'],
  ['yaml', 'YAML', 'yml'],
  ['markdown', 'Markdown', 'md'],
  ['dockerfile', 'Dockerfile', 'Dockerfile'],
  ['diff', 'Diff / patch', 'diff'],
  ['text', 'Plain text', 'txt'],
];
const ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  html: 'xml',
  htm: 'xml',
  vue: 'xml',
  svg: 'xml',
  yml: 'yaml',
  md: 'markdown',
  cs: 'csharp',
  'c++': 'cpp',
  'c#': 'csharp',
  rs: 'rust',
  rb: 'ruby',
  kt: 'kotlin',
  docker: 'dockerfile',
  patch: 'diff',
  plain: 'text',
  txt: 'text',
  plaintext: 'text',
};
export const normalizeLang = (l) => {
  const k = String(l || '').toLowerCase();
  return ALIASES[k] || k;
};
export const langLabel = (l) => {
  const id = String(l || '').toLowerCase();
  return (
    LANGUAGES.find((x) => x[0] === id || x[0] === normalizeLang(id))?.[1] || (id ? id : 'Code')
  );
};
export const langExt = (l) =>
  LANGUAGES.find(
    (x) => x[0] === (String(l).toLowerCase() === 'html' ? 'html' : normalizeLang(l)),
  )?.[2] || 'txt';

const AUTO_SET = Object.keys(LIBS);
/** returns { html, lang } — lang is the detected/used language id ('text' when nothing matched) */
export function highlight(code, lang) {
  const want = normalizeLang(lang);
  try {
    if (want && want !== 'text' && hljs.getLanguage(want))
      return {
        html: hljs.highlight(code, { language: want, ignoreIllegals: true }).value,
        lang: want,
      };
    if (!want && code.length < 20000) {
      const r = hljs.highlightAuto(code, AUTO_SET);
      if (r.language && r.relevance >= 3)
        return { html: r.value, lang: r.language === 'xml' ? 'html' : r.language };
    }
  } catch {
    /* fall through to plain text */
  }
  return { html: esc(code), lang: 'text' };
}

/** splits highlighted HTML into per-line HTML, closing and re-opening spans at line breaks */
export function splitLines(html) {
  const lines = [];
  let cur = '';
  const open = [];
  const re = /(<span[^>]*>)|(<\/span>)|(\n)|([^<\n]+)|(<)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) {
      open.push(m[1]);
      cur += m[1];
    } else if (m[2]) {
      open.pop();
      cur += m[2];
    } else if (m[3]) {
      cur += '</span>'.repeat(open.length);
      lines.push(cur);
      cur = open.join('');
    } else cur += m[0];
  }
  lines.push(cur + '</span>'.repeat(open.length));
  return lines;
}

export const COLLAPSE_AT = 16;
/** HTML for one code block in a message (safe: everything is escaped by highlight.js or esc()) */
export function renderCodeBlock(lang, file, code) {
  const { html, lang: used } = highlight(code, lang);
  const lines = splitLines(html);
  const long = lines.length > COLLAPSE_AT;
  const gutter = lines.map((_, i) => i + 1).join('\n');
  const shownLang = langLabel(lang || used);
  const ico = (d) =>
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  return `<div class="codeblock${long ? ' collapsed' : ''}" data-lang="${esc(used)}" data-file="${esc(file || '')}" data-lines="${lines.length}">
<div class="ch"><span class="cl"><b>${esc(shownLang)}</b>${file ? `<span class="cf">${esc(file)}</span>` : ''}<span class="cn">${lines.length} line${lines.length === 1 ? '' : 's'}</span></span>
<span class="ca"><button type="button" data-code-act="copy" aria-label="Copy code">${ico('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>')}<span>Copy</span></button><button type="button" data-code-act="download" aria-label="Download code">${ico('<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>')}<span>Save</span></button></span></div>
<div class="cb"><div class="gutter" aria-hidden="true">${gutter}</div><pre tabindex="0"><code class="hljs">${lines.join('\n')}</code></pre></div>
${long ? `<button type="button" class="cx" data-code-act="expand">Show all ${lines.length} lines</button>` : ''}</div>`;
}

/** heuristic: does pasted text look like source code? */
export function looksLikeCode(text) {
  const t = String(text || '');
  const lines = t.split('\n');
  if (lines.length < 3 || t.length < 30 || /```/.test(t)) return false;
  const score = [
    /[{};]\s*$/m,
    /^\s{2,}\S/m,
    /\b(function|const|let|var|def|class|import|return|public|private|void|SELECT|FROM|if \(|for \(|=>)\b/,
    /<\/?[a-z][\w-]*[^>]*>/i,
    /[()[\]]\s*[;{:]?\s*$/m,
  ].filter((r) => r.test(t)).length;
  return score >= 2;
}
export const guessLang = (code) => {
  const r = highlight(code, '');
  return r.lang === 'text' ? '' : r.lang;
};
