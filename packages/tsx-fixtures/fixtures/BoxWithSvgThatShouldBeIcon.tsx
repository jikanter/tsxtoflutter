// Anthropic loves their SKBox

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

function SkBox({ children, style = {}, dashed = false, fill, ...rest }) {
  return (
    <div {...rest} style={{
      border: `1.5px ${dashed ? 'dashed' : 'solid'} ${SK.ink}`,
      borderRadius: 6,
      padding: 8,
      background: fill || 'transparent',
      fontFamily: SK.body,
      fontSize: 14,
      color: SK.ink,
      ...style,
    }}>{children}</div>
  );
}



export function BoxWithSvgThatShouldBeIcon() {
  return (
    <SkBox style={{ height: 78, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 10 }}>
          <SkIcon d="M12 5v14m-7-7h14" size={20} />
          <div style={{ fontFamily: SK.ui, fontSize: 14 }}>Log entry</div>
        </SkBox>
  )
}
