export function ScoreRing({ value, size = 176 }: { value: number; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="score-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f2e26e" />
            <stop offset="40%" stopColor="#22c3e0" />
            <stop offset="75%" stopColor="#38a6f2" />
            <stop offset="100%" stopColor="#2b3192" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8eafb" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#score-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-extrabold text-indigo">{Math.round(clamped)}</span>
        <span className="text-xs font-bold text-muted">/ 100</span>
      </div>
    </div>
  );
}

export function ScoreBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-indigo-soft" aria-hidden="true">
      <div className="h-full rounded-full bg-gradient-to-r from-cyan to-indigo" style={{ width: `${clamped}%` }} />
    </div>
  );
}
