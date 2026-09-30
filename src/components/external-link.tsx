import type { ReactNode } from "react";

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="underline hover:text-indigo" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
