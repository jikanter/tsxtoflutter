
const SK = {
  ink: '#1a1a1a',
  ink2: '#444',
  muted: '#777',
  faint: '#999',
  paper: '#fdfcf8',
  hand: '"Caveat", "Comic Sans MS", "Bradley Hand", cursive',
  ui: '"Kalam", "Caveat", "Comic Sans MS", cursive',
  body: '"Patrick Hand", "Kalam", "Comic Sans MS", cursive',
  accent: '#d97757',
  accent2: '#7a9b76',
  accent3: '#c9a876',
};


function SkIcon({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={SK.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}


export function SvgThatShouldBeIcon() {
  return (
    <SkIcon d="M6 9l6 6 6-6" size={16} />
  );
}
