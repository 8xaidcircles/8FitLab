"""Canonical Role（Experience 入力用の職業一覧）を ESCO v1.1.2 から生成する（要件定義書 §13, §37）。

入力: data/raw/esco/v1.1.2/occupations_en.csv, ISCOGroups_en.csv
      data/raw/jobhop/JobHop_v2_*.parquet（職業ごとの経験者数）
出力: data/career/roles.json

実行: python scripts/build_roles.py
"""

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
ESCO_DIR = ROOT / "data" / "raw" / "esco" / "v1.1.2"
JOBHOP_DIR = ROOT / "data" / "raw" / "jobhop"
GOALS_PATH = ROOT / "data" / "goals" / "goals.json"
OUT_PATH = ROOT / "data" / "career" / "roles.json"


def split_labels(value) -> list:
    if not isinstance(value, str):
        return []
    return sorted({label.strip() for label in value.split("\n") if label.strip()})


def main() -> None:
    occ = pd.read_csv(ESCO_DIR / "occupations_en.csv", dtype=str)
    occ = occ[occ.status == "released"]

    isco = pd.read_csv(ESCO_DIR / "ISCOGroups_en.csv", dtype=str)
    isco_label = dict(zip(isco.code, isco.preferredLabel))

    jobhop = pd.concat(
        [pd.read_parquet(JOBHOP_DIR / f"JobHop_v2_{s}.parquet") for s in ["train", "val", "test"]]
    )
    persons = jobhop.groupby("matched_code").resume_id.nunique().to_dict()

    missing_isco = occ[occ.iscoGroup.isna() | (occ.iscoGroup.str.len() == 0)]
    if not missing_isco.empty:
        raise SystemExit(f"iscoGroup が無い職業があります: {', '.join(missing_isco.code.astype(str).head(10))}")
    duplicated = occ.code[occ.code.duplicated()]
    if not duplicated.empty:
        raise SystemExit(f"role_id（ESCO の code）が重複しています: {', '.join(sorted(set(duplicated))[:10])}")

    roles = []
    for row in occ.itertuples():
        alt = [a for a in split_labels(row.altLabels) if a != row.preferredLabel]
        major = row.iscoGroup[0]
        roles.append(
            {
                "role_id": row.code,
                "label": row.preferredLabel,
                "alt_labels": alt,
                "isco_group": row.iscoGroup,
                "isco_group_label": isco_label.get(row.iscoGroup),
                "isco_major": major,
                "isco_major_label": isco_label.get(major),
                "esco_uri": row.conceptUri,
                "jobhop_persons": int(persons.get(row.code, 0)),
            }
        )
    roles.sort(key=lambda r: r["role_id"])

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(
            {
                "taxonomy": "esco",
                "taxonomy_version": "1.1.2",
                "note": "Derived from the ESCO classification of the European Commission (modified).",
                "roles": roles,
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )

    with_data = sum(1 for r in roles if r["jobhop_persons"] > 0)
    print(f"roles={len(roles)}  in_jobhop={with_data}  -> {OUT_PATH.relative_to(ROOT)}")
    role_ids = {r["role_id"] for r in roles}
    missing = sorted(set(persons) - role_ids - {"unknown"}, key=lambda code: -persons[code])
    affected = jobhop[jobhop.matched_code.isin(missing)].resume_id.nunique()
    print(
        f"JobHop codes not in ESCO released occupations: {len(missing)} codes, {affected} persons "
        f"(top: {', '.join(f'{code}={persons[code]}' for code in missing[:10])})"
    )

    goals = json.loads(GOALS_PATH.read_text(encoding="utf-8"))["goals"]
    unknown_goal_codes = sorted(
        {o["code"] for g in goals for group in g["requirement_groups"] for o in group["occupations"]} - role_ids
    )
    if unknown_goal_codes:
        raise SystemExit(f"{GOALS_PATH.name} の職業コードが roles.json にありません: {', '.join(unknown_goal_codes)}")


if __name__ == "__main__":
    main()
