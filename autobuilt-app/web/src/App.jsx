import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ThemeProvider } from './lib/theme.jsx';
import { ToastProvider } from './lib/toast.jsx';
import { AuthProvider, useAuth } from './lib/auth.jsx';
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
import Login from './pages/Login.jsx';

function Shell() {
  const { business, refreshBusiness } = useAuth();
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const hideNav = /^\/inbox\/[^/]+$/.test(location.pathname);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      api.getDashboardSummary().then((d) => { if (!cancelled) setUnread(d.unreadCount); }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // First-run: the business was just created at signup but hasn't been set up yet.
  if (business && !business.onboarded) {
    return <Onboarding onDone={refreshBusiness} />;
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

function Gate() {
  const { business } = useAuth();
  // undefined = we haven't checked a stored token yet; null = signed out.
  if (business === undefined) return null;
  if (business === null) return <Login />;
  return <Shell />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <Gate />
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
