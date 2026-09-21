// Small, consistent line-icon set (no icon library dependency).
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const HomeIcon = (p) => (
  <svg {...base} {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /></svg>
);
export const InboxIcon = (p) => (
  <svg {...base} {...p}><path d="M4 13h4l1.5 3h5L16 13h4" /><path d="M4 13 5.6 5.6A2 2 0 0 1 7.55 4h8.9a2 2 0 0 1 1.95 1.6L20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /></svg>
);
export const CalendarIcon = (p) => (
  <svg {...base} {...p}><rect x="4" y="5.5" width="16" height="15" rx="2.5" /><path d="M4 10h16M8 3.5v3M16 3.5v3" /></svg>
);
export const UsersIcon = (p) => (
  <svg {...base} {...p}><circle cx="9" cy="8.5" r="3" /><path d="M2.7 19a6.3 6.3 0 0 1 12.6 0" /><path d="M15.5 6a3 3 0 1 1 2 5.6" /><path d="M17 13a6.3 6.3 0 0 1 4.3 6" /></svg>
);
export const SettingsIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2.06 2.06 0 1 1-2.9 2.9l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.55V20a2.06 2.06 0 1 1-4.13 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.06a2.06 2.06 0 1 1-2.92-2.9l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1.03H4a2.06 2.06 0 1 1 0-4.13h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.05a2.06 2.06 0 1 1 2.9-2.92l.06.06a1.7 1.7 0 0 0 1.87.34H10.5a1.7 1.7 0 0 0 1.03-1.55V4a2.06 2.06 0 1 1 4.13 0v.1a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2.06 2.06 0 1 1 2.9 2.92l-.06.05a1.7 1.7 0 0 0-.34 1.87v.02a1.7 1.7 0 0 0 1.55 1.03H20a2.06 2.06 0 1 1 0 4.13h-.1a1.7 1.7 0 0 0-1.5 1.03z" /></svg>
);
export const ChevronRightIcon = (p) => (<svg {...base} {...p}><path d="m9 6 6 6-6 6" /></svg>);
export const ChevronLeftIcon = (p) => (<svg {...base} {...p}><path d="m15 6-6 6 6 6" /></svg>);
export const PlusIcon = (p) => (<svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const SendIcon = (p) => (<svg {...base} {...p}><path d="m4 12 16-7-6.5 16-2.5-7-7-2z" /></svg>);
export const SearchIcon = (p) => (<svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const SunIcon = (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.4M12 19v2.5M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19 12h2.5M4.9 19l1.7-1.7M17.4 6.6l1.7-1.7" /></svg>);
export const MoonIcon = (p) => (<svg {...base} {...p}><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.3a7 7 0 0 0 11 11.2z" /></svg>);
export const CheckIcon = (p) => (<svg {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7" /></svg>);
export const XIcon = (p) => (<svg {...base} {...p}><path d="m6 6 12 12M18 6 6 18" /></svg>);
export const PhoneMissedIcon = (p) => (<svg {...base} {...p}><path d="m16 6 4 4M20 6l-4 4" /><path d="M3.5 5.5c1-1 2-1.5 3-1.2l2 2.6c.3.5.2 1.1-.2 1.5l-1.3 1.3a13 13 0 0 0 6.3 6.3l1.3-1.3c.4-.4 1-.5 1.5-.2l2.6 2c.3 1-.2 2-1.2 3-1.3 1.3-3.3 1.6-5 .9a19 19 0 0 1-10.5-10.5c-.7-1.7-.4-3.7.9-5z" /></svg>);
export const StarIcon = (p) => (<svg {...base} fill="currentColor" stroke="none" {...p}><path d="m12 2.5 3 6.4 6.9.8-5.1 4.8 1.4 6.9-6.2-3.5-6.2 3.5 1.4-6.9-5.1-4.8 6.9-.8z" /></svg>);
export const RefreshIcon = (p) => (<svg {...base} {...p}><path d="M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6" /></svg>);
export const ScissorsIcon = (p) => (<svg {...base} {...p}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="m8 7.5 12 9M8 16.5l12-9" /></svg>);
export const AlertIcon = (p) => (<svg {...base} {...p}><path d="M12 3.5 21.5 20h-19z" /><path d="M12 10v4M12 17.2v.1" /></svg>);
