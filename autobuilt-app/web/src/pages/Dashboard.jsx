import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { formatTime, formatRelative } from '../lib/format.js';
import { SkeletonLine, SkeletonCard } from '../components/Skeleton.jsx';
import { ErrorState } from '../components/EmptyState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { CalendarIcon, PhoneMissedIcon, StarIcon, RefreshIcon, ScissorsIcon } from '../components/icons.jsx';
import './Dashboard.css';

const activityMeta = {
  missed_call: { icon: PhoneMissedIcon, verb: 'got a missed-call text-back' },
  reminder: { icon: CalendarIcon, verb: 'was sent a reminder' },
  review_request: { icon: StarIcon, verb: 'was asked for a review' },
  winback: { icon: RefreshIcon, verb: 'got a win-back message' },
};

export default function Dashboard() {
  const { status, data, error, refetch } = useAsync(() => api.getDashboardSummary(), []);
  const business = useAsync(() => api.getBusiness(), []);

  if (status === 'error') return <div className="screen container"><ErrorState message={error} onRetry={refetch} /></div>;

  return (
    <div className="screen container">
      <div className="eyebrow">AutoBuilt</div>
      <h1 className="page-title">
        {status === 'loading' ? <SkeletonLine width={180} height={30} /> : `Hey, ${business.data?.owner_name?.split(' ')[0] || 'there'}`}
      </h1>
      <p className="greeting">Here's what's happening today.</p>

      {status === 'loading' ? (
        <div className="stat-row">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : (
        <div className="stat-row">
          <div className="card stat-card">
            <div className="stat-value">{data.today.length}</div>
            <div className="stat-label">Today</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{data.weekAppointments}</div>
            <div className="stat-label">This week</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{data.newCustomersThisWeek}</div>
            <div className="stat-label">New clients</div>
          </div>
        </div>
      )}

      <div className="section-heading">
        <h2>Today's appointments</h2>
        <Link to="/schedule">See all</Link>
      </div>

      {status === 'loading' && <SkeletonCard />}
      {status === 'success' && data.today.length === 0 && (
        <EmptyState icon={ScissorsIcon} title="Nothing on the books today" description="Enjoy the breather, or add a walk-in from Schedule." />
      )}
      {status === 'success' &&
        data.today.map((appt) => (
          <div key={appt.id} className="card appt-row">
            <div className="appt-time">{formatTime(appt.start_at)}</div>
            <div className="appt-info">
              <div className="name">{appt.customer_name}</div>
              <div className="service">{appt.service_name || 'Appointment'}</div>
            </div>
          </div>
        ))}

      <div className="section-heading">
        <h2>Recent activity</h2>
      </div>
      {status === 'loading' && <SkeletonCard />}
      {status === 'success' && data.recentActivity.length === 0 && (
        <EmptyState title="No automations have fired yet" description="Missed-call texts, reminders, reviews, and win-backs will show up here as they go out." />
      )}
      {status === 'success' && data.recentActivity.length > 0 && (
        <div className="card" style={{ padding: '4px 16px' }}>
          {data.recentActivity.map((a, i) => {
            const meta = activityMeta[a.type] || {};
            const Icon = meta.icon || CalendarIcon;
            return (
              <div key={a.id}>
                <div className="activity-row">
                  <div className="activity-icon"><Icon width={16} height={16} /></div>
                  <div>
                    <div className="activity-text"><b>{a.customer_name}</b> {meta.verb || a.type}</div>
                    <div className="activity-time">{formatRelative(a.sent_at)}</div>
                  </div>
                </div>
                {i < data.recentActivity.length - 1 && <hr className="divider" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
