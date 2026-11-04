import { Icon, Input, cx } from './ui.jsx';

export const PRIVACY = {
  public: {
    icon: 'world',
    title: 'Public',
    badge: 'Public',
    desc: 'Anyone can find it in Discover and join instantly.',
  },
  approval: {
    icon: 'user-check',
    title: 'Public — approval needed',
    badge: 'Approval needed',
    desc: 'Anyone can find it, but admins approve each join request.',
  },
  private: {
    icon: 'lock',
    title: 'Private',
    badge: 'Private',
    desc: 'Hidden from Discover. People join only with an invite link or when an admin adds them.',
  },
};

/** radio cards for the three privacy modes + optional public @handle */
export function PrivacyPicker({ value, onChange, handle, onHandle, name = '', error }) {
  const needsHandle = value !== 'private';
  return (
    <fieldset className="mb-3 border-0 p-0">
      <legend className="mb-1.5 text-xs font-semibold text-ink-2">Who can join?</legend>
      <div className="grid gap-2" role="radiogroup" aria-label="Privacy">
        {Object.entries(PRIVACY).map(([k, p]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            onClick={() => onChange(k)}
            className={cx(
              'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition',
              value === k ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover',
            )}
          >
            <span
              className={cx(
                'mt-0.5 grid size-8 shrink-0 place-items-center rounded-md',
                value === k ? 'bg-accent text-white' : 'bg-field text-ink-2',
              )}
            >
              <Icon n={p.icon} s={17} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block font-semibold">{p.title}</b>
              <span className="text-xs leading-snug text-ink-3">{p.desc}</span>
            </span>
            <span
              className={cx(
                'mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2',
                value === k ? 'border-accent bg-accent' : 'border-line-strong',
              )}
            >
              {value === k && <span className="size-1.5 rounded-full bg-white" />}
            </span>
          </button>
        ))}
      </div>
      {needsHandle && (
        <div className="mt-3">
          <label htmlFor="ph-handle" className="mb-1.5 block text-xs font-semibold text-ink-2">
            Public handle <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-2 text-ink-3">@</span>
            <Input
              id="ph-handle"
              className="pl-6"
              placeholder={
                name
                  ? name
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '_')
                      .replace(/^_|_$/g, '')
                      .slice(0, 24) || 'your_handle'
                  : 'your_handle'
              }
              value={handle}
              maxLength={32}
              onChange={(e) =>
                onHandle(
                  e.target.value
                    .toLowerCase()
                    .replace(/^@/, '')
                    .replace(/[^a-z0-9_]/g, ''),
                )
              }
            />
          </div>
          <span className={cx('mt-1 block text-xs', error ? 'text-danger' : 'text-ink-3')}>
            {error || '4–32 letters, numbers or _. Leave empty to generate one from the name.'}
          </span>
        </div>
      )}
      {!needsHandle && (
        <p className="mt-3 rounded-md bg-field px-3 py-2 text-xs leading-snug text-ink-2">
          <Icon n="link" s={14} /> An invite link is created for you. Share it from the details
          panel — only admins can see and reset it.
        </p>
      )}
    </fieldset>
  );
}
