"""Canonical Skill と ESCO Skill の対応（参考情報）を生成する（要件定義書 §4.1, §9）。

名前・別名が ESCO の preferredLabel と大文字小文字を無視して完全一致したものだけを対応とする。
ESCO の altLabels は略語の衝突（例: ADR → 危険物輸送）が多いため照合に使わない。

入力: data/skills/skills.json, data/raw/esco/v1.1.2/skills_en.csv
出力: data/skills/esco-links.json

実行: python scripts/link_esco_skills.py
"""

import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SKILLS_PATH = ROOT / "data" / "skills" / "skills.json"
ESCO_SKILLS = ROOT / "data" / "raw" / "esco" / "v1.1.2" / "skills_en.csv"
OUT_PATH = ROOT / "data" / "skills" / "esco-links.json"

# 名前は一致するが別概念のもの（ESCO の SPARK は Ada 系言語で Apache Spark ではない）
EXCLUDED = {("distributed-processing", "SPARK")}


def normalize(label: str) -> str:
    label = re.sub(r"\s*\(computer programming\)$", "", label.strip().lower())
    return re.sub(r"\s+", " ", label)


def main() -> None:
    esco = pd.read_csv(ESCO_SKILLS, dtype=str)
    esco = esco[esco.status == "released"]

    index: dict[str, tuple[str, str]] = {}
    for row in esco.itertuples():
        index.setdefault(normalize(row.preferredLabel), (row.conceptUri, row.preferredLabel))

    skills = json.loads(SKILLS_PATH.read_text(encoding="utf-8"))["skills"]
    links = []
    for skill in skills:
        for candidate in [skill["name"], *skill["aliases"]]:
            hit = index.get(normalize(candidate))
            if hit and (skill["skill_id"], hit[1]) not in EXCLUDED:
                links.append(
                    {
                        "skill_id": skill["skill_id"],
                        "matched_by": candidate,
                        "esco_uri": hit[0],
                        "esco_label": hit[1],
                    }
                )
                break

    OUT_PATH.write_text(
        json.dumps(
            {"taxonomy": "esco", "taxonomy_version": "1.1.2", "links": links},
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    linked = {l["skill_id"] for l in links}
    print(f"linked {len(linked)}/{len(skills)} -> {OUT_PATH.relative_to(ROOT)}")
    for l in links:
        print(f"  {l['skill_id']:<24} {l['matched_by']!r:<24} -> {l['esco_label']}")
    print("unlinked:", [s["skill_id"] for s in skills if s["skill_id"] not in linked])


if __name__ == "__main__":
    main()
