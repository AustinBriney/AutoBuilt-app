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
        <h2>Your plan</h2>
        <div className="card">
          {integrations.status === 'success' ? (
            <div className="integration-row">
              <div>
                <div className="name">{integrations.data.stripe.plan}</div>
                <div className="desc">Everything runs automatically in the background — bookings, texts, and follow-ups.</div>
              </div>
              <span className={`badge ${integrations.data.stripe.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                {integrations.data.stripe.status === 'active' ? 'Active' : integrations.data.stripe.status}
              </span>
            </div>
          ) : (
            <div className="integration-row"><div className="desc">Loading…</div></div>
          )}
        </div>
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
