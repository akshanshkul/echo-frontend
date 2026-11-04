import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { EmojiPicker, Icon, IconBtn, Menu } from './ui.jsx';
import { dur, size, snippet } from '../util.js';
import { api } from '../api.js';
import CodeDialog from './CodeDialog.jsx';
import { looksLikeCode, guessLang } from '../code.js';

const imageMeta = (file) =>
  new Promise((res) => {
    const u = URL.createObjectURL(file),
      i = new Image();
    i.onload = () => {
      res({ width: i.width, height: i.height });
      URL.revokeObjectURL(u);
    };
    i.onerror = () => {
      res({});
      URL.revokeObjectURL(u);
    };
    i.src = u;
  });

export default function Composer({ conv, reply, editing, onCancel, files, clearFiles, canPost }) {
  const { state, act } = useStore();
  const { settings, me } = state;
  const ta = useRef(null);
  const lastTyping = useRef(0);
  const fileRef = useRef(null);
  const [text, setText] = useState('');
  const [tray, setTray] = useState([]);
  const [emoji, setEmoji] = useState(false);
  const [fmtBar, setFmtBar] = useState(false);
  const [rec, setRec] = useState(null);
  const [menu, setMenu] = useState(null);
  const [poll, setPoll] = useState(null);
  const [codeOpen, setCodeOpen] = useState(null); // { code, lang } while the Send code dialog is open
  const [codeHint, setCodeHint] = useState(null); // pasted text that looks like code
  const draftKey = 'loom.draft.' + conv.id;

  // restore draft per conversation; reset transient state when switching
  useEffect(() => {
    setText(localStorage.getItem(draftKey) || '');
    setTray([]);
    setEmoji(false);
  }, [conv.id]);
  useEffect(() => {
    if (editing) {
      setText(editing.text);
      ta.current?.focus();
    }
  }, [editing]);
  useEffect(() => {
    if (reply) ta.current?.focus();
  }, [reply]);
  useEffect(() => {
    if (!editing) {
      text ? localStorage.setItem(draftKey, text) : localStorage.removeItem(draftKey);
    }
  }, [text]);
  useEffect(() => {
    const el = ta.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 180) + 'px';
    }
  }, [text]);
  useEffect(() => {
    if (files?.length) {
      addFiles(files);
      clearFiles();
    }
  }, [files]);

  const addFiles = async (list) => {
    for (const file of Array.from(list).slice(0, 10)) {
      const id = Math.random().toString(36).slice(2);
      const item = {
        id,
        name: file.name,
        size: file.size,
        kind: file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('video/')
            ? 'video'
            : file.type.startsWith('audio/')
              ? 'audio'
              : 'file',
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        progress: 0,
      };
      setTray((t) => [...t, item]);
      (async () => {
        try {
          const extra = item.kind === 'image' ? await imageMeta(file) : {};
          const att = await act.upload(file, {
            extra,
            onProgress: (p) =>
              setTray((t) => t.map((x) => (x.id === id ? { ...x, progress: p } : x))),
          });
          setTray((t) => t.map((x) => (x.id === id ? { ...x, progress: 1, att } : x)));
        } catch (e) {
          setTray((t) => t.filter((x) => x.id !== id));
          act.fail(e);
        }
      })();
      act.typing(conv.id, 'uploading');
    }
  };
  const uploading = tray.some((t) => !t.att);
  const canSend = (text.trim() || tray.length) && !uploading;

  const submit = async () => {
    if (!canSend) return;
    const body = text.trim();
    if (editing) {
      await act.edit(editing, body);
      setText('');
      onCancel();
      return;
    }
    act.typing(conv.id, null);
    act.send(conv.id, { text: body, attachments: tray.map((t) => t.att), replyTo: reply?.id });
    tray.forEach((t) => t.preview && URL.revokeObjectURL(t.preview));
    setText('');
    setTray([]);
    onCancel();
    localStorage.removeItem(draftKey);
  };
  const onKey = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && ['b', 'i', 'u'].includes(e.key.toLowerCase()) && !e.shiftKey) {
      e.preventDefault();
      wrap({ b: '**', i: '_', u: '__' }[e.key.toLowerCase()]);
      return;
    }
    if (mod && e.shiftKey && ['x', 'h'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      wrap({ x: '~~', h: '==' }[e.key.toLowerCase()]);
      return;
    }
    if (
      e.key === 'Enter' &&
      (settings.enterSend ? !e.shiftKey && !e.nativeEvent.isComposing : mod)
    ) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape' && (reply || editing)) {
      onCancel();
      setText('');
    } else if (e.key === 'ArrowUp' && !text) {
      // edit last own message
      const list = state.msgs[conv.id]?.list || [];
      const mine = [...list]
        .reverse()
        .find(
          (m) => m.sender === me.id && !m.deleted && m.type !== 'poll' && !m.id.startsWith('tmp-'),
        );
      if (mine) {
        e.preventDefault();
        onCancel(mine);
      }
    }
  };
  const onInput = (e) => {
    setText(e.target.value);
    const n = Date.now();
    if (n - lastTyping.current > 2500) {
      lastTyping.current = n;
      act.typing(conv.id, 'typing');
    }
  };
  const wrap = (a, b = a) => {
    const el = ta.current,
      s = el.selectionStart,
      e = el.selectionEnd,
      sel = text.slice(s, e) || 'text';
    setText(text.slice(0, s) + a + sel + b + text.slice(e));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(s + a.length, s + a.length + sel.length);
    });
  };
  const clearFmt = () => {
    const el = ta.current,
      s = el.selectionStart,
      e = el.selectionEnd;
    if (s === e) return el.focus();
    const out = text
      .slice(s, e)
      .replace(/(\*\*|__|~~|==|\|\||`)/g, '')
      .replace(/(^|\s)_([^_\n]+)_(?=$|\s)/g, '$1$2')
      .replace(/^(#{1,3}|>|-|\d+\.) /gm, '');
    setText(text.slice(0, s) + out + text.slice(e));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(s, s + out.length);
    });
  };
  const prefix = (fn) => {
    const el = ta.current,
      s = el.selectionStart,
      ls = text.lastIndexOf('\n', s - 1) + 1;
    let le = text.indexOf('\n', el.selectionEnd);
    if (le < 0) le = text.length;
    setText(text.slice(0, ls) + text.slice(ls, le).split('\n').map(fn).join('\n') + text.slice(le));
    el.focus();
  };
  const insert = (t) => {
    const el = ta.current,
      s = el.selectionStart;
    setText(text.slice(0, s) + t + text.slice(el.selectionEnd));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(s + t.length, s + t.length);
    });
  };

  /* voice notes: real MediaRecorder (needs mic permission), uploaded to S3 */
  const recRef = useRef(null);
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      const t0 = Date.now();
      mr.ondataavailable = (e) => chunks.push(e.data);
      const timer = setInterval(
        () => setRec((r) => (r ? { ...r, t: Math.round((Date.now() - t0) / 1000) } : r)),
        500,
      );
      recRef.current = { mr, stream, chunks, timer, t0, cancelled: false };
      mr.start();
      setRec({ t: 0 });
      act.typing(conv.id, 'recording');
    } catch {
      act.toast('Microphone access was denied or is unavailable', { icon: 'microphone-off' });
    }
  };
  const stopRec = (send) => {
    const r = recRef.current;
    if (!r) return;
    r.cancelled = !send;
    clearInterval(r.timer);
    r.mr.onstop = async () => {
      r.stream.getTracks().forEach((t) => t.stop());
      act.typing(conv.id, null);
      setRec(null);
      recRef.current = null;
      if (r.cancelled) return;
      const duration = Math.max(1, Math.round((Date.now() - r.t0) / 1000));
      const type = r.mr.mimeType || 'audio/webm';
      const file = new File(
        r.chunks,
        `voice-${Date.now()}.${type.includes('mp4') ? 'm4a' : 'webm'}`,
        { type },
      );
      try {
        const att = await act.upload(file, { kind: 'voice', extra: { duration } });
        act.send(conv.id, { text: '', attachments: [att], replyTo: reply?.id });
        onCancel();
      } catch (e) {
        act.fail(e);
      }
    };
    r.mr.stop();
  };
  useEffect(
    () => () => {
      if (recRef.current) {
        recRef.current.cancelled = true;
        try {
          recRef.current.mr.stop();
        } catch {}
      }
    },
    [conv.id],
  );

  const createPoll = async () => {
    const opts = poll.options.map((o) => o.trim()).filter(Boolean);
    if (!poll.q.trim() || opts.length < 2)
      return act.toast('Add a question and at least two options', { icon: 'alert-circle' });
    act.send(conv.id, {
      type: 'poll',
      poll: { question: poll.q, multi: poll.multi, options: opts },
    });
    setPoll(null);
  };

  if (!canPost)
    return (
      <div className="composer-wrap">
        <div className="readonly-bar" style={{ border: 0, background: 'none' }}>
          <Icon n="speakerphone" s={18} /> Only admins can post in this channel.
        </div>
      </div>
    );
  const ctx = editing || reply;
  return (
    <div className="composer-wrap">
      <div className="composer-inner">
        {ctx && (
          <div className="ctx-bar">
            <Icon n={editing ? 'pencil' : 'corner-up-left'} s={18} />
            <div className="ct">
              <b>
                {editing
                  ? 'Editing message'
                  : 'Replying to ' +
                    (conv.members.find((m) => m.user.id === reply.sender)?.user.name || 'message')}
              </b>
              <span>{snippet(ctx)}</span>
            </div>
            <IconBtn
              n="x"
              s={16}
              label="Cancel"
              className="sm"
              onClick={() => {
                onCancel();
                if (editing) setText('');
              }}
            />
          </div>
        )}
        {tray.length > 0 && (
          <div className="tray">
            {tray.map((t) => (
              <div className="tchip" key={t.id}>
                {t.preview ? (
                  <img src={t.preview} alt="" />
                ) : (
                  <span className="fi">
                    <Icon
                      n={t.kind === 'video' ? 'movie' : t.kind === 'audio' ? 'music' : 'file-text'}
                      s={20}
                    />
                  </span>
                )}
                <div className="nm">
                  <b>{t.name}</b>
                  <span>
                    {t.att ? size(t.size) : Math.round(t.progress * 100) + '% uploading…'}
                  </span>
                </div>
                <button
                  className="rm"
                  type="button"
                  aria-label={'Remove ' + t.name}
                  onClick={() => {
                    setTray((x) => x.filter((y) => y.id !== t.id));
                  }}
                >
                  <Icon n="x" s={13} />
                </button>
                {!t.att && <span className="prog" style={{ width: t.progress * 100 + '%' }} />}
              </div>
            ))}
          </div>
        )}
        {codeHint && text.includes(codeHint) && (
          <div
            role="status"
            className="mb-1.5 flex flex-wrap items-center gap-2 rounded-md bg-accent-soft px-3 py-1.5 text-[12.5px] text-ink-2"
          >
            <Icon n="code" s={16} />
            <span className="mr-auto">That looks like code. Send it as a code block?</span>
            <button
              type="button"
              className="font-semibold text-accent hover:underline"
              onClick={() => {
                const l = guessLang(codeHint);
                setText(
                  text.replace(
                    codeHint,
                    () => '```' + l + '\n' + codeHint.replace(/\s+$/, '') + '\n```',
                  ),
                );
                setCodeHint(null);
              }}
            >
              Format as code
            </button>
            <button
              type="button"
              className="font-semibold text-accent hover:underline"
              onClick={() => {
                setText(text.replace(codeHint, ''));
                setCodeOpen({ code: codeHint, lang: guessLang(codeHint) });
                setCodeHint(null);
              }}
            >
              Open code editor
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              className="text-ink-3 hover:text-ink"
              onClick={() => setCodeHint(null)}
            >
              <Icon n="x" s={14} />
            </button>
          </div>
        )}
        {fmtBar && (
          <div className="fmtbar" role="toolbar" aria-label="Formatting">
            <IconBtn n="bold" s={17} label="Bold" className="sm" onClick={() => wrap('**')} />
            <IconBtn n="italic" s={17} label="Italic" className="sm" onClick={() => wrap('_')} />
            <IconBtn
              n="underline"
              s={17}
              label="Underline"
              className="sm"
              onClick={() => wrap('__')}
            />
            <IconBtn
              n="strikethrough"
              s={17}
              label="Strikethrough"
              className="sm"
              onClick={() => wrap('~~')}
            />
            <IconBtn
              n="highlight"
              s={17}
              label="Highlight"
              className="sm"
              onClick={() => wrap('==')}
            />
            <IconBtn
              n="lock"
              s={17}
              label="Spoiler (hidden until hover or tap)"
              className="sm"
              onClick={() => wrap('||')}
            />
            <IconBtn n="ban" s={17} label="Clear formatting" className="sm" onClick={clearFmt} />
            <span className="sp" />
            <IconBtn n="code" s={17} label="Inline code" className="sm" onClick={() => wrap('`')} />
            <IconBtn
              n="codeblock"
              s={17}
              label="Code block"
              className="sm"
              onClick={() => wrap('```\n', '\n```')}
            />
            <IconBtn
              n="h-1"
              s={17}
              label="Heading"
              className="sm"
              onClick={() => prefix((l) => (/^#{1,3} /.test(l) ? l.replace(/^#+ /, '') : '# ' + l))}
            />
            <IconBtn
              n="list"
              s={17}
              label="Bulleted list"
              className="sm"
              onClick={() => prefix((l) => '- ' + l)}
            />
            <IconBtn
              n="list-numbers"
              s={17}
              label="Numbered list"
              className="sm"
              onClick={() => {
                let n = 0;
                prefix((l) => ++n + '. ' + l);
              }}
            />
            <IconBtn
              n="quote"
              s={17}
              label="Quote"
              className="sm"
              onClick={() => prefix((l) => '> ' + l)}
            />
            <IconBtn
              n="link"
              s={17}
              label="Link"
              className="sm"
              onClick={() => wrap('[', '](https://)')}
            />
          </div>
        )}
        {rec ? (
          <div className="rec">
            <IconBtn n="trash" s={18} label="Cancel recording" onClick={() => stopRec(false)} />
            <span className="dot" />
            <span className="tm">{dur(rec.t)}</span>
            <div className="live" />
            <button
              className="sendbtn"
              type="button"
              aria-label="Send voice message"
              onClick={() => stopRec(true)}
            >
              <Icon n="send-2" s={19} />
            </button>
          </div>
        ) : (
          <div className="cbox">
            <IconBtn
              n="paperclip"
              s={20}
              label="Attach"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setMenu({ x: r.left, y: r.top - 190 });
              }}
            />
            <IconBtn
              n="mood-smile"
              s={20}
              label="Emoji"
              on={emoji}
              onClick={() => setEmoji(!emoji)}
            />
            <textarea
              ref={ta}
              rows={1}
              value={text}
              onChange={onInput}
              onKeyDown={onKey}
              placeholder={
                conv.type === 'saved'
                  ? 'Write a note to yourself'
                  : 'Message ' + (conv.type === 'dm' ? '' : conv.name || '')
              }
              aria-label="Message composer"
              onPaste={(e) => {
                const fs = [...(e.clipboardData?.files || [])];
                if (fs.length) {
                  e.preventDefault();
                  addFiles(fs);
                  return;
                }
                const pasted = e.clipboardData?.getData('text') || '';
                setCodeHint(looksLikeCode(pasted) ? pasted : null); // offer to format it (paste itself is unchanged)
              }}
            />
            <IconBtn
              n="code"
              s={20}
              label="Send code"
              onClick={() => setCodeOpen({ code: '', lang: '' })}
            />
            <IconBtn
              n="text-size"
              s={20}
              label="Formatting"
              on={fmtBar}
              onClick={() => setFmtBar(!fmtBar)}
            />
            {canSend || editing ? (
              <button
                className="sendbtn"
                type="button"
                aria-label={editing ? 'Save edit' : 'Send message'}
                onClick={submit}
              >
                <Icon n={editing ? 'check' : 'send-2'} s={19} />
              </button>
            ) : (
              <button
                className="sendbtn mic"
                type="button"
                aria-label="Record voice message"
                onClick={startRec}
              >
                <Icon n="microphone" s={20} />
              </button>
            )}
          </div>
        )}
        {emoji && <EmojiPicker onPick={(e) => insert(e)} />}
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {menu && (
          <Menu
            x={menu.x}
            y={Math.max(8, menu.y)}
            onClose={() => setMenu(null)}
            items={[
              {
                label: 'Photo, video or file',
                icon: 'paperclip',
                onClick: () => fileRef.current.click(),
              },
              {
                label: 'Poll',
                icon: 'chart-bar',
                onClick: () => setPoll({ q: '', multi: false, options: ['', ''] }),
              },
              {
                label: 'Send code…',
                icon: 'code',
                onClick: () => setCodeOpen({ code: '', lang: '' }),
              },
            ]}
          />
        )}
        {codeOpen && (
          <CodeDialog
            initialCode={codeOpen.code}
            initialLang={codeOpen.lang}
            onClose={() => setCodeOpen(null)}
            onSend={(body) => {
              act.send(conv.id, { text: body, replyTo: reply?.id });
              setCodeOpen(null);
              onCancel();
            }}
          />
        )}
        {poll && <PollDialog poll={poll} setPoll={setPoll} onCreate={createPoll} />}
      </div>
    </div>
  );
}
import { Button, Field, Input, Modal, Switch } from './ui.jsx';
function PollDialog({ poll, setPoll, onCreate }) {
  return (
    <Modal
      title="Create poll"
      onClose={() => setPoll(null)}
      foot={[
        <Button key="c" onClick={() => setPoll(null)}>
          Cancel
        </Button>,
        <Button key="k" variant="primary" onClick={onCreate}>
          Create poll
        </Button>,
      ]}
    >
      <Field label="Question">
        <Input autoFocus value={poll.q} onChange={(e) => setPoll({ ...poll, q: e.target.value })} />
      </Field>
      <Field label="Options">
        {poll.options.map((o, i) => (
          <Input
            key={i}
            className="mb-1.5"
            placeholder={'Option ' + (i + 1)}
            value={o}
            onChange={(e) =>
              setPoll({
                ...poll,
                options: poll.options.map((x, j) => (j === i ? e.target.value : x)),
              })
            }
          />
        ))}
        {poll.options.length < 8 && (
          <Button
            variant="ghost"
            className="self-start"
            onClick={() => setPoll({ ...poll, options: [...poll.options, ''] })}
          >
            <Icon n="plus" s={15} /> Add option
          </Button>
        )}
      </Field>
      <div className="flex items-center justify-between py-2">
        <b className="font-medium">Allow multiple answers</b>
        <Switch
          label="Allow multiple answers"
          checked={poll.multi}
          onChange={(e) => setPoll({ ...poll, multi: e.target.checked })}
        />
      </div>
    </Modal>
  );
}
