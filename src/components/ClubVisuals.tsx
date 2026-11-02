import type { ClubIdentity, JerseyPattern, LogoShape, LogoSymbol } from '@/game/types';
import { textOn } from '@/game/matchEngine';

const SHAPES: Record<LogoShape, string> = {
  shield: 'M50 4 L92 16 L92 50 C92 74 72 90 50 98 C28 90 8 74 8 50 L8 16 Z',
  circle: 'M50 4 A46 46 0 1 1 49.9 4 Z',
  hexagon: 'M50 3 L93 27 L93 73 L50 97 L7 73 L7 27 Z',
  diamond: 'M50 2 L96 50 L50 98 L4 50 Z',
  crest: 'M14 8 H86 V56 C86 78 68 92 50 98 C32 92 14 78 14 56 Z',
};

function SymbolPath({ symbol, color }: { symbol: LogoSymbol; color: string }) {
  switch (symbol) {
    case 'star':
      return <path d="M50 26 L56.5 42 L73 42.5 L60 53 L64.5 69 L50 59.5 L35.5 69 L40 53 L27 42.5 L43.5 42 Z" fill={color} />;
    case 'ball':
      return (
        <g>
          <circle cx="50" cy="48" r="20" fill="#fff" stroke={color} strokeWidth="2.5" />
          <path d="M50 38 L59 44.5 L55.5 55 L44.5 55 L41 44.5 Z" fill={color} />
          <path d="M50 38 V29 M59 44.5 L68 41 M55.5 55 L61 63 M44.5 55 L39 63 M41 44.5 L32 41" stroke={color} strokeWidth="2" />
        </g>
      );
    case 'crown':
      return <path d="M28 64 L28 38 L39 49 L50 30 L61 49 L72 38 L72 64 Z M28 68 H72 V73 H28 Z" fill={color} />;
    case 'bolt':
      return <path d="M56 22 L33 54 H48 L42 76 L67 42 H52 Z" fill={color} />;
    case 'eagle':
      return <path d="M50 30 C46 30 44 34 44 37 L24 30 C26 40 32 46 40 48 L30 52 C36 56 42 56 46 54 L44 70 L50 64 L56 70 L54 54 C58 56 64 56 70 52 L60 48 C68 46 74 40 76 30 L56 37 C56 34 54 30 50 30 Z" fill={color} />;
    case 'castle':
      return <path d="M30 70 V40 H36 V46 H42 V40 H48 V46 H52 V40 H58 V46 H64 V40 H70 V70 H56 V58 C56 54 44 54 44 58 V70 Z" fill={color} />;
    default:
      return null;
  }
}

export function ClubLogo({ club, size = 48, className }: { club: Pick<ClubIdentity, 'logo' | 'primary' | 'secondary' | 'short'>; size?: number; className?: string }) {
  const { logo, primary, secondary, short } = club;
  if (logo.type === 'img' && logo.img) {
    return <img src={logo.img} alt="logo" width={size} height={size} className={`rounded-lg object-contain ${className ?? ''}`} style={{ width: size, height: size }} />;
  }
  const sym = logo.symbol;
  const gid = `lg-${primary}-${secondary}`.replace(/[^a-zA-Z0-9-]/g, '');
  const symColor = secondary;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={primary} />
          <stop offset="1" stopColor={primary} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <path d={SHAPES[logo.shape]} fill={`url(#${gid})`} stroke={secondary} strokeWidth="4" />
      <g transform={logo.showInitials && sym !== 'none' ? 'translate(0,-8)' : ''}>
        <SymbolPath symbol={sym} color={symColor} />
      </g>
      {logo.showInitials && (
        <text x="50" y={sym === 'none' ? 58 : 84} textAnchor="middle" fontSize={sym === 'none' ? 28 : 13} fontWeight="900" fill={sym === 'none' ? secondary : textOn(primary)} fontFamily="system-ui, sans-serif" letterSpacing="1">
          {short}
        </text>
      )}
    </svg>
  );
}

export function Jersey({ primary, secondary, pattern, number = 10, name, size = 160 }: { primary: string; secondary: string; pattern: JerseyPattern; number?: number; name?: string; size?: number }) {
  const id = `j-${primary.slice(1)}-${secondary.slice(1)}-${pattern}`;
  const body = 'M30 10 L45 4 C48 10 52 10 55 4 L70 10 L92 24 L84 42 L74 37 L74 94 L26 94 L26 37 L16 42 L8 24 Z';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="drop-shadow-2xl">
      <defs>
        <clipPath id={id}><path d={body} /></clipPath>
        <linearGradient id={id + 'sh'} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".25" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".08" />
          <stop offset="1" stopColor="#000" stopOpacity=".25" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="100" height="100" fill={primary} />
        {pattern === 'stripes' && [30, 46, 62].map((x) => <rect key={x} x={x} y="0" width="8" height="100" fill={secondary} />)}
        {pattern === 'hoops' && [22, 42, 62, 82].map((y) => <rect key={y} x="0" y={y} width="100" height="9" fill={secondary} />)}
        {pattern === 'sash' && <path d="M20 0 L36 0 L84 100 L68 100 Z" fill={secondary} />}
        {pattern === 'halves' && <rect x="50" y="0" width="50" height="100" fill={secondary} />}
        <rect width="100" height="100" fill={`url(#${id}sh)`} />
        <path d="M8 24 L16 42 L26 37 L26 30" fill="none" stroke={secondary} strokeWidth="3" />
        <path d="M92 24 L84 42 L74 37 L74 30" fill="none" stroke={secondary} strokeWidth="3" />
      </g>
      <path d="M45 4 C48 12 52 12 55 4" fill="none" stroke={secondary} strokeWidth="3" />
      <path d={body} fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="1" />
      {name && <text x="50" y="36" textAnchor="middle" fontSize="7" fontWeight="800" fill={pattern === 'plain' ? textOn(primary) : '#fff'} stroke={pattern === 'plain' ? 'none' : '#000'} strokeWidth=".3" fontFamily="system-ui">{name.toUpperCase().slice(0, 12)}</text>}
      <text x="50" y="70" textAnchor="middle" fontSize="28" fontWeight="900" fill={pattern === 'plain' ? textOn(primary) : '#fff'} stroke={pattern === 'plain' ? 'none' : '#000'} strokeWidth=".6" fontFamily="system-ui">{number}</text>
    </svg>
  );
}

/** Static pitch markings in a 105 x 68 coordinate system */
export function PitchLines({ stripes = true }: { stripes?: boolean }) {
  const L = 'rgba(255,255,255,0.85)';
  return (
    <g>
      <rect x="-4" y="-4" width="113" height="76" fill="#14532d" />
      {stripes && Array.from({ length: 10 }, (_, i) => <rect key={i} x={i * 10.5} y="0" width="10.5" height="68" fill={i % 2 ? '#1a6b35' : '#1f7a3d'} />)}
      <g fill="none" stroke={L} strokeWidth="0.3">
        <rect x="0" y="0" width="105" height="68" />
        <line x1="52.5" y1="0" x2="52.5" y2="68" />
        <circle cx="52.5" cy="34" r="9.15" />
        <rect x="0" y="13.84" width="16.5" height="40.32" />
        <rect x="88.5" y="13.84" width="16.5" height="40.32" />
        <rect x="0" y="24.84" width="5.5" height="18.32" />
        <rect x="99.5" y="24.84" width="5.5" height="18.32" />
        <path d="M16.5 26.7 A9.15 9.15 0 0 1 16.5 41.3" />
        <path d="M88.5 26.7 A9.15 9.15 0 0 0 88.5 41.3" />
        <path d="M0 1 A1 1 0 0 0 1 0 M104 0 A1 1 0 0 0 105 1 M0 67 A1 1 0 0 1 1 68 M104 68 A1 1 0 0 1 105 67" />
        <rect x="-1.8" y="30.34" width="1.8" height="7.32" strokeWidth="0.25" fill="rgba(255,255,255,0.15)" />
        <rect x="105" y="30.34" width="1.8" height="7.32" strokeWidth="0.25" fill="rgba(255,255,255,0.15)" />
      </g>
      <g fill={L}>
        <circle cx="52.5" cy="34" r="0.4" />
        <circle cx="11" cy="34" r="0.35" />
        <circle cx="94" cy="34" r="0.35" />
      </g>
    </g>
  );
}
