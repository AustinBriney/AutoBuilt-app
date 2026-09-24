import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { useToast } from '../lib/toast.jsx';
import { formatDayHeading, formatTime, formatMoney, formatDuration, formatClock } from '../lib/format.js';
import { SkeletonList } from '../components/Skeleton.jsx';
import EmptyState, { ErrorState } from '../components/EmptyState.jsx';
import Sheet from '../components/Sheet.jsx';
import { PlusIcon, CalendarIcon, ScissorsIcon } from '../components/icons.jsx';
import './Schedule.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TABS = ['Upcoming', 'Services', 'Hours'];

export default function Schedule() {
  const [tab, setTab] = useState('Upcoming');
  const [sheet, setSheet] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="screen container">
      <div className="eyebrow">Schedule</div>
      <h1 className="page-title">Schedule</h1>

      <div className="segmented">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Upcoming' && <UpcomingTab key={`u${refreshKey}`} />}
      {tab === 'Services' && <ServicesTab key={`s${refreshKey}`} />}
      {tab === 'Hours' && <HoursTab key={`h${refreshKey}`} />}

      {tab === 'Upcoming' && (
        <button className="fab" onClick={() => setSheet('appointment')} aria-label="Add appointment">
          <PlusIcon width={24} height={24} />
        </button>
      )}
      {tab === 'Services' && (
        <button className="fab" onClick={() => setSheet('service')} aria-label="Add service">
          <PlusIcon width={24} height={24} />
        </button>
      )}
      {tab === 'Hours' && (
        <button className="fab" onClick={() => setSheet('hours')} aria-label="Add hours">
          <PlusIcon width={24} height={24} />
        </button>
      )}

      <AddAppointmentSheet open={sheet === 'appointment'} onClose={() => setSheet(null)} onSaved={bump} />
      <AddServiceSheet open={sheet === 'service'} onClose={() => setSheet(null)} onSaved={bump} />
      <AddAvailabilitySheet open={sheet === 'hours'} onClose={() => setSheet(null)} onSaved={bump} />
    </div>
  );
}

function UpcomingTab() {
  const { status, data, error, refetch } = useAsync(() => api.getAppointments(), []);
  const toast = useToast();
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    if (!data) return [];
    const upcoming = data.filter((a) => a.status !== 'cancelled').sort((a, b) => a.start_at.localeCompare(b.start_at));
    const byDay = {};
    for (const appt of upcoming) {
      const key = dayjs(appt.start_at).format('YYYY-MM-DD');
      (byDay[key] ||= []).push(appt);
    }
    return Object.entries(byDay).map(([key, appts]) => ({ key, appts }));
  }, [data]);

  async function act(fn, msg) {
    setBusy(true);
    try {
      await fn();
      toast(msg);
      setOpenId(null);
      refetch();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading') return <SkeletonList count={4} />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetch} />;
  if (groups.length === 0) {
    return <EmptyState icon={CalendarIcon} title="No appointments yet" description="Add one manually, or wait for the first booking to come in from your site." />;
  }

  return (
    <div>
      {groups.map(({ key, appts }) => (
        <div className="day-group" key={key}>
          <div className="day-group-label">{formatDayHeading(key)}</div>
          {appts.map((a) => (
            <div className="card appt-row-wrap" key={a.id}>
              <button className="appt-row" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
                <div className="appt-time">{formatTime(a.start_at)}</div>
                <div className="appt-info">
                  <div className="name">{a.customer_name}</div>
                  <div className="service">{a.service_name || 'Appointment'}</div>
                </div>
                <StatusBadge status={a.status} />
              </button>
              {openId === a.id && (
                <div className="row-actions appt-actions">
                  {a.status !== 'completed' && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => api.updateAppointment(a.id, { status: 'completed' }), 'Marked completed.')}>Mark completed</button>
                  )}
                  {a.status !== 'cancelled' && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => api.updateAppointment(a.id, { status: 'cancelled' }), 'Appointment cancelled.')}>Cancel</button>
                  )}
                  <button className="btn btn-ghost btn-sm danger-text" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => act(() => api.deleteAppointment(a.id), 'Appointment deleted.')}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    booked: ['badge-neutral', 'Booked'],
    confirmed: ['badge-accent', 'Confirmed'],
    completed: ['badge-success', 'Completed'],
    cancelled: ['badge-danger', 'Cancelled'],
    no_show: ['badge-danger', 'No-show'],
  };
  const [cls, label] = map[status] || map.booked;
  return <span className={`badge ${cls}`}>{label}</span>;
}

function ServicesTab() {
  const { status, data, error, refetch } = useAsync(() => api.getServices(), []);
  const toast = useToast();
  const [confirmId, setConfirmId] = useState(null);

  async function toggleActive(svc) {
    try {
      await api.updateService(svc.id, { active: svc.active ? 0 : 1 });
      refetch();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function removeService(id) {
    try {
      await api.deleteService(id);
      setConfirmId(null);
      toast('Service deleted.');
      refetch();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (status === 'loading') return <SkeletonList count={3} />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetch} />;
  if (data.length === 0) return <EmptyState icon={ScissorsIcon} title="No services yet" description="Add what you offer — name, price, and how long it takes." />;

  return (
    <div>
      {data.map((s) => (
        <div className="card svc-row" key={s.id}>
          <div className="svc-info">
            <div className="name">{s.name}</div>
            <div className="meta">{formatDuration(s.duration_min)} · {formatMoney(s.price_cents)}{s.active ? '' : ' · hidden'}</div>
          </div>
          {confirmId === s.id ? (
            <div className="row-actions">
              <button className="btn btn-danger btn-sm" onClick={() => removeService(s.id)}>Delete</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmId(null)}>Cancel</button>
            </div>
          ) : (
            <div className="row-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(s)}>{s.active ? 'Hide' : 'Show'}</button>
              <button className="btn btn-ghost btn-sm danger-text" onClick={() => setConfirmId(s.id)}>Delete</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function HoursTab() {
  const { status, data, error, refetch } = useAsync(() => api.getAvailability(), []);
  const toast = useToast();
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({ start: '', end: '' });
  const [saving, setSaving] = useState(false);

  function startEdit(r) {
    setEditId(r.id);
    setDraft({ start: r.start_time, end: r.end_time });
  }

  async function saveEdit(id) {
    setSaving(true);
    try {
      await api.updateAvailabilityRule(id, { startTime: draft.start, endTime: draft.end });
      setEditId(null);
      toast('Hours updated.');
      refetch();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(id) {
    try {
      await api.deleteAvailabilityRule(id);
      refetch();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (status === 'loading') return <SkeletonList count={3} />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <div className="day-group-label">Weekly hours</div>
      {data.rules.length === 0 && <EmptyState title="No hours set" description="Add the days and times you're open for bookings." />}
      {data.rules.map((r) => (
        <div className="card avail-row" key={r.id}>
          {editId === r.id ? (
            <div style={{ width: '100%' }}>
              <div className="name" style={{ marginBottom: 10 }}>{WEEKDAYS[r.weekday]}</div>
              <div className="time-row">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Opens</label>
                  <input className="input" type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Closes</label>
                  <input className="input" type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
                </div>
              </div>
              <div className="row-actions" style={{ marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => saveEdit(r.id)}>{saving ? 'Saving…' : 'Save'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                <button className="btn btn-ghost btn-sm danger-text" style={{ marginLeft: 'auto' }} onClick={() => removeRule(r.id)}>Remove</button>
              </div>
            </div>
          ) : (
            <>
              <div className="svc-info">
                <div className="name">{WEEKDAYS[r.weekday]}</div>
                <div className="meta">{formatClock(r.start_time)} – {formatClock(r.end_time)}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(r)}>Edit</button>
            </>
          )}
        </div>
      ))}

      {data.timeOff.length > 0 && (
        <>
          <div className="day-group-label" style={{ marginTop: 24 }}>Upcoming time off</div>
          {data.timeOff.map((t) => (
            <div className="card avail-row" key={t.id}>
              <div className="svc-info">
                <div className="name">{dayjs(t.start_at).format('MMM D')} – {dayjs(t.end_at).format('MMM D')}</div>
                <div className="meta">{t.reason || 'Closed'}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function AddAppointmentSheet({ open, onClose, onSaved }) {
  const toast = useToast();
  const services = useAsync(() => api.getServices(), [open]);
  const [form, setForm] = useState({ customerName: '', phone: '', serviceId: '', date: dayjs().format('YYYY-MM-DD'), time: '10:00' });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.customerName || !form.phone) return toast('Name and phone are required.', 'error');
    setSaving(true);
    try {
      const startAt = dayjs(`${form.date}T${form.time}`).toISOString();
      await api.createAppointment({
        customerName: form.customerName,
        phone: form.phone,
        serviceId: form.serviceId || null,
        startAt,
      });
      toast('Appointment added.');
      onSaved?.();
      onClose();
      setForm({ customerName: '', phone: '', serviceId: '', date: dayjs().format('YYYY-MM-DD'), time: '10:00' });
    } catch (e2) {
      toast(e2.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add appointment">
      <form onSubmit={submit}>
        <div className="field">
          <label>Customer name</label>
          <input className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Jane Doe" />
        </div>
        <div className="field">
          <label>Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 555-1234" type="tel" />
        </div>
        <div className="field">
          <label>Service</label>
          <select className="select" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
            <option value="">Choose a service…</option>
            {services.data?.map((s) => (
              <option key={s.id} value={s.id}>{s.name} · {formatDuration(s.duration_min)}</option>
            ))}
          </select>
        </div>
        <div className="time-row">
          <div className="field">
            <label>Date</label>
            <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="field">
            <label>Time</label>
            <input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
        </div>
        <button className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Adding…' : 'Add appointment'}</button>
      </form>
    </Sheet>
  );
}

function AddServiceSheet({ open, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', description: '', price: '', duration: '30' });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.price) return toast('Name and price are required.', 'error');
    setSaving(true);
    try {
      await api.createService({
        name: form.name,
        description: form.description,
        priceCents: Math.round(parseFloat(form.price) * 100),
        durationMin: parseInt(form.duration, 10),
      });
      toast('Service added.');
      onSaved?.();
      onClose();
      setForm({ name: '', description: '', price: '', duration: '30' });
    } catch (e2) {
      toast(e2.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add service">
      <form onSubmit={submit}>
        <div className="field">
          <label>Service name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Signature Fade" />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
        </div>
        <div className="time-row">
          <div className="field">
            <label>Price ($)</label>
            <input className="input" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="40.00" />
          </div>
          <div className="field">
            <label>Duration (min)</label>
            <input className="input" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </div>
        </div>
        <button className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Adding…' : 'Add service'}</button>
      </form>
    </Sheet>
  );
}

function AddAvailabilitySheet({ open, onClose, onSaved }) {
  const toast = useToast();
  const [days, setDays] = useState([]);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('18:00');
  const [saving, setSaving] = useState(false);

  function toggleDay(i) {
    setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  }

  async function submit(e) {
    e.preventDefault();
    if (days.length === 0) return toast('Pick at least one day.', 'error');
    setSaving(true);
    try {
      await Promise.all(days.map((weekday) => api.addAvailabilityRule({ weekday, startTime: start, endTime: end })));
      toast('Hours added.');
      onSaved?.();
      onClose();
      setDays([]);
    } catch (e2) {
      toast(e2.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add weekly hours">
      <form onSubmit={submit}>
        <div className="field">
          <label>Days</label>
          <div className="weekday-picker">
            {WEEKDAYS.map((d, i) => (
              <button type="button" key={d} className={`weekday-chip${days.includes(i) ? ' selected' : ''}`} onClick={() => toggleDay(i)}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="time-row">
          <div className="field">
            <label>Opens</label>
            <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label>Closes</label>
            <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Saving…' : 'Save hours'}</button>
      </form>
    </Sheet>
  );
}
