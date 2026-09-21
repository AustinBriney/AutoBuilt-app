import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { formatRelative } from '../lib/format.js';
import Avatar from '../components/Avatar.jsx';
import { SkeletonList } from '../components/Skeleton.jsx';
import EmptyState, { ErrorState } from '../components/EmptyState.jsx';
import { UsersIcon, SearchIcon } from '../components/icons.jsx';
import './Customers.css';

export default function Customers() {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const { status, data, error, refetch } = useAsync(() => api.getCustomers(q), [q]);

  return (
    <div className="screen container">
      <div className="eyebrow">Clients</div>
      <h1 className="page-title">Customers</h1>

      <div className="search-wrap" style={{ marginTop: 20 }}>
        <SearchIcon width={18} height={18} />
        <input className="input" placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {status === 'loading' && <SkeletonList count={5} />}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}
      {status === 'success' && data.length === 0 && (
        <EmptyState icon={UsersIcon} title={q ? 'No matches' : 'No customers yet'} description={q ? 'Try a different name or number.' : 'Customers appear automatically the moment someone books or texts in.'} />
      )}
      {status === 'success' &&
        data.map((c) => (
          <div className="card cust-row" key={c.id} onClick={() => nav(`/customers/${c.id}`)}>
            <Avatar name={c.name} />
            <div className="cust-info">
              <div className="name">{c.name}</div>
              <div className="sub">{c.phone}{c.lastAppointmentAt ? ` · last visit ${formatRelative(c.lastAppointmentAt)}` : ''}</div>
            </div>
            {c.upcomingCount > 0 && <span className="badge badge-accent">{c.upcomingCount} upcoming</span>}
          </div>
        ))}
    </div>
  );
}
