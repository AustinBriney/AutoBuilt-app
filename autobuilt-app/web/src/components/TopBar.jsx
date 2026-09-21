import './TopBar.css';

export default function TopBar({ title, subtitle, action, back }) {
  return (
    <div className="topbar container">
      <div>
        {back}
        {subtitle && <div className="eyebrow">{subtitle}</div>}
        <h1 className="page-title">{title}</h1>
      </div>
      {action && <div className="topbar-action">{action}</div>}
    </div>
  );
}
