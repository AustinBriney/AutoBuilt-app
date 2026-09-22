import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ThemeProvider } from './lib/theme.jsx';
import { ToastProvider } from './lib/toast.jsx';
import { api } from './lib/api.js';
import BottomNav from './components/BottomNav.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inbox from './pages/Inbox.jsx';
import ConversationThread from './pages/ConversationThread.jsx';
import Schedule from './pages/Schedule.jsx';
import Customers from './pages/Customers.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import Settings from './pages/Settings.jsx';
import Onboarding from './pages/Onboarding.jsx';

function Shell() {
  const [unread, setUnread] = useState(0);
  const [business, setBusiness] = useState(undefined); // undefined = loading
  const location = useLocation();
  const hideNav = /^\/inbox\/[^/]+$/.test(location.pathname);

  const loadBusiness = () => api.getBusiness().then(setBusiness).catch(() => setBusiness(null));

  useEffect(() => { loadBusiness(); }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      api.getDashboardSummary().then((d) => { if (!cancelled) setUnread(d.unreadCount); }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Still loading the business record — render nothing to avoid a flash.
  if (business === undefined) return null;

  // First-run: business exists but hasn't been set up yet.
  if (business && !business.onboarded) {
    return <Onboarding onDone={loadBusiness} />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/inbox/:id" element={<ConversationThread />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      {!hideNav && <BottomNav unreadCount={unread} />}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
