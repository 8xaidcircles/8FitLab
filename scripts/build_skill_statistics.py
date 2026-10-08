"""技術スキルの Skill Statistics（試算）を Stack Overflow Developer Survey 2023〜2025 から事前計算する。

入力: data/raw/stackoverflow/{year}/results.csv（https://github.com/StackExchange/Survey の archive）
      data/skills/so-devtype-mapping.json（Goal → 年別 DevType）
      data/skills/tech-skills.json（技術スキル辞書。調査の選択肢名 → skill_id・表示名・カテゴリ。
      採用された技術とグループのメンバーは必ず辞書に載っている必要がある）
      data/skills/tech-skill-groups.json（代わりのきく技術のグループ）
出力: data/statistics/skill-match/{goal_id}.json

評価単位（unit）:
  - グループ = 代わりのきく技術の集まり（例: Laravel / Rails / Spring Boot …）。どれか 1 つを使えば満たす。
    goals があるグループはその Goal でだけグループとして扱い、それ以外の Goal ではメンバーを個別の技術として扱う
  - 技術 = どのグループにも入らない（またはその Goal でグループが使われない）技術

計算（unit ごと）:
  - 母集団 = 年ごとの回答者のうち DevType があり、Student / Retired / Other 以外の人
  - Goal = その年の Goal の DevType、Other = それ以外
  - 分母 = unit の設問（Language / Webframe など。グループはメンバーの設問のどれか）に回答した人
  - 利用者 = 技術を使った人（グループはメンバーのどれか 1 つ以上を使った人）
  - 「選択肢として存在した最新年」を使う。その年の Goal の回答者が MIN_RELIABLE_SAMPLE 未満なら、
    選択肢が存在した全年を合算する。グループはその年に存在したメンバーだけで計算する
  - 日本補正: 日本の回答者は Goal ごとに数十〜数百人と少ないため、日本の利用率を世界の利用率へ縮小推定する
    （経験ベイズ、Beta-Binomial）。p_JP = (u_JP + k × p_世界) / (n_JP + k)。
    k は全 Goal × 技術の「日本と世界の差のばらつき」からモーメント法で推定し、人は決めない。
    日本の回答は人数が少ないため、選択肢が存在した全年を常に合算する。
    事前分布の平均（世界の率）は上記の「最新年（足りなければ合算）」の値なので、世界と日本で対象年がずれることがある。
    年による選択肢・回答傾向の差は k の推定（日本と世界の差のばらつき）に含まれる。仕様として許容する
  - Quantity = p_JP(unit | Goal)、Quality = p_JP(unit | Goal) / (p_JP(unit | Goal) + p_JP(unit | Other)) × 100、
    Contribution = Quantity × Quality / 100（Experience と同じ）
  - 開発環境（エディタ・IDE）は dev_env_allowlist にあるものだけ残す
  - グループのメンバーは日本補正後の P(技術 | Goal) の大きい順に並べる（表示順。採用には使わない）

Goal Skill の採用（selected = 基本リスト or 特有リスト。1 つの unit が両方に入ってよい）:
  pg = 日本補正後の P(unit | Goal)、po = 日本補正後の P(unit | Other)、d = max(0, (pg − po) / (pg + po))
  - 技術スキル辞書（tech-skills.json）を許可リストとして扱い、辞書に無い技術はどちらのリストにも入れない
    （除外した技術は標準出力に出す。統計が辞書の外に出ないようにする）
  - 基本リスト（roles に "base"）: pg ≥ BASE_MIN_SHARE（その職種の過半数が使う）。
    基本の重み base_weight = pg × min(1, d / d*)。他職種と同じくらい使われる技術（d が小さい）ほど割り引き、d = 0 なら入れない。
    d* = 「有意（下記の特有リストの第 1 段階）と判定される確率が 50% になる d」。14 Goal すべての基本リストの候補
    （辞書にあり pg ≥ BASE_MIN_SHARE）の (d, significant) に significant ~ d のロジスティック回帰を当てはめ、d* = −b0 / b1。
    人は d* を決めない。推定できない（候補が少ない・片方のクラスしか無い・完全分離・収束しない・b1 ≤ 0・d* が正の有限値でない）
    ときは止める。推定は d と significant だけを使い base_weight を使わないため循環しない
  - 特有リスト（roles に "distinctive"）: 世界の P(unit | Goal) > P(unit | Other) が有意（片側 2 標本比率の z 検定、
    Goal 内の unit 数で Bonferroni 補正、α = 0.05。標本の大きい世界全体で判定する）かつ d > 0。
    特有の重み distinctive_weight = pg × d
  - Goal ごとに base_total = Σ base_weight、distinctive_total = Σ distinctive_weight（skill_split）
  - 2 つのリストの重みの割合 β（selection.distinctive_share）= Σ distinctive_total / Σ (base_total + distinctive_total)。
    技術スキル層の配分が 0 より大きい Goal（data/skills/goal-skill-layers.json）だけを合算し、全 Goal に同じ値を書く
  - 有意性の判定と警告は丸める前の p 値を使い、JSON の p_value だけ有効数字 3 桁に丸める
  - 重みは小数 6 桁に丸め、丸めた重みが 0 より大きいときだけそのリストの role を付ける（role があるのに重み 0 の unit を作らない）
  - Quantity / Quality / Contribution は参考値として残す（採点には使わない。採点コード（src/lib/career-match/skill-score.ts）は
    base_weight・distinctive_weight と β で技術スキル層の達成率を計算する）

バージョン:
  - 0.6.0: 基本リスト・特有リストを導入（採点コードはまだ contribution を使っていた）
  - 0.7.0: 採点コードが base_weight・distinctive_weight・β を使う前提のスキーマ。p 値の丸めと重み 0 の role を修正
  - 0.8.0: 基本リストの重みを pg × min(1, d / d*) に変更し、d* をデータから推定する（selection.base_discount_d_ref）

実行: python scripts/build_skill_statistics.py
"""

import json
import math
import re
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import norm

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "stackoverflow"
MAPPING_PATH = ROOT / "data" / "skills" / "so-devtype-mapping.json"
DICTIONARY_PATH = ROOT / "data" / "skills" / "tech-skills.json"
GROUPS_PATH = ROOT / "data" / "skills" / "tech-skill-groups.json"
LAYERS_PATH = ROOT / "data" / "skills" / "goal-skill-layers.json"
OUT_DIR = ROOT / "data" / "statistics" / "skill-match"

CALCULATION_VERSION = "0.8.0"
# 出力は Stack Overflow Developer Survey（ODbL）の派生データベースのため、同じ ODbL で提供する（ODbL 4.4）
DERIVED_DATABASE_LICENSE = {
    "name": "Open Database License (ODbL) v1.0",
    "url": "https://opendatacommons.org/licenses/odbl/1-0/",
    "contents_license": "Database Contents License (DbCL) v1.0",
    "contents_url": "https://opendatacommons.org/licenses/dbcl/1-0/",
    "attribution": "Contains information from the Stack Overflow Developer Survey "
    "(https://survey.stackoverflow.co/), which is made available under the Open Database License (ODbL).",
    "modifications": "8FitLab aggregated the survey responses by Goal and adjusted them to the Japanese market "
    "(empirical Bayes shrinkage). Method: scripts/build_skill_statistics.py",
}
REGION_COUNTRY = "Japan"
MIN_RELIABLE_SAMPLE = 100
ALPHA = 0.05
# 基本リストの線引き（人が決める値）: 日本補正後の P(unit | Goal) がこの値以上なら「その職種の過半数が使う技術」
BASE_MIN_SHARE = 0.5
# 警告を出す範囲（JSON には入れない）: p 値がしきい値のこの倍率の範囲、pg が基本の線引きのこの範囲
P_VALUE_WARNING_RATIO = (0.1, 10)
BASE_WARNING_RANGE = (0.45, 0.55)
# 日本補正の τ = 1 / (k + 1) の範囲。下限 0.001 は k ≈ 999（推定が不安定なときに k が発散しないための安全網）
TAU_MIN = 0.001
TAU_MAX = 1.0
# d* の推定に使う基本リストの候補の下限件数（これ未満では回帰が不安定なため止める）
D_REF_MIN_UNITS = 30
# d* の推定の診断（標準出力のみ。JSON には入れない）: ブートストラップの回数と乱数の種（再生成のたびに同じ値を出す）
D_REF_BOOTSTRAP = 500
D_REF_BOOTSTRAP_SEED = 0
SCOPES = ("world", "region")

# 年ごとの技術スキルの設問（HaveWorkedWith 列） → カテゴリ
QUESTIONS = {
    2025: {
        "LanguageHaveWorkedWith": "language",
        "WebframeHaveWorkedWith": "framework",
        "DatabaseHaveWorkedWith": "database",
        "PlatformHaveWorkedWith": "platform",
        "DevEnvsHaveWorkedWith": "dev_env",
    },
    2024: {
        "LanguageHaveWorkedWith": "language",
        "WebframeHaveWorkedWith": "framework",
        "DatabaseHaveWorkedWith": "database",
        "PlatformHaveWorkedWith": "platform",
        "ToolsTechHaveWorkedWith": "tool",
        "MiscTechHaveWorkedWith": "library",
        "NEWCollabToolsHaveWorkedWith": "dev_env",
    },
    2023: {
        "LanguageHaveWorkedWith": "language",
        "WebframeHaveWorkedWith": "framework",
        "DatabaseHaveWorkedWith": "database",
        "PlatformHaveWorkedWith": "platform",
        "ToolsTechHaveWorkedWith": "tool",
        "MiscTechHaveWorkedWith": "library",
        "NEWCollabToolsHaveWorkedWith": "dev_env",
    },
}


def slugify(name: str) -> str:
    slug = name.lower().replace("c#", "csharp").replace("c++", "cpp").replace("f#", "fsharp").replace(".net", "dotnet")
    return re.sub(r"[^a-z0-9]+", "-", slug).strip("-")


def one_sided_p_value(u_goal: int, n_goal: int, u_other: int, n_other: int) -> float:
    """H1: P(unit | Goal) > P(unit | Other) の 2 標本比率 z 検定（プールした比率で標準誤差）。"""
    pooled = (u_goal + u_other) / (n_goal + n_other)
    se = np.sqrt(pooled * (1 - pooled) * (1 / n_goal + 1 / n_other))
    if se == 0:
        return 1.0
    return float(norm.sf((u_goal / n_goal - u_other / n_other) / se))


def significance_threshold(rows: list) -> float:
    return ALPHA / len(rows) if rows else ALPHA


def distinctiveness(pg: float, po: float) -> float:
    """d = max(0, (pg − po) / (pg + po))。Goal 側で多いほど 1 に近づき、Other と同じか少なければ 0。"""
    return max(0.0, (pg - po) / (pg + po)) if pg + po > 0 else 0.0


def mark_significance(rows: list) -> None:
    """第 1 段階: 1 つの Goal の行に significant を付ける（丸める前の p 値 _p と、Goal 内の行数で補正したしきい値）。

    技術スキル辞書に無い技術も有意性のしきい値の行数に含める（第 1 段階の判定は辞書と無関係）。
    """
    threshold = significance_threshold(rows)
    for r in rows:
        r["significant"] = r["_p"] < threshold


def is_base_candidate(r: dict) -> bool:
    return r["in_dictionary"] and r["_pg"] >= BASE_MIN_SHARE


def assign_roles(rows: list, d_ref: float) -> None:
    """基本リスト（過半数が使う）と特有リスト（有意に Goal 側で多い）の役割と重みを付け、どちらかに入れば selected にする。

    rows の pg・po・p 値は丸める前の値（_pg・_po・_p）を使う。
    技術スキル辞書に無い技術はどちらのリストにも入れない（入力画面で選べない技術を分母に入れないため）。
    基本の重みは pg × min(1, d / d_ref)（d_ref は estimate_base_discount_d_ref で全 Goal から推定した d*）。
    重みは丸めた値が 0 より大きいときだけ role を付ける。
    """
    if not (math.isfinite(d_ref) and d_ref > 0):
        raise ValueError(f"d_ref must be a positive finite number: {d_ref}")
    mark_significance(rows)
    for r in rows:
        pg, po = r["_pg"], r["_po"]
        d = distinctiveness(pg, po)
        base_weight = round(pg * min(1.0, d / d_ref), 6) if is_base_candidate(r) else 0
        distinctive_weight = round(pg * d, 6) if r["in_dictionary"] and r["significant"] and d > 0 else 0
        r["roles"] = [role for role, weight in (("base", base_weight), ("distinctive", distinctive_weight)) if weight > 0]
        r["base_weight"] = base_weight
        r["distinctive_weight"] = distinctive_weight
        r["selected"] = bool(r["roles"])


def fit_logistic(d: np.ndarray, y: np.ndarray, max_iter: int = 100, tol: float = 1e-10) -> tuple:
    """significant ~ d のロジスティック回帰（IRLS / ニュートン法）。(b0, b1) を返し、収束しなければ None。"""
    x = np.column_stack([np.ones_like(d), d])
    beta = np.zeros(2)
    for _ in range(max_iter):
        p = 1 / (1 + np.exp(-(x @ beta)))
        w = p * (1 - p)
        hessian = x.T @ (x * w[:, None])
        if not np.all(np.isfinite(hessian)) or np.linalg.cond(hessian) > 1e12:
            return None
        step = np.linalg.solve(hessian, x.T @ (y - p))
        beta = beta + step
        if not np.all(np.isfinite(beta)):
            return None
        if np.max(np.abs(step)) < tol:
            return float(beta[0]), float(beta[1])
    return None


def logistic_p50(points: list) -> float:
    """(d, significant) の組から d* = −b0 / b1 を推定する。推定できなければ ValueError（理由つき）。"""
    if len(points) < D_REF_MIN_UNITS:
        raise ValueError(f"基本リストの候補が {len(points)} 件で、下限 {D_REF_MIN_UNITS} 件に足りません")
    d = np.array([p[0] for p in points], dtype=float)
    y = np.array([1.0 if p[1] else 0.0 for p in points])
    n_significant = int(y.sum())
    if n_significant == 0 or n_significant == len(y):
        raise ValueError(f"有意な候補 {n_significant} 件・有意でない候補 {len(y) - n_significant} 件で、片方が 0 件です")
    # 完全分離（有意でない候補の d がすべて有意な候補の d より小さい、またはその逆）では係数が発散する
    if d[y == 0].max() < d[y == 1].min() or d[y == 1].max() < d[y == 0].min():
        raise ValueError("有意な候補と有意でない候補が d で完全に分かれていて、係数が発散します")
    fitted = fit_logistic(d, y)
    if fitted is None:
        raise ValueError("ロジスティック回帰が収束しません")
    b0, b1 = fitted
    if b1 <= 0:
        raise ValueError(f"b1 = {b1:.4g} ≤ 0（d が大きいほど有意になりにくい）で、意味が逆です")
    d_ref = -b0 / b1
    if not (math.isfinite(d_ref) and d_ref > 0):
        raise ValueError(f"d* = {d_ref:.4g} が正の有限値ではありません")
    return d_ref


def base_candidates(goal_rows: dict) -> list:
    """全 Goal の基本リストの候補の (d, significant, goal_id)。d = 0 の候補も含める。"""
    return [
        (distinctiveness(r["_pg"], r["_po"]), r["significant"], goal_id)
        for goal_id, rows in goal_rows.items()
        for r in rows
        if is_base_candidate(r)
    ]


def estimate_base_discount_d_ref(candidates: list) -> float:
    """基本リストの重みの割り引きの基準 d*（有意と判定される確率が 50% になる d）。推定できなければ止める。"""
    try:
        return logistic_p50([(d, significant) for d, significant, _ in candidates])
    except ValueError as error:
        raise SystemExit(f"d*（base_discount_d_ref）を推定できません: {error}") from error


def d_ref_diagnostics(candidates: list) -> dict:
    """d* の推定の診断（標準出力用）: ブートストラップ 90% 区間、1 Goal 除外の範囲、補助指標。"""
    points = [(d, significant) for d, significant, _ in candidates]
    rng = np.random.default_rng(D_REF_BOOTSTRAP_SEED)
    boot, failed = [], 0
    for _ in range(D_REF_BOOTSTRAP):
        sample = [points[i] for i in rng.integers(0, len(points), len(points))]
        try:
            boot.append(logistic_p50(sample))
        except ValueError:
            failed += 1
    leave_one_out = {}
    for goal_id in sorted({g for _, _, g in candidates}):
        try:
            leave_one_out[goal_id] = logistic_p50([(d, s) for d, s, g in candidates if g != goal_id])
        except ValueError:
            leave_one_out[goal_id] = None
    d = np.array([p[0] for p in points])
    y = np.array([p[1] for p in points])
    # 有意かどうかを最もよく分ける d（d 以上を有意と予測したときの正解率が最大になる境目。同率なら小さいほう）
    cuts = np.unique(d)
    accuracy = [np.mean((d >= c) == y) for c in cuts]
    return {
        "bootstrap_90": (float(np.percentile(boot, 5)), float(np.percentile(boot, 95))) if boot else None,
        "bootstrap_failed": failed,
        "leave_one_out": leave_one_out,
        "best_split_d": float(cuts[int(np.argmax(accuracy))]),
        "nonsignificant_d_p90": float(np.percentile(d[~y], 90)),
        "candidate_d_median": float(np.median(d)),
    }


def print_d_ref_diagnostics(d_ref: float, candidates: list) -> None:
    diag = d_ref_diagnostics(candidates)
    n_significant = sum(1 for _, s, _ in candidates if s)
    print(f"\nbase_discount_d_ref (d*) = {d_ref:.4f}  units = {len(candidates)} (significant {n_significant}, not {len(candidates) - n_significant})")
    if diag["bootstrap_90"]:
        low, high = diag["bootstrap_90"]
        print(f"  bootstrap 90%: {low:.4f} - {high:.4f}  ({D_REF_BOOTSTRAP} resamples, seed {D_REF_BOOTSTRAP_SEED}, failed {diag['bootstrap_failed']})")
    loo = {g: v for g, v in diag["leave_one_out"].items() if v is not None}
    if loo:
        most = max(loo, key=lambda g: abs(loo[g] - d_ref))
        print(f"  leave-one-goal-out: {min(loo.values()):.4f} - {max(loo.values()):.4f}  (most influential: {most} -> {loo[most]:.4f})")
    failed_goals = [g for g, v in diag["leave_one_out"].items() if v is None]
    if failed_goals:
        print(f"  leave-one-goal-out failed: {', '.join(failed_goals)}")
    print(
        f"  best split d = {diag['best_split_d']:.4f}  non-significant d p90 = {diag['nonsignificant_d_p90']:.4f}"
        f"  candidate d median = {diag['candidate_d_median']:.4f}"
    )


def skill_split(rows: list) -> dict:
    return {
        "base_total": round(sum(r["base_weight"] for r in rows), 6),
        "distinctive_total": round(sum(r["distinctive_weight"] for r in rows), 6),
    }


def tech_layer_goals() -> list:
    """技術スキル層の配分が 0 より大きい Goal（goal.layer_weights?.tech ?? default_layer_weights.tech）。"""
    layers = json.loads(LAYERS_PATH.read_text(encoding="utf-8"))
    default_tech = layers["default_layer_weights"]["tech"]
    return [g["goal_id"] for g in layers["goals"] if (g.get("layer_weights") or {}).get("tech", default_tech) > 0]


def distinctive_share(splits: dict, goal_ids: list) -> float:
    """β = Σ distinctive_total / Σ (base_total + distinctive_total)（goal_ids の Goal だけを合算）。"""
    distinctive = sum(splits[g]["distinctive_total"] for g in goal_ids if g in splits)
    total = sum(splits[g]["base_total"] + splits[g]["distinctive_total"] for g in goal_ids if g in splits)
    if total <= 0:
        raise SystemExit("distinctive_share を計算できません（技術スキル層を使う Goal の重みの合計が 0）")
    return distinctive / total


def warn_borderline(goal_id: str, rows: list) -> None:
    """判定の境目に近い unit を標準出力に出す（JSON には入れない）。"""
    threshold = significance_threshold(rows)
    low, high = P_VALUE_WARNING_RATIO
    near_p = [r for r in rows if threshold * low <= r["_p"] <= threshold * high]
    near_base = [r for r in rows if BASE_WARNING_RANGE[0] <= r["_pg"] <= BASE_WARNING_RANGE[1]]
    for r in near_p:
        print(f"  [Warning] {goal_id}: {r['unit_id']} の p 値 {r['_p']:.3g} がしきい値 {threshold:.3g} の {low}〜{high} 倍")
    for r in near_base:
        print(f"  [Warning] {goal_id}: {r['unit_id']} の pg {r['_pg']:.3f} が基本の線引き {BASE_MIN_SHARE} の近く")


def estimate_prior_strength(pairs: list) -> float:
    """日本の比率を世界の比率へ縮小する事前分布の強さ k（Beta-Binomial のモーメント法）。

    pairs = [(u_JP, n_JP, p_世界)]。真の日本の比率 θ ~ Beta(平均 p, 精度 k) とおくと
    E[n (x − p)² / (p (1 − p))] = n τ + (1 − τ)、τ = 1 / (k + 1)。これを n で重み付けして解く。
    """
    numerator = denominator = 0.0
    for u, n, p in pairs:
        if n < 2 or p <= 0 or p >= 1:
            continue
        numerator += n * (u / n - p) ** 2 / (p * (1 - p)) - 1
        denominator += n - 1
    # 推定に使える組が無いときに固定値へ逃がすと「人が決めた k」になるため、止めて原因を直す
    if denominator <= 0 or not math.isfinite(numerator):
        raise ValueError("prior strength k cannot be estimated: no (Goal, technology) pair with n_JP >= 2 and 0 < p < 1")
    raw_tau = numerator / denominator
    # τ ≤ 0（日本と世界の差が二項分布の誤差より小さい）では k が発散し、日本の回答を事実上無視することになる。
    # 下限で k を約 999 に抑え、上限（τ = 1 → k = 0、縮小なし）とともに、張り付いたら警告してデータを確かめる
    tau = min(max(raw_tau, TAU_MIN), TAU_MAX)
    k = 1 / tau - 1
    if raw_tau <= TAU_MIN:
        print(
            f"  [Warning] prior strength k reached the upper bound (k = {k:.0f}, raw tau = {raw_tau:.6g}): "
            "Japan responses are almost fully shrunk to world rates. Check the sample variance."
        )
    elif raw_tau >= TAU_MAX:
        print(
            f"  [Warning] prior strength k reached the lower bound (k = 0, raw tau = {raw_tau:.6g}): "
            "Japan rates are used without shrinkage. Check the sample variance."
        )
    return k


def shrink(u: int, n: int, prior_mean: float, k: float) -> float:
    # k = 0（τ が上限に張り付き縮小なし）かつ日本の回答者 0 人では日本の情報が無いため、世界の率を使う
    if n + k <= 0:
        return prior_mean
    return (u + k * prior_mean) / (n + k)


def load_year(year: int, excluded: set, aliases: dict) -> tuple:
    """(回答者 Series[ResponseId → DevType], 回答 long DataFrame[ResponseId, question, item, region])。"""
    questions = QUESTIONS[year]
    df = pd.read_csv(
        RAW_DIR / str(year) / "results.csv",
        usecols=["ResponseId", "DevType", "Country", *questions],
        low_memory=False,
    )
    df = df[df.DevType.notna() & ~df.DevType.isin(excluded)]
    long = (
        df.melt(id_vars=["ResponseId"], value_vars=list(questions), var_name="question", value_name="items")
        .dropna(subset=["items"])
        .assign(item=lambda d: d["items"].str.split(";"))
        .explode("item")
        .drop(columns="items")
    )
    long["item"] = long.item.str.strip().replace(aliases)
    long = long.drop_duplicates(["ResponseId", "question", "item"])
    long["region"] = long.ResponseId.isin(set(df.ResponseId[df.Country == REGION_COUNTRY]))
    return df.set_index("ResponseId").DevType, long


def load_groups(dictionary_by_id: dict, dev_env_allowlist: set) -> list:
    """グループ定義を読み、メンバーの検査をして so_items（グループの利用者を数える選択肢）を付ける。

    グループの利用者は so_items 全体で数え、メンバー一覧は dev_env_allowlist を通った選択肢だけを載せる。
    両者が食い違うと「統計上は満たすのに入力画面で選べない」メンバーができるため、
    開発環境（category = dev_env）のメンバーの選択肢はすべて許可リストにあることを求める。
    """
    groups = json.loads(GROUPS_PATH.read_text(encoding="utf-8"))["groups"]
    seen = {}
    for group in groups:
        for skill_id in group["members"]:
            if skill_id not in dictionary_by_id:
                raise SystemExit(f"{group['group_id']}: メンバー {skill_id} が {DICTIONARY_PATH.name} にありません")
            entry = dictionary_by_id[skill_id]
            outside = [item for item in entry["so_items"] if entry.get("category") == "dev_env" and item not in dev_env_allowlist]
            if outside:
                raise SystemExit(
                    f"{group['group_id']}: メンバー {skill_id} の開発環境 {', '.join(outside)} が dev_env_allowlist にありません"
                )
            # 同じ技術を複数のグループに入れてよいのは、どちらも goals があり、goals が重ならない場合だけ
            for other in seen.get(skill_id, []):
                if "goals" not in group or "goals" not in other or set(group["goals"]) & set(other["goals"]):
                    raise SystemExit(f"{skill_id} が {other['group_id']} と {group['group_id']} の両方に入っています（同じ Goal で使われます）")
            seen.setdefault(skill_id, []).append(group)
        group["so_items"] = {item for skill_id in group["members"] for item in dictionary_by_id[skill_id]["so_items"]}
    return groups


def main() -> None:
    mapping = json.loads(MAPPING_PATH.read_text(encoding="utf-8"))
    excluded = set(mapping["population_excluded_devtypes"])
    aliases = mapping["item_aliases"]
    dev_env_allowlist = set(mapping["dev_env_allowlist"])
    dictionary_skills = json.loads(DICTIONARY_PATH.read_text(encoding="utf-8"))["skills"]
    dictionary = {so_item: skill for skill in dictionary_skills for so_item in skill["so_items"]}
    dictionary_by_id = {skill["skill_id"]: skill for skill in dictionary_skills}
    groups = load_groups(dictionary_by_id, dev_env_allowlist)

    devtype, answers = {}, {}
    for year in mapping["years"]:
        devtype[year], answers[year] = load_year(year, excluded, aliases)

    # unit（("skill", 選択肢名) / ("group", group_id)）ごと・年ごと・範囲（世界 / 日本）ごとに、
    # 設問の回答者と利用者の DevType の件数
    unit_years, item_category = {}, {}
    respondents, users = {}, {}

    def record(year: int, unit: tuple, respondent_rows: pd.DataFrame, user_rows: pd.DataFrame) -> None:
        unit_years.setdefault(unit, set()).add(year)
        for scope in SCOPES:
            pick = (lambda d: d[d.region]) if scope == "region" else (lambda d: d)
            respondents[(year, unit, scope)] = devtype[year].loc[pick(respondent_rows).ResponseId.unique()].value_counts()
            users[(year, unit, scope)] = devtype[year].loc[pick(user_rows).ResponseId.unique()].value_counts()

    for year in sorted(mapping["years"]):
        year_answers = answers[year]
        by_question = {question: group for question, group in year_answers.groupby("question")}
        item_questions = {}
        for (question, item), group in year_answers.groupby(["question", "item"]):
            item_category[item] = QUESTIONS[year][question]
            item_questions.setdefault(item, set()).add(question)
            record(year, ("skill", item), by_question[question], group)
        for group in groups:
            present = group["so_items"] & set(item_questions)
            if not present:
                continue
            questions = set().union(*(item_questions[item] for item in present))
            record(
                year,
                ("group", group["group_id"]),
                year_answers[year_answers.question.isin(questions)],
                year_answers[year_answers.item.isin(present)],
            )

    # 1 周目: Goal × unit ごとに世界と日本の件数を集計する
    goal_units, goal_items = {}, {}
    for goal in mapping["goals"]:
        goal_types = {int(y): set(types) for y, types in goal["devtypes"].items()}

        def counts(year: int, unit: tuple, scope: str) -> tuple:
            r, u = respondents[(year, unit, scope)], users[(year, unit, scope)]
            in_goal = lambda s: int(s[s.index.isin(goal_types[year])].sum())
            n_goal, u_goal = in_goal(r), in_goal(u)
            return n_goal, int(r.sum()) - n_goal, u_goal, int(u.sum()) - u_goal

        def pooled_counts(years: list, unit: tuple, scope: str) -> tuple:
            totals = [counts(y, unit, scope) for y in years]
            return tuple(sum(t[i] for t in totals) for i in range(4))

        def unit_stats(unit: tuple):
            available = sorted((y for y in unit_years.get(unit, ()) if goal_types.get(y)), reverse=True)
            if not available:
                return None
            used_years = available[:1]
            world = counts(used_years[0], unit, "world")
            if world[0] < MIN_RELIABLE_SAMPLE and len(available) > 1:
                used_years = available
                world = pooled_counts(available, unit, "world")
            if world[0] == 0 or world[1] == 0:
                return None
            return {
                "unit": unit,
                "used_years": sorted(used_years),
                "world": world,
                "region": pooled_counts(available, unit, "region"),
                "region_years": sorted(available),
            }

        items = {}
        for unit in unit_years:
            kind, item = unit
            if kind != "skill" or (item_category[item] == "dev_env" and item not in dev_env_allowlist):
                continue
            stats = unit_stats(unit)
            if stats:
                items[item] = stats
        goal_items[goal["goal_id"]] = items

        active_groups = [g for g in groups if "goals" not in g or goal["goal_id"] in g["goals"]]
        grouped = set().union(*(g["so_items"] for g in active_groups)) if active_groups else set()
        units = [s for item, s in items.items() if item not in grouped]
        for group in active_groups:
            stats = unit_stats(("group", group["group_id"]))
            if stats:
                units.append({**stats, "group": group})
        goal_units[goal["goal_id"]] = units

    # 日本の比率を世界の比率へ縮小する強さ k を、全 Goal × 技術（Goal 側）から推定する
    prior_strength = estimate_prior_strength([
        (s["region"][2], s["region"][0], s["world"][2] / s["world"][0])
        for items in goal_items.values() for s in items.values()
    ])
    print(f"region={REGION_COUNTRY} prior_strength k={prior_strength:.1f} (tau={1 / (prior_strength + 1):.4f})")

    def rates(stats: dict) -> tuple:
        n_goal, n_other, u_goal, u_other = stats["world"]
        rn_goal, rn_other, ru_goal, ru_other = stats["region"]
        p_goal, p_other = u_goal / n_goal, u_other / n_other
        return p_goal, p_other, shrink(ru_goal, rn_goal, p_goal, prior_strength), shrink(ru_other, rn_other, p_other, prior_strength)

    def member(item: str, stats: dict) -> dict:
        entry = dictionary.get(item)
        p_goal, _, jp_goal, _ = rates(stats)
        return {
            "skill_id": entry["skill_id"] if entry else slugify(item),
            "name": entry["name"] if entry else item,
            "so_item": item,
            "p_skill_given_goal": round(p_goal, 6),
            "region_p_skill_given_goal": round(jp_goal, 6),
        }

    # 2 周目: 日本補正後の Quantity / Quality / Contribution と、基本・特有リストの役割（全 Goal の行を作ってから β を求める）
    goal_rows = {}
    for goal in mapping["goals"]:
        items = goal_items[goal["goal_id"]]
        rows = []
        for stats in goal_units[goal["goal_id"]]:
            n_goal, n_other, u_goal, u_other = stats["world"]
            p_goal, p_other, jp_goal, jp_other = rates(stats)
            quality = jp_goal / (jp_goal + jp_other) * 100 if jp_goal + jp_other > 0 else 0
            p_value = one_sided_p_value(u_goal, n_goal, u_other, n_other)
            group = stats.get("group")
            if group:
                members = sorted(
                    (member(item, items[item]) for item in group["so_items"] if item in items),
                    key=lambda m: (-m["region_p_skill_given_goal"], m["skill_id"]),
                )
                head = {"unit_id": group["group_id"], "type": "group", "name": group["name"], "in_dictionary": True}
            else:
                item = stats["unit"][1]
                entry = dictionary.get(item)
                members = [member(item, stats)]
                head = {
                    "unit_id": members[0]["skill_id"],
                    "type": "skill",
                    "name": members[0]["name"],
                    "category": entry["category"] if entry else item_category[item],
                    "in_dictionary": entry is not None,
                }
            rows.append({
                **head,
                "members": members,
                "source_years": stats["used_years"],
                "goal_respondents": n_goal,
                "other_respondents": n_other,
                "p_skill_given_goal": round(p_goal, 6),
                "p_skill_given_other": round(p_other, 6),
                "region_source_years": stats["region_years"],
                "region_goal_respondents": stats["region"][0],
                "region_other_respondents": stats["region"][1],
                "region_p_skill_given_goal": round(jp_goal, 6),
                "region_p_skill_given_other": round(jp_other, 6),
                "quantity": round(jp_goal, 6),
                "quality": round(quality, 4),
                "contribution": round(jp_goal * quality / 100, 6),
                "p_value": float(f"{p_value:.3g}"),
                "_p": p_value,
                "_pg": jp_goal,
                "_po": jp_other,
            })
        rows.sort(key=lambda r: r["contribution"], reverse=True)
        mark_significance(rows)
        goal_rows[goal["goal_id"]] = rows

    # 基本リストの重みの割り引きの基準 d* を、全 Goal の基本リストの候補から推定する（β と同じく全 Goal の集計後）
    candidates = base_candidates(goal_rows)
    # JSON に書く値（小数 6 桁）で重みを計算し、統計ファイルだけから base_weight を再現できるようにする
    d_ref = round(estimate_base_discount_d_ref(candidates), 6)
    print_d_ref_diagnostics(d_ref, candidates)
    n_candidates_significant = sum(1 for _, significant, _ in candidates if significant)

    for goal_id, rows in goal_rows.items():
        assign_roles(rows, d_ref)
        excluded_units = [
            r["members"][0]["so_item"]
            for r in rows
            if not r["in_dictionary"] and (r["_pg"] >= BASE_MIN_SHARE or (r["significant"] and distinctiveness(r["_pg"], r["_po"]) > 0))
        ]
        if excluded_units:
            print(f"  [Excluded] {goal_id}: {DICTIONARY_PATH.name} に無いため採用しない: {', '.join(excluded_units)}")
        discounted_out = [r["unit_id"] for r in rows if is_base_candidate(r) and r["base_weight"] == 0]
        if discounted_out:
            print(f"  [Discounted-out] {goal_id}: pg >= {BASE_MIN_SHARE} だが他職種との差が無く基本リストに入れない: {', '.join(discounted_out)}")
        warn_borderline(goal_id, rows)
        for r in rows:
            del r["in_dictionary"], r["_p"], r["_pg"], r["_po"]

    splits = {goal_id: skill_split(rows) for goal_id, rows in goal_rows.items()}
    share_goals = [g for g in tech_layer_goals() if g in splits]
    beta = distinctive_share(splits, share_goals)
    groups_version = json.loads(GROUPS_PATH.read_text(encoding="utf-8"))["version"]
    print(f"\ndistinctive_share (beta) = {beta:.4f}  goals = {', '.join(share_goals)}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for goal in mapping["goals"]:
        rows = goal_rows[goal["goal_id"]]
        result = {
            "goal_id": goal["goal_id"],
            "mapping_status": goal["mapping_status"],
            "devtypes": goal["devtypes"],
            "source": mapping["source"],
            "source_years": mapping["years"],
            "license": DERIVED_DATABASE_LICENSE,
            "calculation_version": CALCULATION_VERSION,
            "groups_version": groups_version,
            "calculation_date": date.today().isoformat(),
            "min_reliable_sample": MIN_RELIABLE_SAMPLE,
            "region": {
                "country": REGION_COUNTRY,
                "method": "empirical-bayes-beta-binomial",
                "prior_strength": round(prior_strength, 2),
            },
            "selection": {
                "alpha": ALPHA,
                "correction": "bonferroni",
                "significance_scope": "world",
                "base_min_share": BASE_MIN_SHARE,
                "base_discount_d_ref": d_ref,
                "base_discount_d_ref_method": "logistic-p50",
                "base_discount_d_ref_n_units": len(candidates),
                "base_discount_d_ref_n_significant": n_candidates_significant,
                "distinctive_share": round(beta, 4),
                "distinctive_share_goals": share_goals,
                "weight_scope": "region",
            },
            "skill_split": splits[goal["goal_id"]],
            "units": rows,
        }
        path = OUT_DIR / f"{goal['goal_id']}.json"
        path.write_text(json.dumps(result, ensure_ascii=False, indent=1, allow_nan=False), encoding="utf-8")
        significant = sum(r["significant"] for r in rows)
        selected = [
            (f"[{r['name']}: {' / '.join(m['name'] for m in r['members'][:4])}]" if r["type"] == "group" else r["name"])
            + f" {'+'.join(r['roles'])} b={r['base_weight']:.3f} s={r['distinctive_weight']:.3f}"
            for r in rows
            if r["selected"]
        ]
        split = splits[goal["goal_id"]]
        print(
            f"\n{goal['goal_id']:<22} units={len(rows):>4} significant={significant:>3} selected={len(selected):>3}"
            f" base_total={split['base_total']:.3f} distinctive_total={split['distinctive_total']:.3f}\n  "
            + "\n  ".join(selected)
        )


if __name__ == "__main__":
    main()
