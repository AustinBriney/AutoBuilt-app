import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../lib/toast.jsx';
import './Admin.css';

// Austin's own internal ops tool — no client-facing plan picker exists
// anywhere in the app on purpose; this is the ONLY place a plan gets set.
// Auth here is a simple shared secret sent as `x-admin-secret`, entirely
// separate from the client login/JWT flow (there is no admin-user login
// system in this codebase, by design).
const SECRET_KEY = 'autobuilt_admin_secret';
const API_BASE = '/api/admin';

async function adminRequest(path, secret, options = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-admin-secret': secret, ...(options.headers || {}) };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    const err = new Error('Invalid admin secret.');
    err.unauthorized = true;
    throw err;
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
}

export default function Admin() {
  const [secret, setSecret] = useState(() => {
    try {
      return localStorage.getItem(SECRET_KEY) || '';
    } catch {
      return '';
    }
  });

  if (!secret) return <AdminGate onSubmit={setSecret} />;
  return <AdminDashboard secret={secret} onUnauthorized={() => setSecret('')} />;
}

function AdminGate({ onSubmit }) {
  const [value, setValue] = useState('');
  return (
    <div className="admin-screen admin-gate">
      <div className="card admin-gate-card">
        <h1 className="page-title">Admin</h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13.5 }}>Enter the admin secret to continue.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!value.trim()) return;
            try {
              localStorage.setItem(SECRET_KEY, value.trim());
            } catch {
              // best-effort only
            }
            onSubmit(value.trim());
          }}
        >
          <input
            className="input"
            type="password"
            placeholder="Admin secret"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminDashboard({ secret, onUnauthorized }) {
  const toast = useToast();
  const [status, setStatus] = useState('loading');
  const [businesses, setBusinesses] = useState([]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await adminRequest('/businesses', secret);
      setBusinesses(data);
      setStatus('success');
    } catch (e) {
      if (e.unauthorized) {
        try {
          localStorage.removeItem(SECRET_KEY);
        } catch {
          // best-effort only
        }
        onUnauthorized();
        return;
      }
      setStatus('error');
      toast(e.message, 'error');
    }
  }, [secret, onUnauthorized, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function savePlan(id, plan) {
    try {
      const updated = await adminRequest(`/businesses/${id}`, secret, {
        method: 'PATCH',
        body: JSON.stringify({ plan }),
      });
      setBusinesses((list) => list.map((b) => (b.id === id ? { ...b, ...updated } : b)));
      toast('Plan saved.');
    } catch (e) {
      if (e.unauthorized) {
        try {
          localStorage.removeItem(SECRET_KEY);
        } catch {
          // best-effort only
        }
        onUnauthorized();
        return;
      }
      toast(e.message, 'error');
    }
  }

  return (
    <div className="admin-screen container">
      <div className="eyebrow">AutoBuilt</div>
      <h1 className="page-title">Admin dashboard</h1>

      {status === 'loading' && <p style={{ color: 'var(--ink-soft)' }}>Loading…</p>}
      {status === 'error' && (
        <div className="card" style={{ padding: 16 }}>
          <p>Couldn't load businesses.</p>
          <button className="btn btn-secondary" onClick={load}>Retry</button>
        </div>
      )}

      {status === 'success' &&
        businesses.map((b) => <BusinessCard key={b.id} business={b} onSavePlan={(plan) => savePlan(b.id, plan)} />)}

      {status === 'success' && businesses.length === 0 && <p style={{ color: 'var(--ink-soft)' }}>No businesses yet.</p>}
    </div>
  );
}

function BusinessCard({ business, onSavePlan }) {
  const [plan, setPlan] = useState(business.plan || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');

  async function save() {
    setSaving(true);
    try {
      await onSavePlan(plan.trim() || null);
    } finally {
      setSaving(false);
    }
  }

  async function copy(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 1200);
    } catch {
      // Clipboard API can be unavailable; nothing else to do here.
    }
  }

  return (
    <div className="card admin-business-card">
      <div className="admin-business-head">
        {business.logo_url ? (
          <img src={business.logo_url} alt="" className="admin-logo-thumb" />
        ) : (
          <div className="admin-logo-thumb admin-logo-placeholder">{(business.name || '?').slice(0, 1)}</div>
        )}
        <div>
          <div className="biz-name">{business.name}</div>
          <div className="biz-sub">{business.owner_name}</div>
        </div>
      </div>

      <div className="admin-field-row">
        <label>Plan</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="e.g. Starter, Pro, Growth" />
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="admin-field-row">
        <label>Cal.com webhook</label>
        <div className="admin-mono-row">
          <span className="admin-mono">{business.calcomWebhookUrl}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy('url', business.calcomWebhookUrl)}>
            {copied === 'url' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="admin-mono-row">
          <span className="admin-mono">{business.calcom_webhook_secret || '(none set)'}</span>
          {business.calcom_webhook_secret && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy('secret', business.calcom_webhook_secret)}>
              {copied === 'secret' ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      {business.booking_url && (
        <div className="admin-field-row">
          <a href={business.booking_url} target="_blank" rel="noreferrer" className="admin-website-link">
            Website
          </a>
        </div>
      )}
    </div>
  );
}
