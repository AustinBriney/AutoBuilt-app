import { useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import './Onboarding.css';

// First-run setup. Shows only when a business hasn't been onboarded yet
// (onboarded = 0). Collects the essentials, then drops the owner straight
// into a ready-to-use app. Everything here can be changed later in Settings.
export default function Onboarding({ onDone }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', owner_name: '', phone: '', booking_url: '' });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function finish() {
    if (!form.name.trim()) return toast('Add your business name first.', 'error');
    setSaving(true);
    try {
      await api.updateBusiness({
        name: form.name.trim(),
        owner_name: form.owner_name.trim(),
        phone: form.phone.trim(),
        booking_url: form.booking_url.trim(),
        onboarded: 1,
      });
      onDone?.();
    } catch (e) {
      toast(e.message, 'error');
      setSaving(false);
    }
  }

  return (
    <div className="onboard">
      <div className="onboard-inner">
        {step === 0 ? (
          <div className="onboard-welcome">
            <div className="eyebrow">AutoBuilt</div>
            <h1 className="onboard-title">Welcome.</h1>
            <p className="onboard-sub">
              Let's get your business set up. It takes about a minute, and you can change
              anything later.
            </p>
            <button className="btn btn-primary btn-block" onClick={() => setStep(1)}>Get started</button>
          </div>
        ) : (
          <div className="onboard-form">
            <div className="eyebrow">Your business</div>
            <h1 className="onboard-title">The basics</h1>
            <div className="field">
              <label>Business name</label>
              <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Riverside Nail Bar" autoFocus />
            </div>
            <div className="field">
              <label>Your name</label>
              <input className="input" value={form.owner_name} onChange={set('owner_name')} placeholder="e.g. Jordan Reed" />
            </div>
            <div className="field">
              <label>Business phone</label>
              <input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="(225) 555-0142" />
            </div>
            <div className="field">
              <label>Booking link <span className="opt">(optional)</span></label>
              <input className="input" value={form.booking_url} onChange={set('booking_url')} placeholder="Where customers book — you can add this later" />
            </div>
            <button className="btn btn-primary btn-block" disabled={saving} onClick={finish}>
              {saving ? 'Setting up…' : 'Finish setup'}
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setStep(0)} style={{ marginTop: 4 }}>Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
