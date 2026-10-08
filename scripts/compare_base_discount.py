"""基本リストの重みの割り引き（d*）の検証用に、Skill Statistics を一時フォルダへ生成する（data/statistics は上書きしない）。

  python scripts/compare_base_discount.py <out_dir> [--d-ref 0.1 ...] [--neighbors 0.02] [--current <dir>]

出力:
  <out_dir>/estimated/      本番と同じ手順（d* をデータから推定）
  <out_dir>/d_ref-<値>/     d* を指定した値に置き換えたもの（参考列。--d-ref と、推定値 ± --neighbors）
  <out_dir>/base-list.csv   14 Goal の基本リストの候補（pg / po / d / significant / 変更前後の base_weight）
d* の推定の診断は build_skill_statistics.py と同じものを標準出力に出す。
固定値での生成はこのスクリプトの中だけで行い、build_skill_statistics.py には固定値の経路を置かない。
"""

import argparse
import csv
import json
import shutil
from pathlib import Path

import build_skill_statistics as skill


def cache_load_year() -> None:
    """生データの読み込み（年ごと）を 1 回にする。"""
    original, cache = skill.load_year, {}

    def cached(year, excluded, aliases):
        if year not in cache:
            cache[year] = original(year, excluded, aliases)
        return cache[year]

    skill.load_year = cached


def generate(out_dir: Path, d_ref=None) -> Path:
    original = skill.estimate_base_discount_d_ref
    if d_ref is not None:
        skill.estimate_base_discount_d_ref = lambda candidates: d_ref
    skill.OUT_DIR = out_dir
    if out_dir.exists():
        shutil.rmtree(out_dir)
    try:
        print(f"\n===== {out_dir.name} =====")
        skill.main()
    finally:
        skill.estimate_base_discount_d_ref = original
    return out_dir


def d_value(unit: dict) -> float:
    return skill.distinctiveness(unit["region_p_skill_given_goal"], unit["region_p_skill_given_other"])


def write_base_list(path: Path, current_dir: Path, estimated_dir: Path) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["goal_id", "unit_id", "pg", "po", "d", "significant", "base_weight_before", "base_weight_after", "roles_after"])
        for after_path in sorted(estimated_dir.glob("*.json")):
            after = json.loads(after_path.read_text(encoding="utf-8"))
            before = json.loads((current_dir / after_path.name).read_text(encoding="utf-8"))
            before_weight = {u["unit_id"]: u["base_weight"] for u in before["units"]}
            for u in after["units"]:
                if u["region_p_skill_given_goal"] < after["selection"]["base_min_share"] or before_weight.get(u["unit_id"], 0) == 0 and u["base_weight"] == 0:
                    continue
                writer.writerow([
                    after["goal_id"], u["unit_id"], u["region_p_skill_given_goal"], u["region_p_skill_given_other"],
                    round(d_value(u), 6), u["significant"], before_weight.get(u["unit_id"], 0), u["base_weight"], "+".join(u["roles"]),
                ])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--d-ref", type=float, action="append", default=[], help="参考として生成する d* の固定値")
    parser.add_argument("--neighbors", type=float, default=None, help="推定値 ± この幅でも生成する")
    parser.add_argument("--current", type=Path, default=skill.OUT_DIR, help="変更前の統計（base-list.csv の比較元）")
    args = parser.parse_args()

    current = args.out_dir / "current"
    if args.current.resolve() != current.resolve():
        if current.exists():
            shutil.rmtree(current)
        shutil.copytree(args.current, current)
    cache_load_year()
    estimated = generate(args.out_dir / "estimated")
    d_ref = json.loads(next(estimated.glob("*.json")).read_text(encoding="utf-8"))["selection"]["base_discount_d_ref"]
    values = list(args.d_ref)
    if args.neighbors:
        values += [round(d_ref - args.neighbors, 6), round(d_ref + args.neighbors, 6)]
    for value in values:
        generate(args.out_dir / f"d_ref-{value}", value)
    write_base_list(args.out_dir / "base-list.csv", current, estimated)
    print(f"\nd* = {d_ref}  outputs: {', '.join(p.name for p in sorted(args.out_dir.iterdir()))}")


if __name__ == "__main__":
    main()
