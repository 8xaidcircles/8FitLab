// Generates src/lib/learning-path-services-mapping.json.
// Candidate membership (job_category_matched) comes from
// files/service-data/{ITスクール,IT転職サービス}.xlsm - カテゴリ別サマリー.csv.
// Attributes were checked on each official site; see docs/service-filtering-logic.md.
// Usage: node scripts/build_learning_path_services_mapping.mjs

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKED_AT = "2026-10-06";

const FE = "フロントエンドエンジニア";
const BE = "バックエンドエンジニア";
const FS = "フルスタックエンジニア";
const DA = "データアナリスト";
const DS = "データサイエンティスト";
const DE = "データエンジニア";
const PM = "ITプロジェクトマネージャー";
const PDM = "プロダクトマネージャー";
const ARCH = "ソフトウェアアーキテクト";
const MOBILE = "モバイルアプリエンジニア";
const NW = "ネットワークエンジニア";
const QA = "テストエンジニア / QA";
const DEVOPS = "DevOps / SREエンジニア";
const CLOUD = "クラウドアーキテクト";

const JOB_CATEGORIES = [FE, BE, FS, DA, DS, DE, PM, PDM, ARCH, MOBILE, NW, QA, DEVOPS, CLOUD];

// status: "active" | "closed" | "unverifiable" | "excluded"
// Order within each category follows the CSV order.
const SCHOOLS = [
  { id: "code-village", name: "Code Village", url: "https://join.codevillage.jp/", beginner_friendly: null, categories: [FE], status: "unverifiable", note: "公式サイトがエラー（500）で内容を確認できない" },
  { id: "tech-mentor", name: "Tech Mentor", course: "Webエンジニアコース", url: "https://tech-mentor.dev/", beginner_friendly: true, categories: [FE], status: "active" },
  { id: "akros", name: "Akros", url: "https://akros-ac.jp/", beginner_friendly: true, categories: [FE], status: "active" },
  { id: "zero-school", name: "0円スクール（ゼロスク）", url: "https://zero-school.com/new/", beginner_friendly: true, categories: [BE], status: "active", note: "運営会社への就職が前提。18〜35歳・通学" },
  { id: "techgeek", name: "テックギーク", url: "https://techgeek-school.com/", beginner_friendly: true, categories: [BE], status: "active", note: "現在の主力は Shopify AI アプリ開発講座で、バックエンド全般の講座ではない" },
  { id: "potepan-camp", name: "ポテパンキャンプ", url: "https://camp.potepan.com/", beginner_friendly: true, categories: [BE], status: "active" },
  { id: "runteq", name: "RUNTEQ", url: "https://runteq.jp/", beginner_friendly: true, categories: [BE, FS], status: "active" },
  { id: "raisetech", name: "RaiseTech", url: "https://raise-tech.net/", beginner_friendly: true, categories: [BE, DEVOPS, CLOUD], status: "active" },
  { id: "wonderful-code", name: "ワンダフルコード", url: "https://wonderful-wife.net/study/", beginner_friendly: null, categories: [BE], status: "active", note: "未経験向けかどうかを公式サイトで確認できない" },
  { id: "tokyo-it-school-fullstack", name: "東京ITスクール", course: "フルスタック研修", url: "https://tokyoitschool.jp/", beginner_friendly: false, categories: [FS], status: "excluded", note: "法人向け研修で個人は申し込めない" },
  { id: "techacademy", name: "TechAcademy", url: "https://techacademy.jp/", beginner_friendly: true, categories: [FS, DS, QA], status: "closed", note: "新規申し込みの受付を停止" },
  { id: "terracan-programming", name: "テラキャン プログラミング（旧 DMM WEBCAMP）", url: "https://web-camp.io/", beginner_friendly: true, categories: [FS, DS], status: "active" },
  { id: "street-academy", name: "ストアカ", url: "https://www.street-academy.com/", beginner_friendly: null, categories: [DA], status: "active", note: "講座マーケットプレイスのため、講座ごとに対象者が異なる" },
  { id: "datamix-data-scientist", name: "データミックス", course: "データサイエンティスト育成講座", url: "https://datamix.co.jp/school/data-scientist/", beginner_friendly: true, categories: [DA], status: "active" },
  { id: "aidemy", name: "Aidemy", url: "https://aidemy.net/", beginner_friendly: true, categories: [DA, DS], status: "closed", note: "Aidemy Premium は 2026-06-30 で終了" },
  { id: "codecamp", name: "CodeCamp", url: "https://codecamp.jp/courses/engineer", beginner_friendly: true, categories: [DA, DS], status: "active" },
  { id: "ai-academy-bootcamp", name: "AI Academy Bootcamp", course: "AI人材コース", url: "https://aiacademy.jp/bootcamp/", beginner_friendly: true, categories: [DA], status: "active" },
  { id: "internet-academy", name: "インターネット・アカデミー", url: "https://www.internetacademy.jp/", beginner_friendly: true, categories: [DA, QA, DEVOPS], status: "active", note: "DevOps / SRE はインフラエンジニア転職コース" },
  { id: "winschool", name: "Winスクール", url: "https://www.winschool.jp/", beginner_friendly: true, categories: [DA, MOBILE, CLOUD], status: "active", note: "モバイルはスマホアプリ開発実践（React Native）講座、クラウドは AWS ソリューションアーキテクト資格対策" },
  { id: "data-learning-school", name: "データラーニングスクール", url: "https://school.data-learning.com/", beginner_friendly: true, categories: [DS, DE], status: "active", note: "データエンジニアリング講座を含む" },
  { id: "data-science-bootcamp", name: "データサイエンスブートキャンプ", url: "https://l.datasciencebootcamp.net/", beginner_friendly: true, categories: [DS], status: "active" },
  { id: "staaca", name: "スタアカ", url: "https://toukei-lab.com/achademy/", beginner_friendly: true, categories: [DS], status: "active" },
  { id: "samurai-engineer", name: "SAMURAI ENGINEER", url: "https://www.sejuku.net/", beginner_friendly: true, categories: [DS, DEVOPS, CLOUD], status: "active", note: "クラウドはクラウドエンジニア転職コース" },
  { id: "tech-is", name: "TECH I.S.", url: "https://techis.jp/", beginner_friendly: true, categories: [DS], status: "active" },
  { id: "ai-jobcolle", name: "AIジョブカレ", url: "https://www.aijobcolle.com/", beginner_friendly: true, categories: [DS], status: "active", note: "個人向けの申し込みは E資格パッケージに限られる" },
  { id: "mitratech", name: "MITRAtech", url: "https://mitra-tech.jp/", beginner_friendly: true, categories: [DS], status: "active" },
  { id: "ai-connect", name: "AI CONNECT", url: "https://ai-c.net/", beginner_friendly: true, categories: [DS], status: "active" },
  { id: "dotpro", name: ".Pro", url: "https://dotpro.net/", beginner_friendly: true, categories: [DS], status: "active" },
  { id: "ai-boost", name: "AI boost", url: null, beginner_friendly: null, categories: [DS], status: "unverifiable", note: "公式サイトを特定できない" },
  { id: "raretech", name: "RareTECH", url: "https://raretech.site/", beginner_friendly: true, categories: [DS, NW], status: "active", note: "入学試験あり" },
  { id: "datamix-data-engineer", name: "データミックス", course: "データエンジニア育成講座", url: "https://datamix.co.jp/school/expert/dataengineer/", beginner_friendly: true, categories: [DE], status: "active" },
  { id: "aws-training", name: "AWS 公式トレーニング", url: "https://aws.amazon.com/jp/training/", beginner_friendly: true, categories: [DE, DEVOPS, CLOUD], status: "active" },
  { id: "google-skills", name: "Google Skills（旧 Google Cloud Skills Boost）", url: "https://www.skills.google/", beginner_friendly: true, categories: [DE], status: "active" },
  { id: "snowflake-university", name: "Snowflake University", url: "https://learn.snowflake.com/", beginner_friendly: true, categories: [DE], status: "active" },
  { id: "i-think", name: "アイシンク", course: "PMP 試験対策講座", url: "https://www.i-think.co.jp/open-seminar/acquisition-online/", beginner_friendly: true, categories: [PM], status: "active" },
  { id: "trainocate", name: "トレノケート", url: "https://www.trainocate.co.jp/", beginner_friendly: true, categories: [PM], status: "active" },
  { id: "i-learning", name: "アイ・ラーニング", url: "https://www.i-learning.jp/", beginner_friendly: true, categories: [PM], status: "active" },
  { id: "edifist", name: "エディフィストラーニング", url: "https://www.edifist.co.jp/", beginner_friendly: true, categories: [PM, ARCH, QA], status: "active" },
  { id: "tokyo-it-school-pm", name: "東京ITスクール", course: "PM&PdM研修", url: "https://tokyoitschool.jp/", beginner_friendly: false, categories: [PM], status: "excluded", note: "法人向け研修で個人は申し込めない" },
  { id: "pm-school", name: "PM School", url: null, beginner_friendly: null, categories: [PDM], status: "unverifiable", note: "LP が 404" },
  { id: "product-institute-japan", name: "Product Institute Japan", url: "https://www.productinstitute-japan.com/", beginner_friendly: null, categories: [PDM], status: "active", note: "未経験向けかどうかを公式サイトで確認できない" },
  { id: "schoo-pm", name: "Schoo", url: "https://schoo.jp/class/2931", beginner_friendly: true, categories: [PDM], status: "active" },
  { id: "tech-camp-pm", name: "テックキャンプ PM講座", url: null, beginner_friendly: null, categories: [PDM], status: "unverifiable", note: "該当講座を公式サイトで確認できない" },
  { id: "casareal", name: "カサレアル", course: "クラウドネイティブ道場", url: "https://learning.casareal.co.jp/search/cloudnative-dojo", beginner_friendly: false, categories: [ARCH, DEVOPS], status: "active" },
  { id: "ctc-education", name: "CTC教育サービス", url: "https://www.school.ctc-g.co.jp/", beginner_friendly: true, categories: [ARCH, DEVOPS], status: "active" },
  { id: "nttdata-intellilink", name: "NTTデータ先端技術", url: "https://academy.intellilink.co.jp/", beginner_friendly: false, categories: [ARCH], status: "active" },
  { id: "hitachi-academy", name: "日立アカデミー", url: "https://www.hitachi-ac.co.jp/", beginner_friendly: true, categories: [ARCH, QA], status: "active" },
  { id: "chaty", name: "CHATY", url: null, beginner_friendly: null, categories: [MOBILE], status: "unverifiable", note: "公式サイトを特定できない" },
  { id: "sasayell", name: "ササエル", url: "https://www.sasa-yell.tech/", beginner_friendly: true, categories: [NW], status: "active" },
  { id: "uzuz-college-ccna", name: "ウズウズカレッジ", course: "CCNA コース（有料）", url: "https://uzuz-college.jp/ccna/", beginner_friendly: true, categories: [NW], status: "active" },
  { id: "uzuz-college-it", name: "ウズカレIT", url: "https://uzuz-college.jp/it-shushoku/", beginner_friendly: true, categories: [NW], status: "active" },
  { id: "jstqb", name: "JSTQB 認定講座", url: "https://www.jstqb.jp/", beginner_friendly: null, categories: [QA], status: "active", note: "資格団体のため講座の対象者は提供事業者ごとに異なる" },
  { id: "devopsschool-jp", name: "DevOpsSchool.jp", url: null, beginner_friendly: null, categories: [DEVOPS], status: "unverifiable", note: "英語サイトのみで日本での提供実態を確認できない" },
  { id: "topout", name: "トップアウト", course: "DevOps 研修", url: "https://www.topout.co.jp/devops/", beginner_friendly: null, categories: [DEVOPS], status: "active", note: "未経験向けかどうかを公式サイトで確認できない" },
  // Added 2026-10-07 from the follow-up research for categories below the learning-stage minimum.
  { id: "ios-academia", name: "iOSアカデミア", url: "https://ios-academia.com/", beginner_friendly: true, categories: [MOBILE], status: "active" },
  { id: "udemy-devops", name: "Udemy", course: "いまからはじめる DevOps 入門講座", url: "https://www.udemy.com/course/getting-started-devops/", beginner_friendly: true, categories: [DEVOPS], status: "active", note: "講座マーケットプレイス。Docker・Kubernetes の初心者向け日本語講座もある" },
  { id: "kodekloud", name: "KodeKloud", course: "DevOps / Site Reliability Engineer Learning Path", url: "https://kodekloud.com/learning-path/devops", beginner_friendly: true, categories: [DEVOPS], status: "active", note: "英語のみ" },
  { id: "microsoft-learn-devops", name: "Microsoft Learn", course: "AZ-400 DevOps ラーニングパス", url: "https://learn.microsoft.com/ja-jp/training/paths/az-400-work-git-for-enterprise-devops/", beginner_friendly: false, categories: [DEVOPS], status: "active", note: "無料。資格試験 AZ-400 向けで上級レベル" },
  { id: "google-sre-coursera", name: "Google Cloud SRE コース（Coursera）", course: "Site Reliability Engineering: Measuring and Managing Reliability", url: "https://cloud.google.com/sre?hl=ja", beginner_friendly: false, categories: [DEVOPS], status: "active", note: "英語のみ・中級" },
  { id: "cloudtech-academy", name: "CloudTech Academy", url: "https://kws-cloud-tech.com/cloudtech-academy-2/", beginner_friendly: true, categories: [CLOUD], status: "active", note: "AWS 特化。転職サービスの「クラウドワークス テック（旧 クラウドテック）」とは別" },
  { id: "network-academy", name: "ネットワークアカデミー", course: "AWS 認定 Solutions Architect - Associate 合格保証コース", url: "https://www.networkacademy.jp/aws-couse", beginner_friendly: true, categories: [CLOUD], status: "active" },
];

const SERVICES = [
  { id: "levtech-career", name: "レバテックキャリア", url: "https://career.levtech.jp/", novice_support: true, freelance_available: false, categories: [FE, BE, FS, DA, DS, DE, PM, ARCH, MOBILE, NW, QA, DEVOPS, CLOUD], status: "active" },
  { id: "paiza-career", name: "paiza転職", url: "https://paiza.jp/career", novice_support: false, freelance_available: false, categories: [FE, DA], status: "active" },
  { id: "green", name: "Green", url: "https://www.green-japan.com/", novice_support: true, freelance_available: true, categories: [FE, FS, MOBILE], status: "active" },
  { id: "mynavi-it-agent", name: "マイナビ転職 IT AGENT", url: "https://mynavi-agent.jp/it/", novice_support: true, freelance_available: null, categories: [BE, DA, DS, DE, PDM, NW], status: "active" },
  { id: "tech-go", name: "テックゴー", url: "https://tech-go.jp/", novice_support: null, freelance_available: null, categories: [BE, DS, PDM, ARCH, QA, DEVOPS], status: "active" },
  { id: "workport", name: "ワークポート", url: "https://www.workport.co.jp/", novice_support: true, freelance_available: null, categories: [FS], status: "active" },
  { id: "geekly", name: "Geekly", url: "https://www.geekly.co.jp/", novice_support: true, freelance_available: null, categories: [DA, DS, PM, PDM], status: "active" },
  { id: "type-it-agent", name: "type転職エージェント IT", url: "https://type.career-agent.jp/service/it.html", novice_support: true, freelance_available: false, categories: [DA, DS, CLOUD], status: "active" },
  { id: "webist", name: "Webist", url: "https://webist-cri.com/", novice_support: true, freelance_available: true, categories: [DA], status: "active" },
  { id: "kikkake-agent", name: "キッカケエージェント", url: "https://kikkakeagent.co.jp/", novice_support: false, freelance_available: null, categories: [DA, PDM], status: "active" },
  { id: "job-draft", name: "転職ドラフト", url: "https://job-draft.jp/", novice_support: null, freelance_available: true, categories: [DA], status: "active" },
  { id: "symbiorise", name: "Symbiorise", url: "https://symbiorise.com/", novice_support: true, freelance_available: null, categories: [DS, DE], status: "active" },
  { id: "ds-tenshoku-navi", name: "データサイエンティスト転職ナビ", url: null, novice_support: null, freelance_available: null, categories: [DS], status: "unverifiable", note: "公式サイトを特定できない" },
  { id: "unison-career", name: "ユニゾンキャリア", url: "https://unison-career.jp/", novice_support: true, freelance_available: null, categories: [DS], status: "active" },
  { id: "techclips-agent", name: "TechClipsエージェント", url: "https://agent.tech-clips.com/", novice_support: null, freelance_available: null, categories: [DS], status: "active" },
  { id: "findy", name: "Findy", url: "https://findy-code.io/", novice_support: null, freelance_available: false, categories: [DS, DE, PDM, DEVOPS], status: "active" },
  { id: "direct-type", name: "Direct type", url: "https://directtype.jp/", novice_support: null, freelance_available: null, categories: [DS], status: "active" },
  { id: "forkwell", name: "Forkwell Jobs", url: "https://jobs.forkwell.com/", novice_support: true, freelance_available: true, categories: [DS, DEVOPS], status: "active" },
  { id: "lapras", name: "LAPRAS", url: "https://lapras.com/", novice_support: true, freelance_available: true, categories: [DE], status: "active" },
  { id: "recruit-agent", name: "リクルートエージェント", url: "https://www.r-agent.com/", novice_support: true, freelance_available: false, categories: [PM, NW], status: "active" },
  { id: "offers", name: "Offers", url: "https://offers.jp/", novice_support: null, freelance_available: true, categories: [PDM, MOBILE], status: "active" },
  { id: "bizreach", name: "ビズリーチ", url: "https://www.bizreach.jp/", novice_support: null, freelance_available: null, categories: [ARCH], status: "active" },
  { id: "levtech-freelance", name: "レバテックフリーランス", url: "https://freelance.levtech.jp/", novice_support: false, freelance_available: true, categories: [NW, DEVOPS, CLOUD], status: "active" },
  { id: "foster-freelance", name: "フォスターフリーランス", url: "https://freelance.fosternet.jp/", novice_support: null, freelance_available: true, categories: [NW, CLOUD], status: "active" },
  { id: "xnetwork", name: "クロスネットワーク", url: "https://www.xnetwork.jp/", novice_support: null, freelance_available: true, categories: [NW, CLOUD], status: "active" },
  { id: "levtech-direct", name: "レバテックダイレクト", url: "https://levtech-direct.jp/", novice_support: null, freelance_available: false, categories: [QA], status: "active" },
  { id: "crowdworks-tech", name: "クラウドワークス テック（旧 クラウドテック）", url: "https://tech.crowdworks.jp/", novice_support: false, freelance_available: true, categories: [DEVOPS, CLOUD], status: "active" },
  { id: "midworks", name: "Midworks", url: "https://mid-works.com/", novice_support: null, freelance_available: true, categories: [CLOUD], status: "active" },
  { id: "pe-bank", name: "PE-BANK", url: "https://pe-bank.jp/", novice_support: false, freelance_available: true, categories: [CLOUD], status: "active" },
  { id: "pasona-career", name: "パソナキャリア", url: "https://www.pasonacareer.jp/", novice_support: true, freelance_available: null, categories: [CLOUD], status: "active" },
  { id: "solution-partner", name: "ソリューションパートナー", url: "https://sol-partner.co.jp/", novice_support: true, freelance_available: false, categories: [CLOUD], status: "active" },
  { id: "myvision", name: "MyVision", url: "https://my-vision.co.jp/", novice_support: true, freelance_available: null, categories: [PDM], status: "active", note: "コンサル転職特化（テックゴーの運営会社）。未経験の支援は「コンサル未経験」を指す" },
];

function schoolEntry(school, category) {
  return {
    id: school.id,
    name: school.name,
    ...(school.course ? { course: school.course } : {}),
    url: school.url,
    beginner_friendly: school.beginner_friendly,
    job_category_matched: school.categories.includes(category),
  };
}

function serviceEntry(service, category) {
  return {
    id: service.id,
    name: service.name,
    url: service.url,
    novice_support: service.novice_support,
    freelance_available: service.freelance_available,
    job_category_matched: service.categories.includes(category),
  };
}

const activeSchools = SCHOOLS.filter((s) => s.status === "active");
const activeServices = SERVICES.filter((s) => s.status === "active");

const mapping = {};
for (const category of JOB_CATEGORIES) {
  const schools = activeSchools.filter((s) => s.categories.includes(category));
  const services = activeServices.filter((s) => s.categories.includes(category));
  const freelance = [
    ...services.filter((s) => s.freelance_available === true),
    ...activeServices.filter((s) => s.freelance_available === true && !s.categories.includes(category)),
  ];

  mapping[category] = {
    learning: {
      schools: schools.filter((s) => s.beginner_friendly === true).map((s) => schoolEntry(s, category)),
      services: services.filter((s) => s.novice_support === true).map((s) => serviceEntry(s, category)),
    },
    ready: {
      services: services.map((s) => serviceEntry(s, category)),
      schools: schools.map((s) => schoolEntry(s, category)),
    },
    experienced: {
      services: services.filter((s) => s.freelance_available !== true).map((s) => serviceEntry(s, category)),
      schools: schools.map((s) => schoolEntry(s, category)),
      freelance: freelance.map((s) => serviceEntry(s, category)),
    },
  };
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "src", "lib", "learning-path-services-mapping.json");
writeFileSync(output, `${JSON.stringify(mapping, null, 2)}\n`, "utf8");

if (process.argv.includes("--report")) {
  const rows = [];
  for (const category of JOB_CATEGORIES) {
    const m = mapping[category];
    rows.push(
      `| ${category} | ${m.learning.schools.length} | ${m.learning.services.length} | ${m.ready.services.length} | ${m.ready.schools.length} | ${m.experienced.services.length} | ${m.experienced.freelance.length} |`,
    );
  }
  console.log(rows.join("\n"));
  console.log("\nschools");
  for (const s of SCHOOLS) {
    console.log(`| ${s.name}${s.course ? `（${s.course}）` : ""} | ${s.status} | ${s.beginner_friendly} | ${s.categories.join("、")} | ${s.url ?? "—"} | ${s.note ?? ""} |`);
  }
  console.log("\nservices");
  for (const s of SERVICES) {
    console.log(`| ${s.name} | ${s.status} | ${s.novice_support} | ${s.freelance_available} | ${s.categories.join("、")} | ${s.url ?? "—"} | ${s.note ?? ""} |`);
  }
  console.log(`\nchecked_at ${CHECKED_AT}`);
}
