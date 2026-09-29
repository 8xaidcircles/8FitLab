import Link from "next/link";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="fitlab-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2e26e" />
          <stop offset="35%" stopColor="#22c3e0" />
          <stop offset="70%" stopColor="#38a6f2" />
          <stop offset="100%" stopColor="#f27035" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="17" fill="none" stroke="url(#fitlab-ring)" strokeWidth="5" />
      <circle cx="20" cy="20" r="10.5" fill="#2b3192" />
      <text x="20" y="25" textAnchor="middle" fontSize="14" fontWeight="800" fill="#ffffff" fontFamily="sans-serif">
        8
      </text>
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="8FitLab トップへ">
      <LogoMark />
      <span className="text-xl font-extrabold tracking-tight text-indigo">
        8Fit<span className="text-sky">Lab</span>
      </span>
    </Link>
  );
}
