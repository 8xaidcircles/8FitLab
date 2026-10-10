import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="8FitLab トップへ">
      <Image src="/brand/logo-mark.png" alt="" width={36} height={36} className="size-9" priority />
      <span className="text-xl font-extrabold tracking-tight text-indigo">
        8Fit<span className="text-sky">Lab</span>
      </span>
    </Link>
  );
}
