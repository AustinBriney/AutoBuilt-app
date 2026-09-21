import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { formatRelative } from '../lib/format.js';
import Avatar from '../components/Avatar.jsx';
import { SkeletonList } from '../components/Skeleton.jsx';
import EmptyState, { ErrorState } from '../components/EmptyState.jsx';
import { InboxIcon } from '../components/icons.jsx';
import './Inbox.css';

export default function Inbox() {
  const nav = useNavigate();
  const { status, data, error, refetch } = useAsync(() => api.getConversations(), []);

  return (
    <div className="screen container">
      <div className="eyebrow">Messages</div>
      <h1 className="page-title">Inbox</h1>

      <div style={{ marginTop: 20 }}>
        {status === 'loading' && <SkeletonList count={5} />}
        {status === 'error' && <ErrorState message={error} onRetry={refetch} />}
        {status === 'success' && data.length === 0 && (
          <EmptyState
            icon={InboxIcon}
            title="No conversations yet"
            description="Texts from customers — and every automated reminder or follow-up — will show up here."
          />
        )}
        {status === 'success' &&
          data.map((c) => (
            <div key={c.id} className={`card conv-row${c.unread ? ' unread' : ''}`} onClick={() => nav(`/inbox/${c.id}`)}>
              <Avatar name={c.customer_name} />
              <div className="conv-body">
                <div className="conv-top">
                  <span className="name">{c.customer_name}</span>
                  <span className="time">{formatRelative(c.last_message_at)}</span>
                </div>
                <div className="conv-preview">{c.last_message}</div>
              </div>
              {Boolean(c.unread) && <span className="unread-dot" />}
            </div>
          ))}
      </div>
    </div>
  );
}
