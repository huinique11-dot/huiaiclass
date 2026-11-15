import { useMemo } from 'react';

// 장식 전용 컴포넌트: 화면 기능과 무관하며, 보조기기에는 숨겨집니다.

const BULB_COLORS = ['#e04a6a', '#e2b649', '#5f9e4c', '#f2c4d2', '#fff4dc'];

// 새로고침해도 같은 자리에 놓이도록 고정 시드 난수 사용
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function ChristmasLights({ count = 28, top = false }: { count?: number; top?: boolean }) {
  return (
    <div className={`xmas-lights${top ? ' xmas-lights--top' : ''}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          style={{
            ['--c' as string]: BULB_COLORS[i % BULB_COLORS.length],
            ['--delay' as string]: `${(i % 3) * 0.6}s`,
          }}
        />
      ))}
    </div>
  );
}

export function ChristmasSky() {
  const { sparkles, snow } = useMemo(() => {
    const r = seeded(1225);
    const range = (a: number, b: number) => a + r() * (b - a);
    return {
      sparkles: Array.from({ length: 22 }, () => ({
        left: range(0, 100),
        top: range(0, 100),
        size: range(7, 15),
        d: range(2.5, 5),
        delay: range(0, 5),
      })),
      snow: Array.from({ length: 26 }, () => ({
        left: range(0, 100),
        size: range(3, 6),
        opacity: range(0.5, 0.95),
        d: range(12, 24),
        delay: range(-24, 0),
        sway: range(-30, 30),
      })),
    };
  }, []);

  return (
    <div className="xmas-sky" aria-hidden="true">
      {sparkles.map((s, i) => (
        <span
          key={`s${i}`}
          className="xmas-sparkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            ['--d' as string]: `${s.d}s`,
            ['--delay' as string]: `${s.delay}s`,
          }}
        />
      ))}
      {snow.map((f, i) => (
        <span
          key={`f${i}`}
          className="xmas-snow"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            ['--d' as string]: `${f.d}s`,
            ['--delay' as string]: `${f.delay}s`,
            ['--sway' as string]: `${f.sway}px`,
          }}
        />
      ))}
    </div>
  );
}
