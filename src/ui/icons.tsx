// Small SF-Symbol-like icons drawn with react-native-svg (works on web and native).

import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
  filled?: boolean;
}

export function Chevron({ color, size = 14 }: IconProps) {
  return (
    <Svg width={size * 0.6} height={size} viewBox="0 0 8 14">
      <Path d="M1.5 1.5 7 7l-5.5 5.5" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BackChevron({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size * 0.55} height={size} viewBox="0 0 12 22">
      <Path d="M10.5 1.5 1.5 11l9 9.5" stroke={color} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** chart.pie */
export function SummaryIcon({ color, size = 26, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M11 3.05A9 9 0 1 0 20.95 13H11z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M14 2.2A9 9 0 0 1 21.8 10H14z" fill={color} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  );
}

/** list.bullet */
export function ActivityIcon({ color, size = 26, filled }: IconProps) {
  const w = filled ? 2.4 : 1.9;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {[6, 12, 18].map((y) => (
        <Circle key={`c${y}`} cx={4.5} cy={y} r={1.6} fill={color} />
      ))}
      {[6, 12, 18].map((y) => (
        <Path key={`l${y}`} d={`M9 ${y}h12`} stroke={color} strokeWidth={w} strokeLinecap="round" />
      ))}
    </Svg>
  );
}

/** bolt */
export function SetupIcon({ color, size = 26, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M13.5 2 4.5 13.5h6.5L10 22l9-11.5h-6.5z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** gearshape */
export function SettingsIcon({ color, size = 26, filled }: IconProps) {
  const teeth = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {teeth.map((a) => (
        <Rect
          key={a}
          x={10.6}
          y={1.6}
          width={2.8}
          height={4.4}
          rx={1}
          fill={color}
          transform={`rotate(${(a * 180) / Math.PI} 12 12)`}
        />
      ))}
      <Circle cx={12} cy={12} r={7} fill={filled ? color : 'none'} stroke={color} strokeWidth={1.9} />
      <Circle cx={12} cy={12} r={2.8} fill={filled ? '#00000000' : 'none'} stroke={filled ? '#fff' : color} strokeWidth={1.9} />
    </Svg>
  );
}
