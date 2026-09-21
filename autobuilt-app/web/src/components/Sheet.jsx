import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './icons.jsx';

export default function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 19 }}>{title}</h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: 8, minHeight: 'auto' }}
          >
            <XIcon width={18} height={18} />
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body
  );
}
