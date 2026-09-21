import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { formatDayHeading, formatTime, formatRelative, formatMoney } from '../lib/format.js';
import Avatar from '../components/Avatar.jsx';
import { SkeletonList } from '../components/Skeleton.jsx';
import { ErrorState } from '../components/EmptyState.jsx';
import { ChevronLeftIcon, PhoneMissedIcon, CalendarIcon, StarIcon, RefreshIcon } from '../components/icons.jsx';
import './Customers.css';

const automationMeta = {
  missed_call: { icon: PhoneMissedIcon, label: 'Missed-call text-back' },
  reminder: { icon: CalendarIcon, label: 'Appointment reminder' },
  review_request: { icon: StarIcon, label: 'Review request' },
  winback: { icon: RefreshIcon, label: 'Win-back message' },
};

export default function CustomerDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { status, data, error, refetch } = useAsync(() => api.getCustomer(id), [id]);

  if (status === 'loading') return <div className="screen container"><SkeletonList count={4} /></div>;
  if (status === 'error') return <div className="screen container"><ErrorState message={error} onRetry={refetch} /></div>;

  return (
    <div className="screen container">
      <button className="btn btn-ghost btn-sm" style={{ padding: '6px 0', marginBottom: 14 }} onClick={() => nav(-1)}>
        <ChevronLeftIcon width={18} height={18} /> Back
      </button>

      <div className="detail-header">
        <Avatar name={data.name} size={56} />
        <div>
          <div className="detail-name" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{data.name}</div>
          <div className="detail-sub">{data.phone}{data.email ? ` · ${data.email}` : ''}</div>
        </div>
      </div>

      <div className="section-heading" style={{ marginTop: 0 }}>
        <h2 style={{ fontSize: 16.5 }}>Appointment history</h2>
      </div>
      {data.appointments.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>No appointments yet.</p>
      ) : (
        <div className="card" style={{ padding: '2px 16px' }}>
          {data.appointments.map((a, i) => (
            <div key={a.id}>
              <div className="hist-row">
                <div>
                  <div className="name">{a.service_name || 'Appointment'}</div>
                  <div className="meta">{formatDayHeading(a.start_at)} · {formatTime(a.start_at)}</div>
                </div>
                <span className={`badge ${a.status === 'completed' ? 'badge-success' : a.status === 'cancelled' || a.status === 'no_show' ? 'badge-danger' : 'badge-neutral'}`}>
                  {a.status.replace('_', ' ')}
                </span>
              </div>
              {i < data.appointments.length - 1 && <hr className="divider" />}
            </div>
          ))}
        </div>
      )}

      <div className="section-heading">
        <h2 style={{ fontSize: 16.5 }}>Automation history</h2>
      </div>
      {data.automationHistory.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Nothing sent yet.</p>
      ) : (
        <div className="card" style={{ padding: '2px 16px' }}>
          {data.automationHistory.map((e, i) => {
            const meta = automationMeta[e.type] || {};
            const Icon = meta.icon || CalendarIcon;
            return (
              <div key={e.id}>
                <div className="hist-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon width={16} height={16} style={{ color: 'var(--accent)' }} />
                    <div>
                      <div className="name">{meta.label || e.type}</div>
                      <div className="meta">{e.status === 'sent' ? `Sent ${formatRelative(e.sent_at)}` : `Scheduled for ${formatTime(e.scheduled_for)}`}</div>
                    </div>
                  </div>
                  <span className={`badge ${e.status === 'sent' ? 'badge-success' : 'badge-neutral'}`}>{e.status}</span>
                </div>
                {i < data.automationHistory.length - 1 && <hr className="divider" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
