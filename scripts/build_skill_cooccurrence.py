"""Skill Statistics の採用 unit どうしの共起を調べ、グループに統合する候補を出す（グループは変更しない。統合するかは人が判断する）。

入力: data/raw/stackoverflow/{year}/results.csv、data/statistics/skill-match/{goal_id}.json（採用 unit）、
      data/skills/so-devtype-mapping.json・tech-skills.json・tech-skill-groups.json
出力: docs/skill-cooccurrence-report.csv（列: goal_id, unit_a, unit_b, P(b|a), P(a|b)）

計算（Goal × 採用 unit のペアごと）:
  - 対象 = 各年の Goal の DevType の回答者（世界全体。日本補正はしない）。A と B の選択肢がどちらもある年だけを合算する
  - A を使う人 = A の選択肢（グループはメンバーのどれか）を使った人
  - P(b|a) = A と B の両方を使う人 / A を使う人
  - P(b|a) か P(a|b) のどちらかが COOCCURRENCE_MIN 以上のペアだけを出す

実行: python scripts/build_skill_cooccurrence.py（先に build_skill_statistics.py を実行しておく）
"""

import csv
import itertools
import json

from build_skill_statistics import (
    DICTIONARY_PATH,
    MAPPING_PATH,
    OUT_DIR,
    ROOT,
    load_groups,
    load_year,
)

REPORT_PATH = ROOT / "docs" / "skill-cooccurrence-report.csv"
COOCCURRENCE_MIN = 0.9


def unit_items(unit: dict, groups_by_id: dict) -> set:
    if unit["type"] == "group":
        return groups_by_id[unit["unit_id"]]["so_items"]
    return {unit["members"][0]["so_item"]}


def main() -> None:
    mapping = json.loads(MAPPING_PATH.read_text(encoding="utf-8"))
    excluded = set(mapping["population_excluded_devtypes"])
    aliases = mapping["item_aliases"]
    dictionary_skills = json.loads(DICTIONARY_PATH.read_text(encoding="utf-8"))["skills"]
    groups_by_id = {
        g["group_id"]: g
        for g in load_groups({s["skill_id"]: s for s in dictionary_skills}, set(mapping["dev_env_allowlist"]))
    }

    devtype, item_users = {}, {}
    for year in mapping["years"]:
        devtype[year], answers = load_year(year, excluded, aliases)
        item_users[year] = {item: set(ids) for item, ids in answers.groupby("item").ResponseId}

    rows = []
    for goal in mapping["goals"]:
        stats = json.loads((OUT_DIR / f"{goal['goal_id']}.json").read_text(encoding="utf-8"))
        units = [u for u in stats["units"] if u["selected"]]
        goal_types = {int(y): set(types) for y, types in goal["devtypes"].items()}
        respondents = {
            year: set(devtype[year].index[devtype[year].isin(goal_types[year])])
            for year in mapping["years"]
            if goal_types.get(year)
        }

        def users(year: int, items: set):
            present = [item for item in items if item in item_users[year]]
            if not present:
                return None
            return set().union(*(item_users[year][item] for item in present)) & respondents[year]

        for a, b in itertools.combinations(units, 2):
            n_a = n_b = n_ab = 0
            for year in respondents:
                users_a, users_b = users(year, unit_items(a, groups_by_id)), users(year, unit_items(b, groups_by_id))
                if users_a is None or users_b is None:
                    continue
                n_a, n_b, n_ab = n_a + len(users_a), n_b + len(users_b), n_ab + len(users_a & users_b)
            if n_a == 0 or n_b == 0:
                continue
            p_b_given_a, p_a_given_b = n_ab / n_a, n_ab / n_b
            if max(p_b_given_a, p_a_given_b) >= COOCCURRENCE_MIN:
                rows.append([goal["goal_id"], a["unit_id"], b["unit_id"], round(p_b_given_a, 4), round(p_a_given_b, 4)])
        print(f"{goal['goal_id']:<22} units={len(units):>3} pairs>={COOCCURRENCE_MIN}: {sum(r[0] == goal['goal_id'] for r in rows)}")

    with REPORT_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["goal_id", "unit_a", "unit_b", "P(b|a)", "P(a|b)"])
        writer.writerows(rows)
    print(f"\n{len(rows)} pairs -> {REPORT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
