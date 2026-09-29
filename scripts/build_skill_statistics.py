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
    日本の回答は人数が少ないため、選択肢が存在した全年を常に合算する
  - Quantity = p_JP(unit | Goal)、Quality = p_JP(unit | Goal) / (p_JP(unit | Goal) + p_JP(unit | Other)) × 100、
    Contribution = Quantity × Quality / 100（Experience と同じ）
  - 開発環境（エディタ・IDE）は dev_env_allowlist にあるものだけ残す
  - グループのメンバーは日本補正後の P(技術 | Goal) の大きい順に並べる（表示順。採用には使わない）

Goal Skill の採用（selected）:
  1. 世界の P(unit | Goal) > P(unit | Other) が有意（片側 2 標本比率の z 検定、Goal 内の unit 数で Bonferroni 補正、
     α = 0.05）。「その職種を特徴づける技術か」は標本の大きい世界全体で判定する
  2. 1 を満たす unit を日本補正後の Contribution の大きい順に並べ、累積 Contribution が合計の 80% に達するまで

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
OUT_DIR = ROOT / "data" / "statistics" / "skill-match"

CALCULATION_VERSION = "0.3.1"
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
CUMULATIVE_SHARE = 0.8
# 日本補正の τ = 1 / (k + 1) の範囲。下限 0.001 は k ≈ 999（推定が不安定なときに k が発散しないための安全網）
TAU_MIN = 0.001
TAU_MAX = 1.0
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


def select_units(rows: list) -> None:
    """有意に Goal 側で多い unit のうち、累積 Contribution が CUMULATIVE_SHARE に達するまでを selected にする。"""
    threshold = ALPHA / len(rows) if rows else ALPHA
    significant = [r for r in rows if r["p_value"] < threshold]
    total = sum(r["contribution"] for r in significant)
    cumulative = 0.0
    for r in rows:
        r["significant"] = r["p_value"] < threshold
        r["selected"] = False
    for r in significant:
        if cumulative >= total * CUMULATIVE_SHARE:
            break
        r["selected"] = True
        cumulative += r["contribution"]


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


def load_groups(dictionary_by_id: dict) -> list:
    groups = json.loads(GROUPS_PATH.read_text(encoding="utf-8"))["groups"]
    seen = set()
    for group in groups:
        for skill_id in group["members"]:
            if skill_id not in dictionary_by_id:
                raise SystemExit(f"{group['group_id']}: メンバー {skill_id} が {DICTIONARY_PATH.name} にありません")
            if skill_id in seen:
                raise SystemExit(f"{skill_id} が複数のグループに入っています")
            seen.add(skill_id)
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
    groups = load_groups(dictionary_by_id)

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

    # 2 周目: 日本補正後の Quantity / Quality / Contribution と採用
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for goal in mapping["goals"]:
        items = goal_items[goal["goal_id"]]
        rows = []
        for stats in goal_units[goal["goal_id"]]:
            n_goal, n_other, u_goal, u_other = stats["world"]
            p_goal, p_other, jp_goal, jp_other = rates(stats)
            quality = jp_goal / (jp_goal + jp_other) * 100 if jp_goal + jp_other > 0 else 0
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
                "p_value": float(f"{one_sided_p_value(u_goal, n_goal, u_other, n_other):.3g}"),
            })
        rows.sort(key=lambda r: r["contribution"], reverse=True)
        select_units(rows)
        missing = [r["members"][0]["so_item"] for r in rows if r["selected"] and not r["in_dictionary"]]
        if missing:
            raise SystemExit(f"{goal['goal_id']}: 採用された技術が {DICTIONARY_PATH.name} にありません: {missing}")
        for r in rows:
            del r["in_dictionary"]

        result = {
            "goal_id": goal["goal_id"],
            "mapping_status": goal["mapping_status"],
            "devtypes": goal["devtypes"],
            "source": mapping["source"],
            "source_years": mapping["years"],
            "license": DERIVED_DATABASE_LICENSE,
            "calculation_version": CALCULATION_VERSION,
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
                "cumulative_share": CUMULATIVE_SHARE,
                "contribution_scope": "region",
            },
            "units": rows,
        }
        path = OUT_DIR / f"{goal['goal_id']}.json"
        path.write_text(json.dumps(result, ensure_ascii=False, indent=1, allow_nan=False), encoding="utf-8")
        significant = sum(r["significant"] for r in rows)
        selected = [
            f"[{r['name']}: {' / '.join(m['name'] for m in r['members'][:4])}]" if r["type"] == "group" else r["name"]
            for r in rows
            if r["selected"]
        ]
        print(
            f"\n{goal['goal_id']:<22} units={len(rows):>4} significant={significant:>3} selected={len(selected):>3}\n  "
            + "\n  ".join(selected)
        )


if __name__ == "__main__":
    main()
