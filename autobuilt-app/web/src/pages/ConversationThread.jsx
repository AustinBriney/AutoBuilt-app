import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { useToast } from '../lib/toast.jsx';
import { formatTime } from '../lib/format.js';
import { ChevronLeftIcon, SendIcon } from '../components/icons.jsx';
import { ErrorState } from '../components/EmptyState.jsx';
import { SkeletonLine } from '../components/Skeleton.jsx';
import './Inbox.css';

export default function ConversationThread() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { status, data, error, refetch } = useAsync(() => api.getConversation(id), [id]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [data]);

  async function send() {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await api.sendMessage(id, draft.trim());
      setDraft('');
      refetch();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="screen">
        <div className="thread-header">
          <button className="thread-back" onClick={() => nav(-1)}><ChevronLeftIcon /></button>
          <SkeletonLine width={140} height={18} />
        </div>
      </div>
    );
  }

  if (status === 'error') return <div className="screen container"><ErrorState message={error} onRetry={refetch} /></div>;

  const { conversation, messages } = data;

  return (
    <div className="screen" style={{ paddingBottom: 100 }}>
      <div className="thread-header">
        <button className="thread-back" onClick={() => nav(-1)}><ChevronLeftIcon /></button>
        <div>
          <div className="thread-title">{conversation.customer_name}</div>
          <div className="thread-sub">{conversation.customer_phone}</div>
        </div>
      </div>

      <div className="thread-body">
        {messages.map((m) => (
          <div key={m.id}>
            <div className={`msg-bubble ${m.direction === 'inbound' ? 'msg-inbound' : 'msg-outbound'}${m.automation_type ? ' automated' : ''}`}>
              {m.body}
            </div>
            <div className="msg-meta" style={{ textAlign: m.direction === 'inbound' ? 'left' : 'right' }}>
              {m.automation_type ? 'Automated · ' : ''}
              {formatTime(m.created_at)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="composer">
        <textarea
          className="textarea"
          rows={1}
          placeholder="Write a reply…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn btn-primary" onClick={send} disabled={sending || !draft.trim()} aria-label="Send">
          {sending ? <span className="spinner" style={{ borderTopColor: 'var(--accent-ink)' }} /> : <SendIcon width={18} height={18} />}
        </button>
      </div>
    </div>
  );
}
