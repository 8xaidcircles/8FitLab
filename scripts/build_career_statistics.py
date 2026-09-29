"""Career Statistics Master を JobHop v2 から事前計算する（要件定義書 §13〜§19, §26）。

入力: data/raw/jobhop/JobHop_v2_{train,val,test}.parquet（無ければ Hugging Face から取得）
      data/goals/goals.json
出力: data/statistics/career-match/{goal_id}.json

Goal の定義（v2.1）:
  - Goal = Requirement Group の AND。Group 内の職業は OR（どれか 1 つで Group を満たす）
  - Goal Population = 全 Group を満たした人（Education・Sample Size・Confidence に使う）。
    到達時点 = 各 Group の最初の開始日のうち最も遅いもの

Experience（Requirement Group ごとに算出。Experience Match は Group 達成率の平均）:
  - Group Population = その Group の職業に就いた時期（開始日）が分かる人。開始日の無い職歴しか無い人は
    前後を区別できないため、Group / Other のどちらにも入れない
  - Group 側は「最初に Group の職業に就く前」に始めた職歴だけを、就任時点で打ち切って数える。
    Group の職業そのものは Unit に含めない。Other 側は職歴全体を使う
  - Unit = Role × 「Years 年以上」（累積）。ユーザーは自分の年数以下のすべての Unit に該当する
  - experience_reference = Group Population のうち前職歴がある人の Σ Contribution の 90 パーセンタイル。
    Group 達成率はこの値を 100 としてスケーリングする（Group の職業の経験があれば 100）
  - パーセンタイルは Harrell-Davis 推定量で求める。全順序統計量の加重平均のため、母数が少ない Group でも
    上位数人の値に振られにくく、母数が多ければ通常のパーセンタイルに一致する（調整パラメータなし）。
    Goal 間で Σ Contribution の尺度が大きく異なるため、他 Goal や全体平均へのフォールバックは行わない

実行: python scripts/build_career_statistics.py
"""

import json
import math
import urllib.request
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats.mstats import hdquantiles

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "jobhop"
GOALS_PATH = ROOT / "data" / "goals" / "goals.json"
CROSS_LANGUAGE_FIXTURE = ROOT / "data" / "fixtures" / "career-match" / "cross-language.json"
OUT_DIR = ROOT / "data" / "statistics" / "career-match"

SPLITS = ["train", "val", "test"]
HF_BASE = "https://huggingface.co/datasets/aida-ugent/JobHop/resolve/main"

SOURCE = "jobhop_v2"
SOURCE_VERSION = "v2"
CALCULATION_VERSION = "2.2.0"
MIN_RELIABLE_SAMPLE = 100
MAX_YEARS = 50.0
REFERENCE_PERCENTILE = 90


def load_jobhop() -> pd.DataFrame:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    frames = []
    for split in SPLITS:
        path = RAW_DIR / f"JobHop_v2_{split}.parquet"
        if not path.exists():
            urllib.request.urlretrieve(f"{HF_BASE}/{path.name}", path)
        frames.append(pd.read_parquet(path))
    df = pd.concat(frames, ignore_index=True)
    return df.rename(
        columns={
            "resume_id": "person_id",
            "matched_code": "role_id",
            "university_level": "degree_id",
        }
    )


def quarter_index(series: pd.Series) -> pd.Series:
    parts = series.str.extract(r"Q(?P<q>[1-4]) (?P<y>\d{4})")
    return parts["y"].astype("Int64") * 4 + parts["q"].astype("Int64") - 1


def round_years(years: float) -> float:
    return min(MAX_YEARS, max(0.5, math.floor(years * 2 + 0.5) / 2))


def experience_unit_key(role_id: str, years: float) -> str:
    return f"{role_id}__{years:.1f}"


def verify_cross_language_fixture() -> None:
    """計算エンジン（TS）と同じ入出力表で、丸めと Unit キーが一致することを確かめる。"""
    fixture = json.loads(CROSS_LANGUAGE_FIXTURE.read_text(encoding="utf-8"))
    for case in fixture["round_years"]:
        actual = round_years(case["input"])
        if actual != case["expected"]:
            raise ValueError(f"round_years({case['input']}) = {actual}, expected {case['expected']}")
    for case in fixture["experience_unit_keys"]:
        actual = experience_unit_key(case["role_id"], case["years"])
        if actual != case["expected"]:
            raise ValueError(f"experience_unit_key({case['role_id']}, {case['years']}) = {actual}, expected {case['expected']}")


def dated_jobs(df: pd.DataFrame) -> pd.DataFrame:
    """開始・終了が分かる職歴だけを四半期インデックス付きで返す。"""
    jobs = df[df.role_id != "unknown"].copy()
    jobs["start"] = quarter_index(jobs.start_date)
    jobs["end"] = quarter_index(jobs.end_date)
    jobs = jobs.dropna(subset=["start", "end"])
    return jobs[jobs.end >= jobs.start]


def experience_units(jobs: pd.DataFrame) -> pd.DataFrame:
    """1 行 = (person_id, role_id, years)。同一人物・同一 Role の期間は重なりを除いて合算する。"""
    exp = jobs.sort_values(["person_id", "role_id", "start"])
    group = exp.groupby(["person_id", "role_id"], sort=False)
    prev_max_end = group.end.cummax().groupby([exp.person_id, exp.role_id]).shift()
    exp = exp.assign(segment=(prev_max_end.isna() | (exp.start > prev_max_end)).cumsum())

    segments = exp.groupby(["person_id", "role_id", "segment"]).agg(start=("start", "min"), end=("end", "max"))
    quarters = (segments.end - segments.start).groupby(["person_id", "role_id"]).sum()

    units = quarters.reset_index(name="quarters")
    units["years"] = (units.quarters.astype(float) / 4).map(round_years)
    return units[["person_id", "role_id", "years"]]


def goal_population(df: pd.DataFrame, groups: list) -> tuple:
    """(到達時点 Series[person_id → 四半期], 開始日の有無を問わず全 Group を満たした人の集合)。"""
    group_starts, ever = [], None
    for codes in groups:
        group_jobs = df[df.role_id.isin(codes)]
        group_starts.append(group_jobs.dropna(subset=["start"]).groupby("person_id").start.min())
        persons = set(group_jobs.person_id)
        ever = persons if ever is None else ever & persons
    goal_start = pd.concat(group_starts, axis=1, join="inner").max(axis=1)
    return goal_start, ever


def pre_goal_units(jobs: pd.DataFrame, goal_start: pd.Series, codes: list) -> pd.DataFrame:
    """Goal Population の、Goal 到達前に始めた職歴（到達時点で打ち切り）。"""
    pre = jobs[jobs.person_id.isin(goal_start.index) & ~jobs.role_id.isin(codes)].copy()
    pre["goal_start"] = pre.person_id.map(goal_start)
    pre = pre[pre.start < pre.goal_start]
    pre["end"] = pre[["end", "goal_start"]].min(axis=1)
    return experience_units(pre)


N_BINS = int(MAX_YEARS * 2)


def cumulative_counts(units: pd.DataFrame) -> pd.Series:
    """(role_id, years) → その Role を years 年以上経験した人数（1 人 1 Role 1 行が前提）。"""
    if units.empty:
        return pd.Series(dtype="int64", index=pd.MultiIndex.from_tuples([], names=["role_id", "years"]))
    codes, roles = pd.factorize(units.role_id)
    bins = (units.years.to_numpy() * 2).astype(int) - 1
    matrix = np.zeros((len(roles), N_BINS), dtype=np.int64)
    np.add.at(matrix, (codes, bins), 1)
    at_least = matrix[:, ::-1].cumsum(axis=1)[:, ::-1]
    role_idx, bin_idx = np.nonzero(at_least)
    index = pd.MultiIndex.from_arrays([roles[role_idx], (bin_idx + 1) / 2], names=["role_id", "years"])
    return pd.Series(at_least[role_idx, bin_idx], index=index)


def unit_row(unit_id: str, extra: dict, p_goal: float, p_other: float) -> dict:
    quality = p_goal / (p_goal + p_other) * 100
    return {
        "unit_id": unit_id,
        **extra,
        "p_unit_given_goal": round(p_goal, 6),
        "p_unit_given_other": round(p_other, 6),
        "quantity": round(p_goal, 6),
        "quality": round(quality, 4),
        "contribution": round(p_goal * quality / 100, 6),
    }


def experience_statistics(goal_units, other_counts, n_goal, n_other):
    rows = []
    for (role_id, years), count in cumulative_counts(goal_units).items():
        p_other = other_counts.get((role_id, years), 0) / n_other if n_other else 0.0
        rows.append(unit_row(experience_unit_key(role_id, years), {"role_id": role_id, "years": years}, count / n_goal, p_other))
    return sorted(rows, key=lambda r: r["contribution"], reverse=True)


def person_scores(goal_units: pd.DataFrame, rows: list) -> pd.Series:
    """Goal 前職歴を、ユーザーと同じ規則（年数以下の全 Unit に該当）で採点した Σ Contribution。"""
    contribution = {(r["role_id"], r["years"]): r["contribution"] for r in rows}
    cumulative = {}
    for role_id in goal_units.role_id.unique():
        total, series = 0.0, []
        for k in range(1, N_BINS + 1):
            total += contribution.get((role_id, k / 2), 0.0)
            series.append(total)
        cumulative[role_id] = series
    scores = goal_units.apply(lambda u: cumulative[u.role_id][int(u.years * 2) - 1], axis=1)
    return scores.groupby(goal_units.person_id).sum()


def education_statistics(edu, goal_ids, other_ids, n_goal, n_other):
    goal_counts = edu[edu.person_id.isin(goal_ids)].degree_id.value_counts()
    other_counts = edu[edu.person_id.isin(other_ids)].degree_id.value_counts()
    rows = [
        unit_row(degree, {"degree_id": degree}, count / n_goal, other_counts.get(degree, 0) / n_other)
        for degree, count in goal_counts.items()
    ]
    return sorted(rows, key=lambda r: r["contribution"], reverse=True)


def reference_value(scores: pd.Series) -> float:
    """Harrell-Davis 推定量は 2 人未満では NaN を返すため、その場合は 0（Experience は算出不可）。"""
    if scores.size < 2:
        return 0.0
    value = float(hdquantiles(scores.to_numpy(), prob=[REFERENCE_PERCENTILE / 100])[0])
    return value if math.isfinite(value) and value > 0 else 0.0


def group_experience(df, jobs, all_units, all_counts, all_persons, group_id, codes) -> dict:
    """1 つの Requirement Group を単独の Goal とみなした Experience 統計。"""
    group_start, ever = goal_population(df, [codes])
    group_ids = set(group_start.index)
    excluded = group_ids | ever
    n_group, n_other = len(group_ids), len(all_persons - excluded)

    result = {
        "group_id": group_id,
        "occupations": codes,
        "goal_sample_size": n_group,
        "pre_goal_experience_persons": 0,
        "experience_reference": 0,
        "experience": [],
    }
    if n_group == 0:
        print(f"  [Notice] group={group_id}: no dated person in the group. Experience is not calculable for Goals that include this group.")
        return result
    excluded_counts = cumulative_counts(all_units[all_units.person_id.isin(excluded)])
    # excluded は all_units の部分集合なので負にはならないはずだが、負の出現数が Quality に混ざらないよう 0 で止める
    other_counts = all_counts.sub(excluded_counts, fill_value=0).clip(lower=0)
    units = pre_goal_units(jobs, group_start, codes)
    rows = experience_statistics(units, other_counts, n_group, n_other)
    scores = person_scores(units, rows) if rows else pd.Series(dtype=float)

    result["pre_goal_experience_persons"] = int(scores.size)
    result["experience_reference"] = round(reference_value(scores), 6)
    result["experience"] = rows
    if result["experience_reference"] <= 0:
        print(
            f"  [Notice] group={group_id}: experience_reference = 0 (pre-goal persons = {scores.size}, units = {len(rows)}). "
            "Experience is not calculable for Goals that include this group."
        )
    return result


def main() -> None:
    verify_cross_language_fixture()
    goals = json.loads(GOALS_PATH.read_text(encoding="utf-8"))
    df = load_jobhop()
    all_persons = set(df.person_id.unique())
    df["start"] = quarter_index(df.start_date)

    jobs = dated_jobs(df)
    all_units = experience_units(jobs)
    all_counts = cumulative_counts(all_units)
    edu = df.drop_duplicates("person_id")[["person_id", "degree_id"]]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for goal in goals["goals"]:
        groups = [[o["code"] for o in g["occupations"]] for g in goal["requirement_groups"]]
        codes = [code for group in groups for code in group]
        goal_start, ever_in_goal = goal_population(df, groups)
        goal_ids = set(goal_start.index)
        excluded = goal_ids | ever_in_goal
        other_ids = all_persons - excluded
        n_goal, n_other = len(goal_ids), len(other_ids)

        result = {
            "goal_id": goal["goal_id"],
            "mapping_status": goal["mapping_status"],
            "goal_occupations": codes,
            "goal_sample_size": n_goal,
            "other_sample_size": n_other,
            "undated_goal_persons": len(excluded) - n_goal,
            "small_sample": n_goal < MIN_RELIABLE_SAMPLE,
            "source": SOURCE,
            "source_version": SOURCE_VERSION,
            "taxonomy": goals["taxonomy"],
            "taxonomy_version": goals["taxonomy_version"],
            "calculation_version": CALCULATION_VERSION,
            "calculation_date": date.today().isoformat(),
            "experience_reference_percentile": REFERENCE_PERCENTILE,
            "experience_reference_estimator": "harrell-davis",
            "requirement_groups": [
                group_experience(df, jobs, all_units, all_counts, all_persons, g["group_id"], group)
                for g, group in zip(goal["requirement_groups"], groups)
            ],
            "education": (
                education_statistics(edu, goal_ids, other_ids, n_goal, n_other) if n_goal > 0 else []
            ),
        }

        path = OUT_DIR / f"{goal['goal_id']}.json"
        path.write_text(json.dumps(result, ensure_ascii=False, indent=1, allow_nan=False), encoding="utf-8")
        groups_summary = "  ".join(
            f"[{g['group_id']} N={g['goal_sample_size']} pre={g['pre_goal_experience_persons']}"
            f" units={len(g['experience'])} ref={g['experience_reference']:.4f}]"
            for g in result["requirement_groups"]
        )
        print(f"{goal['goal_id']:<22} N={n_goal:>5} (undated {result['undated_goal_persons']:>3})  {groups_summary}")


if __name__ == "__main__":
    main()


