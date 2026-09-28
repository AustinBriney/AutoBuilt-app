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
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsDataURL(file);
      });
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
          <EditableField label="Customer booking link" optional value={form.booking_url} onSave={(v) => saveField({ booking_url: v })} last />
        </div>
      </div>

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
      </div>
    </div>
  );
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
