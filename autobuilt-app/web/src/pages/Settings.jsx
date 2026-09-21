import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { useToast } from '../lib/toast.jsx';
import { useTheme } from '../lib/theme.jsx';
import Avatar from '../components/Avatar.jsx';
import { SkeletonList } from '../components/Skeleton.jsx';
import { ErrorState } from '../components/EmptyState.jsx';
import { SunIcon, MoonIcon } from '../components/icons.jsx';
import './Settings.css';

const AUTOMATIONS = [
  { key: 'automations_missed_call', name: 'Missed-call text-back', desc: 'Text a caller automatically if you miss their call.' },
  { key: 'automations_reminder', name: 'Appointment reminders', desc: 'Remind customers before their appointment; they can confirm or reschedule by text.' },
  { key: 'automations_review', name: 'Review requests', desc: 'Ask happy customers for a review after their visit.' },
  { key: 'automations_winback', name: 'Win-back messages', desc: "Reach out to customers who haven't been back in a while." },
];

export default function Settings() {
  const { status, data, error, refetch } = useAsync(() => api.getBusiness(), []);
  const integrations = useAsync(() => api.getIntegrations(), []);
  const toast = useToast();
  const { theme, setTheme } = useTheme();
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
          <EditableField label="Phone" value={form.phone} onSave={(v) => saveField({ phone: v })} />
          <EditableField label="Booking link" value={form.booking_url} onSave={(v) => saveField({ booking_url: v })} last />
        </div>
      </div>

      <div className="settings-section">
        <h2>Automations</h2>
        <div className="card">
          {AUTOMATIONS.map((a, i) => (
            <div key={a.key}>
              <div className="toggle-row">
                <div>
                  <div className="name">{a.name}</div>
                  <div className="desc">{a.desc}</div>
                </div>
                <button
                  className={`switch${form[a.key] ? ' on' : ''}`}
                  disabled={saving}
                  onClick={() => saveField({ [a.key]: form[a.key] ? 0 : 1 })}
                  aria-label={a.name}
                />
              </div>
              {i < AUTOMATIONS.length - 1 && <hr className="divider" />}
            </div>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h2>Connected services</h2>
        <div className="card">
          {integrations.status === 'success' && (
            <>
              <IntegrationRow name="Booking (Cal.com)" desc={integrations.data.calcom.note} connected={integrations.data.calcom.connected} />
              <hr className="divider" />
              <IntegrationRow name="Texting (Twilio)" desc={integrations.data.twilio.note} connected={integrations.data.twilio.connected} />
              <hr className="divider" />
              <IntegrationRow name={`Plan: ${integrations.data.stripe.plan}`} desc={`Billing status: ${integrations.data.stripe.status}`} connected={integrations.data.stripe.status === 'active'} />
            </>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 10, padding: '0 4px' }}>
          These run behind the scenes — you never need to log into them separately.
        </p>
      </div>

      <TestTools toast={toast} />
    </div>
  );
}

function EditableField({ label, value, onSave, last }) {
  const [val, setVal] = useState(value || '');
  const [editing, setEditing] = useState(false);

  return (
    <div style={{ marginBottom: last ? 0 : 16 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>{label}</label>
      <input
        className="input"
        value={val}
        onChange={(e) => { setVal(e.target.value); setEditing(true); }}
        onBlur={() => { if (editing) { onSave(val); setEditing(false); } }}
      />
    </div>
  );
}

function IntegrationRow({ name, desc, connected }) {
  return (
    <div className="integration-row">
      <div>
        <div className="name">{name}</div>
        <div className="desc">{desc}</div>
      </div>
      <span className={`badge ${connected ? 'badge-success' : 'badge-neutral'}`}>{connected ? 'Live' : 'Mock'}</span>
    </div>
  );
}

// A small panel that lets the owner (or us, testing) simulate the outside
// world: a customer booking on the website, texting in, or calling and
// hanging up. This is what stands in for real Cal.com/Twilio webhooks
// until those are wired up, and it's exactly the tool needed to run the
// 17-step mock-client test end to end.
function TestTools({ toast }) {
  const [phone, setPhone] = useState('+12255550199');
  const [name, setName] = useState('Austin Test');
  const [busy, setBusy] = useState('');

  async function run(kind, fn) {
    setBusy(kind);
    try {
      await fn();
      toast(`Simulated: ${kind}`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="settings-section">
      <h2>Test tools</h2>
      <div className="card" style={{ padding: 16 }}>
        <div className="field">
          <label>Test phone number</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>Test name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 4 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() =>
              run('website booking', () =>
                api.simulateBooking({ customerName: name, phone, startAt: new Date(Date.now() + 30 * 60000).toISOString(), durationMin: 30 })
              )
            }
          >
            {busy === 'website booking' ? 'Booking…' : 'Simulate a website booking'}
          </button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => run('missed call', () => api.simulateMissedCall({ phone, name }))}>
            {busy === 'missed call' ? 'Sending…' : 'Simulate a missed call'}
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => run('inbound text', () => api.simulateInboundSms({ phone, name, body: 'Hey, is this the right number to book?' }))}
          >
            {busy === 'inbound text' ? 'Sending…' : 'Simulate an inbound text'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 12 }}>
          These stand in for Cal.com and Twilio until they're connected — use them to test the whole flow now.
        </p>
      </div>
    </div>
  );
}
