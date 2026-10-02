import type { ReactNode } from "react";

export function ExternalLink({
  href,
  children,
  className = "underline hover:text-indigo",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
