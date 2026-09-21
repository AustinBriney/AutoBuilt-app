import { initials } from '../lib/format.js';

const palette = ['#c9a35a', '#7fa88f', '#a17bb0', '#c17d5e', '#6fa0bf'];

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
