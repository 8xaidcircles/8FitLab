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
    missing = set(persons) - {r["role_id"] for r in roles} - {"unknown"}
    print(f"JobHop codes not in ESCO released occupations: {len(missing)} {sorted(missing)[:10]}")


if __name__ == "__main__":
    main()
