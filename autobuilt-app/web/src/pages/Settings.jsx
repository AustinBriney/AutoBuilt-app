import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { useToast } from '../lib/toast.jsx';
import { useTheme } from '../lib/theme.jsx';
import { useAuth } from '../lib/auth.jsx';
import Avatar from '../components/Avatar.jsx';
import { SkeletonList } from '../components/Skeleton.jsx';
import { ErrorState } from '../components/EmptyState.jsx';
import { SunIcon, MoonIcon } from '../components/icons.jsx';
import './Settings.css';

export default function Settings() {
  const { status, data, error, refetch } = useAsync(() => api.getBusiness(), []);
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function saveField(patch) {
    setSaving(true);
    try {
      const updated = await api.updateBusiness(patch);
      setForm(updated);
      toast('Saved.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file) {
    try {
      const dataUrl = await shrinkImageToDataUrl(file);
      const updated = await api.uploadLogo(dataUrl);
      setForm(updated);
      toast('Logo updated.');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (status === 'loading' || !form) return <div className="screen container"><SkeletonList count={4} /></div>;
  if (status === 'error') return <div className="screen container"><ErrorState message={error} onRetry={refetch} /></div>;

  return (
    <div className="screen container">
      <div className="eyebrow">Your business</div>
      <h1 className="page-title">Settings</h1>

      <div className="card owner-badge" style={{ marginTop: 20 }}>
        <Avatar name={form.name} size={48} />
        <div>
          <div className="biz-name">{form.name}</div>
          <div className="biz-sub">{form.owner_name}</div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Appearance</h2>
        <div className="card theme-row">
          {[
            { key: 'light', label: 'Light', icon: SunIcon },
            { key: 'dark', label: 'Dark', icon: MoonIcon },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} className={`theme-btn${theme === key ? ' active' : ''}`} onClick={() => setTheme(key)}>
              <Icon width={16} height={16} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h2>Business profile</h2>
        <div className="card" style={{ padding: 16 }}>
          <EditableField label="Business name" value={form.name} onSave={(v) => saveField({ name: v })} />
          <EditableField label="Owner name" value={form.owner_name} onSave={(v) => saveField({ owner_name: v })} />
          <EditableField
            label="Phone"
            optional
            hint="Your business texting number. Leave blank until it's set up — nothing here depends on it."
            value={form.phone}
            onSave={(v) => saveField({ phone: v })}
          />
          <EditableField label="Customer booking link" optional hint="Set up for you. Customers book here from your website." value={form.booking_url} onSave={(v) => saveField({ booking_url: v })} last />
          {form.booking_url && (
            <a href={form.booking_url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>
              Open my booking page
            </a>
          )}
        </div>
      </div>

      <HoursSection form={form} saveField={saveField} saving={saving} />

      <div className="settings-section">
        <h2>Logo</h2>
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          {form.logo_url ? (
            <img
              src={form.logo_url}
              alt="Business logo"
              style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--line-strong)' }}
            />
          ) : (
            <div
              style={{
                width: 56, height: 56, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--line-strong)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center',
              }}
            >
              No logo
            </div>
          )}
          <div>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              {form.logo_url ? 'Change logo' : 'Upload logo'}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Your plan</h2>
        <div className="card">
          <div className="integration-row">
            <div>
              <div className="name">{form.plan ? form.plan : 'No plan assigned yet'}</div>
              <div className="desc">Everything runs automatically in the background — bookings, texts, and follow-ups.</div>
            </div>
          </div>
        </div>
      </div>

      {/* No Cal.com section and no test tools here on purpose. Both are
          setup plumbing that AutoBuilt wires up on the client's behalf —
          a shop owner should never see a webhook URL or a "simulate a
          booking" button in their own app. Both live in the admin
          dashboard (/#/admin) instead, where they're actually used. */}

      <div className="settings-section">
        <button className="btn btn-secondary btn-block" onClick={logout}>Sign out</button>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-faint)', marginTop: 14 }}>
          Build {typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}
        </div>
      </div>
    </div>
  );
}

// --- Hours & booking --------------------------------------------------
//
// This is what fills the calendar on the client's own website. Nothing on
// that site is typed in by hand: the days below decide which dates a
// customer can pick, and the three settings under them decide which times
// show up inside those days.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first — how an owner reads a week

const SLOT_OPTIONS = [
  { value: 15, label: 'Every 15 minutes' },
  { value: 20, label: 'Every 20 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 45, label: 'Every 45 minutes' },
  { value: 60, label: 'Every hour' },
];

const NOTICE_OPTIONS = [
  { value: 0, label: 'Any time, even right now' },
  { value: 30, label: 'At least 30 minutes ahead' },
  { value: 60, label: 'At least 1 hour ahead' },
  { value: 120, label: 'At least 2 hours ahead' },
  { value: 720, label: 'At least 12 hours ahead' },
  { value: 1440, label: 'At least a day ahead' },
];

const WINDOW_OPTIONS = [
  { value: 7, label: 'Up to 1 week out' },
  { value: 14, label: 'Up to 2 weeks out' },
  { value: 30, label: 'Up to 30 days out' },
  { value: 60, label: 'Up to 60 days out' },
  { value: 90, label: 'Up to 90 days out' },
];

function HoursSection({ form, saveField, saving }) {
  const [rules, setRules] = useState(null);
  const [busyDay, setBusyDay] = useState(null);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    api.getAvailability()
      .then((d) => { if (alive) setRules(d.rules || []); })
      .catch(() => { if (alive) setRules([]); });
    return () => { alive = false; };
  }, []);

  function ruleFor(weekday) {
    return (rules || []).find((r) => r.weekday === weekday) || null;
  }

  // The editor shows one window per day, so saving a day clears any extra
  // windows on it. Otherwise the website could offer times the owner can't
  // see here, which is exactly the kind of mismatch that loses a customer.
  async function replaceDay(weekday, startTime, endTime) {
    setBusyDay(weekday);
    try {
      const existing = (rules || []).filter((r) => r.weekday === weekday);
      for (const extra of existing.slice(1)) await api.deleteAvailabilityRule(extra.id);

      let next;
      if (existing[0]) {
        next = await api.updateAvailabilityRule(existing[0].id, { startTime, endTime });
      } else {
        next = await api.addAvailabilityRule({ weekday, startTime, endTime });
      }
      setRules((prev) => [...(prev || []).filter((r) => r.weekday !== weekday), next]);
      toast('Hours saved.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyDay(null);
    }
  }

  async function closeDay(weekday) {
    setBusyDay(weekday);
    try {
      for (const rule of (rules || []).filter((r) => r.weekday === weekday)) {
        await api.deleteAvailabilityRule(rule.id);
      }
      setRules((prev) => (prev || []).filter((r) => r.weekday !== weekday));
      toast('Marked closed.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyDay(null);
    }
  }

  return (
    <div className="settings-section">
      <h2>Hours &amp; booking</h2>

      <div className="card" style={{ padding: 16 }}>
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: '0 0 14px', lineHeight: 1.5 }}>
          These are the times customers can pick on your website. Change them here and your
          site updates itself — nothing to email anyone about.
        </p>

        {rules === null ? (
          <SkeletonList count={3} />
        ) : (
          WEEK_ORDER.map((weekday) => {
            const rule = ruleFor(weekday);
            const isBusy = busyDay === weekday;
            return (
              <div
                key={weekday}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  padding: '10px 0', borderBottom: '1px solid var(--line)', opacity: isBusy ? 0.5 : 1,
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 88, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!rule}
                    disabled={isBusy}
                    onChange={(e) => (e.target.checked ? replaceDay(weekday, '09:00', '17:00') : closeDay(weekday))}
                    style={{ width: 17, height: 17, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{DAY_NAMES[weekday]}</span>
                </label>

                {rule ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
                    <input
                      className="input"
                      type="time"
                      defaultValue={rule.start_time}
                      disabled={isBusy}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== rule.start_time) {
                          replaceDay(weekday, e.target.value, rule.end_time);
                        }
                      }}
                      style={{ padding: '7px 4px', fontSize: 13, flex: '1 1 0', minWidth: 0 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>&ndash;</span>
                    <input
                      className="input"
                      type="time"
                      defaultValue={rule.end_time}
                      disabled={isBusy}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== rule.end_time) {
                          replaceDay(weekday, rule.start_time, e.target.value);
                        }
                      }}
                      style={{ padding: '7px 4px', fontSize: 13, flex: '1 1 0', minWidth: 0 }}
                    />
                  </div>
                ) : (
                  <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Closed</span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <SettingSelect
          label="Appointment times"
          hint="How far apart the start times are. Every 30 minutes gives 9:00, 9:30, 10:00, and so on."
          value={form.slot_minutes ?? 30}
          options={SLOT_OPTIONS}
          disabled={saving}
          onChange={(v) => saveField({ slot_minutes: v })}
        />
        <SettingSelect
          label="Shortest notice"
          hint="How close to the appointment someone can still book it. Stops a walk-in booking the slot you're already in."
          value={form.min_notice_min ?? 60}
          options={NOTICE_OPTIONS}
          disabled={saving}
          onChange={(v) => saveField({ min_notice_min: v })}
        />
        <SettingSelect
          label="How far ahead"
          hint="How much of the calendar customers can see."
          value={form.booking_window_days ?? 30}
          options={WINDOW_OPTIONS}
          disabled={saving}
          onChange={(v) => saveField({ booking_window_days: v })}
          last
        />
      </div>
    </div>
  );
}

function SettingSelect({ label, hint, value, options, onChange, disabled, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 16 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <select
        className="input"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

// Logos are shown at 56px in Settings and 44px in the admin dashboard, so
// there is no reason to ship the original file. A photo straight off a
// phone is several megabytes, and base64 adds about a third on top of that
// — which used to blow past the API's request-size limit and fail with a
// useless "Something went wrong". Re-drawing it at a sane size first keeps
// the upload small and fast no matter what the owner picks, and means the
// persistent disk fills with kilobytes instead of megabytes per client.
const LOGO_MAX_EDGE = 512;

async function shrinkImageToDataUrl(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');

  const originalUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That image couldn't be read. Try a PNG or JPEG."));
      el.src = originalUrl;
    });

    const scale = Math.min(1, LOGO_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    // PNG keeps transparency, which most logos rely on. If that comes out
    // heavy (photos re-encoded as PNG do), fall back to JPEG on a white
    // background so the upload stays small.
    const png = canvas.toDataURL('image/png');
    if (png.length <= 400_000) return png;

    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(originalUrl);
  }
}

function EditableField({ label, value, onSave, last, optional, hint }) {
  const [val, setVal] = useState(value || '');
  const [editing, setEditing] = useState(false);

  return (
    <div style={{ marginBottom: last ? 0 : 16 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>
        {label}
        {optional && <span style={{ fontWeight: 500, color: 'var(--ink-faint)' }}> (optional)</span>}
      </label>
      <input
        className="input"
        value={val}
        onChange={(e) => { setVal(e.target.value); setEditing(true); }}
        onBlur={() => { if (editing) { onSave(val); setEditing(false); } }}
      />
      {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}
