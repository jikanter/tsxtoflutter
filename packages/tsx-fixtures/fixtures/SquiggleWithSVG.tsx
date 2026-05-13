function SkSquiggle({ w = 120 }) {
  return (
    <svg width={w} height="6" viewBox={`0 0 ${w} 6`} style={{ display: 'block' }}>
      <path d={`M0 3 ${Array.from({length: Math.floor(w/12)}, (_, i) => `Q${i*12+6} ${i%2?0:6} ${i*12+12} 3`).join(' ')}`}
        stroke={"#000"} strokeWidth="1.2" fill="none" />
    </svg>
  );
}


export function SquiggleWithSVG() {
  return (
    <SkSquiggle/>
  )
}

