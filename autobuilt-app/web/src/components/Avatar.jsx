import { initials } from '../lib/format.js';

// Muted, editorial tones that sit comfortably with the paper/ink/brass
// palette instead of clashing with it.
const palette = ['#ad7c34', '#8c6a3e', '#8c3430', '#5b6b78', '#7a6a5d'];

function hashHue(str = '') {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % palette.length;
  return palette[h];
}

export default function Avatar({ name, size = 40 }) {
  const bg = hashHue(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `${bg}26`,
        color: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size * 0.36,
        flexShrink: 0,
      }}
    >
      {initials(name).toUpperCase()}
    </div>
  );
}
