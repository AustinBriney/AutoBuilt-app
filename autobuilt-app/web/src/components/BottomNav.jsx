import { NavLink } from 'react-router-dom';
import { HomeIcon, InboxIcon, CalendarIcon, UsersIcon, SettingsIcon } from './icons.jsx';
import './BottomNav.css';

const items = [
  { to: '/', label: 'Dashboard', icon: HomeIcon, end: true },
  { to: '/inbox', label: 'Inbox', icon: InboxIcon },
  { to: '/schedule', label: 'Schedule', icon: CalendarIcon },
  { to: '/customers', label: 'Customers', icon: UsersIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function BottomNav({ unreadCount = 0 }) {
  return (
    <nav className="bottom-nav">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon-wrap">
            <Icon />
            {to === '/inbox' && unreadCount > 0 && <span className="nav-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </span>
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
