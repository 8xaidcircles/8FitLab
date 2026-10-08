import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { JobCategoryPickTable, ServiceCard, ServiceTable } from "@/components/service-compare";
import { JOB_SERVICE_PICKS, SCHOOL_PICKS, type JobCategoryPick } from "@/lib/blog/job-category-picks";
import { listPosts, listServices } from "@/lib/blog/microcms";
import { groupByPurpose, normalizeServices, type ComparedService } from "@/lib/blog/services";
import { collectCategories, collectGoalCategories } from "@/lib/blog/utils";
import { loadGoals } from "@/lib/career-match";
import { BlogListing } from "./blog-listing";

const TITLE = "プログラミングスクール・転職サービス比較";
const DESCRIPTION =
  "エンジニアを目指す人向けに、プログラミングスクールと転職サービスを料金・期間・サポート内容で比較します。目的別の選び方や、キャリアの考え方の記事もまとめています。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
};

function SectionHeading({ id, kicker, children }: { id: string; kicker: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6">
      <p className="text-xs font-bold tracking-widest text-sky">{kicker}</p>
      <h2 className="mt-1 border-l-4 border-indigo pl-3 text-xl font-extrabold md:text-2xl">{children}</h2>
    </div>
  );
}

function ServiceSection({
  id,
  kicker,
  title,
  lead,
  type,
  picks,
  goalNames,
  services,
}: {
  id: string;
  kicker: string;
  title: string;
  lead: string;
  type: ComparedService["type"];
  picks: JobCategoryPick[];
  goalNames: Map<string, string>;
  services: ComparedService[];
}) {
  return (
    <section className="mt-12">
      <SectionHeading id={id} kicker={kicker}>
        {title}
      </SectionHeading>
      <p className="mt-3 text-sm leading-relaxed text-muted">{lead}</p>
      <JobCategoryPickTable picks={picks} type={type} goalNames={goalNames} />
      {services.length > 0 && (
        <>
          <div className="mt-10 space-y-6">
            {services.map((service, i) => (
              <ServiceCard key={service.id} service={service} rank={i + 1} />
            ))}
          </div>
          <h3 className="mt-10 text-lg font-extrabold">{title}の一覧表</h3>
          <div className="mt-3">
            <ServiceTable services={services} />
          </div>
        </>
      )}
    </section>
  );
}

export default async function BlogIndex() {
  const [posts, rawServices, goals] = await Promise.all([listPosts(), listServices(), loadGoals()]);
  const services = normalizeServices(rawServices);
  const purposes = groupByPurpose([...services.school, ...services.job_service]);
  const goalNames = new Map(goals.map((goal) => [goal.goal_id, goal.name]));
  // 狭い画面で 2 行になるときは、\u200b（ゼロ幅スペース）の位置でだけ改行する（break-keep と組み合わせる）
  const jumpLinks = [
    { href: "#schools", label: "スクールを\u200b比較" },
    { href: "#job-services", label: "転職サービスを\u200b比較" },
    ...(purposes.length > 0 ? [{ href: "#purposes", label: "目的から\u200b探す" }] : []),
  ];

  return (
    <BlogListing
      path="/blog"
      kicker="COMPARE"
      title={TITLE}
      description="未経験からエンジニアを目指す人、エンジニアとして次のキャリアを考えている人向けに、スクールと転職サービスを同じ項目で並べました。迷ったら、先に Goal Fit で目指す職種との距離を確かめてみてください。"
      posts={posts}
      allPosts={posts}
      categories={collectCategories(posts)}
      goalCategories={collectGoalCategories(posts, goals)}
      postsHeading="記事一覧"
    >
      <nav aria-label="ページ内の目次" className="mt-6 rounded-2xl border border-line bg-white p-4 sm:p-5">
        <p className="text-sm font-extrabold">探し方</p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2 pb-1 sm:gap-3">
          {jumpLinks.map((link) => (
            <li key={link.href} className="w-[calc((100%-1rem)/3)] sm:w-[calc((100%-1.5rem)/3)]">
              <a
                href={link.href}
                className="btn-reflection flex h-full min-h-11 items-center justify-center gap-1 rounded-full bg-linear-to-r from-[#9dd6fb] to-sky px-2 py-2 text-center text-[11px] leading-tight font-bold break-keep text-white shadow-[0_3px_0_#1d7fc4] transition hover:translate-y-0.5 hover:shadow-[0_1px_0_#1d7fc4] sm:px-3 sm:text-xs md:text-sm"
              >
                {link.label}
                <span aria-hidden>›</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section className="relative mt-6 overflow-hidden rounded-2xl bg-ink p-5 text-white sm:p-6 md:p-8">
        <div className="bg-brand-gradient absolute inset-x-0 top-0 h-1" />
        <p className="text-[10px] font-bold tracking-widest text-sky sm:text-xs">GOAL FIT</p>
        <p className="mt-2 text-base leading-snug font-extrabold sm:text-lg md:text-xl lg:text-2xl">
          どのスクールが合うか迷ったら、まずは目指す職種との距離を確認
        </p>
        <p className="mt-2 text-xs leading-relaxed text-white/80 sm:text-sm md:text-base">
          スキル・経験・学歴から、目指す職種との一致度と、次に学ぶ順番がわかります。スクールで何を学ぶべきかを決める材料にしてください。
        </p>
        <div className="mt-5 text-center">
          <Link
            href="/goal-fit"
            className="inline-block rounded-full bg-white px-6 py-2.5 text-xs font-bold text-indigo transition hover:bg-sky-soft sm:px-8 sm:py-3 sm:text-sm md:text-base"
          >
            無料でGoal Fitを試す
          </Link>
        </div>
      </section>
      <p className="mt-3 text-center text-xs text-muted">
        <span
          tabIndex={0}
          aria-describedby="ad-note-tip"
          className="group relative inline-block cursor-help underline decoration-dotted underline-offset-4 outline-none focus-visible:text-indigo"
        >
          記事内に広告を含む場合があります。
          <span
            id="ad-note-tip"
            role="tooltip"
            className="invisible absolute top-full left-1/2 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-left leading-relaxed text-white no-underline opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100"
          >
            本サイトのページには「アフィリエイト広告」などの広告を掲載している場合があります。
            <br />
            消費者庁が問題としている「誇大な宣伝や表現」とならないよう配慮しコンテンツを制作しておりますのでご安心ください。
          </span>
        </span>
      </p>

      <ServiceSection
        id="schools"
        kicker="SCHOOL"
        title="プログラミングスクール比較"
        lead="職種ごとに、その職種の学習ロードマップに沿って学べるスクール・コースを 1 つずつ並べています。"
        type="school"
        picks={SCHOOL_PICKS}
        goalNames={goalNames}
        services={services.school}
      />

      <ServiceSection
        id="job-services"
        kicker="JOB SERVICE"
        title="転職サービス比較"
        lead="職種ごとに、その職種の求人や転職支援を扱う就職・転職サービスを 1 つずつ並べています。複数のサービスに登録して、紹介される求人やアドバイザーとの相性を比べるのが一般的です。"
        type="job_service"
        picks={JOB_SERVICE_PICKS}
        goalNames={goalNames}
        services={services.job_service}
      />

      {purposes.length > 0 && (
        <section className="mt-12">
          <SectionHeading id="purposes" kicker="PURPOSE">
            目的から探す
          </SectionHeading>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {purposes.map((group) => (
              <div key={group.purpose} className="rounded-2xl border border-line bg-white p-5">
                <h3 className="font-extrabold">{group.purpose}</h3>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {group.services.map((service) => (
                    <li key={service.id}>
                      <a href={`#service-${service.id}`} className="text-indigo hover:underline">
                        {service.name}
                      </a>
                      <span className="ml-2 text-xs text-muted">{service.type === "school" ? "スクール" : "転職サービス"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </BlogListing>
  );
}
