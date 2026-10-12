import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="8FitLab トップへ">
      <Image src="/brand/logo-mark.png" alt="" width={36} height={36} className="size-9 shrink-0" priority />
      <span className="min-w-0">
        <span className="block text-xl leading-none font-extrabold tracking-tight text-indigo">
          8Fit<span className="text-sky">Lab</span>
        </span>
        <span className="mt-1 block text-[10px] leading-snug font-medium text-muted min-[360px]:text-[11px] sm:text-xs">
          <span className="whitespace-nowrap">エンジニアに、</span>
          <span className="whitespace-nowrap">フィットするキャリアを。</span>
        </span>
      </span>
    </Link>
  );
}
