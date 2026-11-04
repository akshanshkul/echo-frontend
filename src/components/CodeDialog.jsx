import { useMemo, useRef, useState } from 'react';
import { Button, Field, Input, Modal, Select } from './ui.jsx';
import { LANGUAGES, guessLang, langExt, renderCodeBlock } from '../code.js';

const MAX = 25000;

/** "Send code" editor: language, optional file name, line numbers, live highlighted preview */
export default function CodeDialog({ initialCode = '', initialLang = '', onSend, onClose }) {
  const [code, setCode] = useState(initialCode);
  const [lang, setLang] = useState(initialLang); // '' = auto-detect
  const [file, setFile] = useState('');
  const [note, setNote] = useState('');
  const gutter = useRef(null);
  const ta = useRef(null);

  const detected = useMemo(() => (lang ? lang : code.trim() ? guessLang(code) : ''), [lang, code]);
  const preview = useMemo(
    () =>
      code.trim() ? renderCodeBlock(lang || detected, file.trim(), code.replace(/\n$/, '')) : '',
    [code, lang, detected, file],
  );
  const lines = Math.max(code.split('\n').length, 1);
  const tooLong = code.length > MAX;

  const onKey = (e) => {
    const el = e.currentTarget;
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en, value } = el;
      if (e.shiftKey) {
        // outdent the current line(s)
        const ls = value.lastIndexOf('\n', s - 1) + 1;
        const block = value.slice(ls, en).replace(/^( {1,2}|\t)/gm, '');
        const removed = en - ls - block.length;
        setCode(value.slice(0, ls) + block + value.slice(en));
        requestAnimationFrame(() =>
          el.setSelectionRange(Math.max(s - Math.min(2, removed), ls), en - removed),
        );
      } else {
        setCode(value.slice(0, s) + '  ' + value.slice(en));
        requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
      }
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // keep the indentation of the previous line
      const { selectionStart: s, value } = el;
      const ls = value.lastIndexOf('\n', s - 1) + 1;
      const indent = (value.slice(ls, s).match(/^[ \t]*/) || [''])[0];
      const extra = /[{([:]\s*$/.test(value.slice(ls, s)) ? '  ' : '';
      if (indent || extra) {
        e.preventDefault();
        const ins = '\n' + indent + extra;
        setCode(value.slice(0, s) + ins + value.slice(el.selectionEnd));
        requestAnimationFrame(() => el.setSelectionRange(s + ins.length, s + ins.length));
      }
    }
  };
  const send = () => {
    if (!code.trim() || tooLong) return;
    const l = lang || detected;
    const fence =
      '```' +
      (l === 'text' ? '' : l) +
      (file.trim() ? ' ' + file.trim() : '') +
      '\n' +
      code.replace(/\s+$/, '') +
      '\n```';
    onSend((note.trim() ? note.trim() + '\n' : '') + fence);
  };

  return (
    <Modal
      title="Send code"
      cls="lg"
      onClose={onClose}
      foot={[
        <span key="h" className="mr-auto self-center text-xs text-ink-3 max-sm:hidden">
          Tab indents · Ctrl/⌘ + Enter sends
        </span>,
        <Button key="c" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="s" variant="primary" disabled={!code.trim() || tooLong} onClick={send}>
          Send code
        </Button>,
      ]}
    >
      <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-3 max-sm:grid-cols-1">
        <Field label="Language">
          <Select value={lang} onChange={(e) => setLang(e.target.value)} className="w-full">
            <option value="">
              {detected
                ? `Auto-detect (${LANGUAGES.find((x) => x[0] === detected)?.[1] || detected})`
                : 'Auto-detect'}
            </option>
            {LANGUAGES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="File name (optional)">
          <Input
            placeholder={`example.${langExt(lang || detected || 'text')}`}
            value={file}
            maxLength={80}
            onChange={(e) => setFile(e.target.value.replace(/[`\n]/g, ''))}
          />
        </Field>
        <Field label="Message (optional)">
          <Input
            placeholder="Say something about this code…"
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value.replace(/```/g, ''))}
          />
        </Field>
      </div>
      <div className="code-editor mt-1">
        <div className="gutter" ref={gutter} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
        </div>
        <textarea
          ref={ta}
          autoFocus
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Code"
          placeholder="Paste or type your code here"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={onKey}
          onScroll={(e) => gutter.current && (gutter.current.scrollTop = e.currentTarget.scrollTop)}
        />
      </div>
      <div className={`mt-1 text-right text-xs ${tooLong ? 'text-danger' : 'text-ink-3'}`}>
        {code.length.toLocaleString()} / {MAX.toLocaleString()} characters · {lines} line
        {lines === 1 ? '' : 's'}
      </div>
      {preview && (
        <>
          <div className="mb-1 mt-2 text-xs font-semibold text-ink-2">Preview</div>
          <div className="msgs-preview" dangerouslySetInnerHTML={{ __html: preview }} />
        </>
      )}
    </Modal>
  );
}
