"""統計生成スクリプトの安全網（生データ不要）。実行: python -m pytest scripts/tests"""

import json

import numpy as np
import pandas as pd
import pytest

import build_career_statistics as career
import build_skill_statistics as skill


def test_prior_strength_moderate_dispersion_is_estimated_without_warning(capsys):
    # p = 0.5, n = 100, 日本の比率 0.4 / 0.6 → 各組 n (x − p)² / (p (1 − p)) − 1 = 3、τ = 6 / 198、k ≈ 32
    k = skill.estimate_prior_strength([(40, 100, 0.5), (60, 100, 0.5)])
    assert k == pytest.approx(198 / 6 - 1)
    assert "[Warning]" not in capsys.readouterr().out


def test_prior_strength_is_capped_when_variance_is_below_binomial_noise(capsys):
    # 日本の比率が世界と完全に一致 → 分子が負（τ < 0）。k は発散させず約 999 で止め、警告する
    k = skill.estimate_prior_strength([(50, 100, 0.5), (30, 100, 0.3)])
    assert k == pytest.approx(1 / skill.TAU_MIN - 1)
    assert "upper bound" in capsys.readouterr().out


def test_prior_strength_is_zero_when_variance_is_extreme(capsys):
    # 日本の比率が 0 / 1 に振り切れる → τ ≥ 1。k = 0（縮小なし）で止め、警告する
    k = skill.estimate_prior_strength([(0, 100, 0.5), (100, 100, 0.5)])
    assert k == 0
    assert "lower bound" in capsys.readouterr().out


def test_prior_strength_without_usable_pairs_raises():
    with pytest.raises(ValueError):
        skill.estimate_prior_strength([(1, 1, 0.5), (10, 100, 0.0), (10, 100, 1.0)])


def test_reference_value_is_zero_when_not_estimable():
    assert career.reference_value(pd.Series([], dtype=float)) == 0.0
    assert career.reference_value(pd.Series([0.3])) == 0.0
    # 前職歴のある人のほとんどが該当 Unit を持たない（Σ Contribution が 0）→ 0（計算側で算出不可）
    assert career.reference_value(pd.Series([0.0] * 50)) == 0.0


def test_reference_value_is_positive_for_normal_scores():
    value = career.reference_value(pd.Series([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]))
    assert 0.8 < value < 1.0


def test_cross_language_fixture_matches():
    career.verify_cross_language_fixture()

def test_shrink_without_region_information_uses_world_rate():
    assert skill.shrink(0, 0, 0.3, 0.0) == 0.3
    assert skill.shrink(5, 10, 0.3, 0.0) == 0.5
    assert skill.shrink(5, 10, 0.3, 10.0) == pytest.approx(0.4)


def skill_row(p, pg, po, in_dictionary=True):
    return {"_p": p, "p_value": float(f"{p:.3g}"), "_pg": pg, "_po": po, "in_dictionary": in_dictionary}


def test_assign_roles_uses_unrounded_p_value():
    # しきい値 = 0.05 / 2 = 0.025。p = 0.02504 は丸めると 0.025（しきい値未満にならない）だが、丸める前で判定する
    rows = [skill_row(0.024996, 0.3, 0.1), skill_row(0.02504, 0.3, 0.1)]
    skill.assign_roles(rows, 0.1)
    assert [r["significant"] for r in rows] == [True, False]
    assert rows[0]["p_value"] == 0.025


def test_assign_roles_never_gives_a_role_with_zero_weight():
    # d > 0 でも pg × d が小数 6 桁で 0 に丸まるなら、特有リストに入れない
    rows = [skill_row(1e-12, 0.000001, 0.0000009), skill_row(1e-12, 0.6, 0.2), skill_row(1e-12, 0.6, 0.2, in_dictionary=False)]
    skill.assign_roles(rows, 0.1)
    assert rows[0]["distinctive_weight"] == 0 and rows[0]["roles"] == [] and not rows[0]["selected"]
    assert rows[1]["roles"] == ["base", "distinctive"]
    assert rows[1]["base_weight"] == 0.6 and rows[1]["distinctive_weight"] == pytest.approx(0.3)
    assert rows[2]["roles"] == [] and not rows[2]["selected"]
    for r in rows:
        assert r["selected"] == bool(r["roles"])
        assert ("base" in r["roles"]) == (r["base_weight"] > 0)
        assert ("distinctive" in r["roles"]) == (r["distinctive_weight"] > 0)


def test_load_groups_rejects_dev_env_member_outside_allowlist(tmp_path, monkeypatch):
    groups = tmp_path / "groups.json"
    groups.write_text(
        '{"version": "0", "groups": [{"group_id": "ide", "name": "IDE", "members": ["vscode", "xcode"]}]}', encoding="utf-8"
    )
    monkeypatch.setattr(skill, "GROUPS_PATH", groups)
    dictionary = {
        "vscode": {"skill_id": "vscode", "category": "dev_env", "so_items": ["Visual Studio Code"]},
        "xcode": {"skill_id": "xcode", "category": "dev_env", "so_items": ["Xcode"]},
    }
    with pytest.raises(SystemExit, match="Xcode"):
        skill.load_groups(dictionary, {"Visual Studio Code"})
    loaded = skill.load_groups(dictionary, {"Visual Studio Code", "Xcode"})
    assert loaded[0]["so_items"] == {"Visual Studio Code", "Xcode"}


def test_person_degrees_uses_first_known_degree():
    df = pd.DataFrame({"person_id": [1, 1, 2, 3], "degree_id": [None, "Master", "Bachelor", None]})
    assert career.person_degrees(df).set_index("person_id").degree_id.to_dict() == {1: "Master", 2: "Bachelor"}


def test_education_requirement_uses_known_degrees_and_handles_no_data():
    edu = pd.DataFrame({"person_id": [1, 2, 3], "degree_id": ["Bachelor", "Bachelor", "Secondary school"]})
    # 学歴の分からない人（4, 5）は分母に入れない：Bachelor 以上 2 / 3 > 0.5
    result = career.education_requirement(edu, {1, 2, 3, 4, 5})
    assert result["minimum_education"] == "Bachelor"
    assert result["education_at_or_above"]["None"] == 1.0
    assert career.education_requirement(edu, {4, 5}) is None


def test_education_statistics_without_other_persons():
    edu = pd.DataFrame({"person_id": [1, 2], "degree_id": ["Bachelor", "Master"]})
    rows = career.education_statistics(edu, {1, 2}, set())
    assert {r["degree_id"]: r["p_unit_given_other"] for r in rows} == {"Bachelor": 0.0, "Master": 0.0}
    assert {r["degree_id"]: r["p_unit_given_goal"] for r in rows} == {"Bachelor": 0.5, "Master": 0.5}

def logistic_points(threshold, n=2000, slope=40.0, seed=1):
    """境目 threshold（有意になる確率 50%）のロジスティックから (d, significant, goal_id) を作る。"""
    rng = np.random.default_rng(seed)
    d = rng.uniform(0, 0.4, n)
    p = 1 / (1 + np.exp(-slope * (d - threshold)))
    y = rng.uniform(0, 1, n) < p
    return [(float(di), bool(yi), f"g{i % 14}") for i, (di, yi) in enumerate(zip(d, y))]


def test_d_ref_estimate_recovers_true_threshold():
    assert skill.estimate_base_discount_d_ref(logistic_points(0.1)) == pytest.approx(0.1, abs=0.01)


def test_d_ref_estimate_increases_with_true_threshold():
    estimates = [skill.estimate_base_discount_d_ref(logistic_points(t)) for t in (0.05, 0.1, 0.2)]
    assert estimates == sorted(estimates)
    assert estimates[0] < estimates[1] < estimates[2]


def test_d_ref_estimate_stops_when_not_estimable():
    points = logistic_points(0.1)
    one_class = [(d, True, g) for d, _, g in points]
    too_few = points[: skill.D_REF_MIN_UNITS - 1]
    assert {s for _, s, _ in too_few} == {True, False}  # 件数以外の理由で止まらないこと
    separated = [(d, d >= 0.1, g) for d, _, g in points]
    reversed_effect = [(d, not s, g) for d, s, g in points]
    cases = [
        (one_class, "片方が 0 件"),
        (too_few, "下限"),
        (separated, "完全に分かれて"),
        (reversed_effect, "意味が逆"),
    ]
    for bad, reason in cases:
        with pytest.raises(SystemExit, match=reason):
            skill.estimate_base_discount_d_ref(bad)


def test_base_candidates_keeps_dictionary_majority_units_including_zero_d():
    def row(pg, po, in_dictionary=True, significant=False):
        return {"_pg": pg, "_po": po, "in_dictionary": in_dictionary, "significant": significant}

    goal_rows = {
        "a": [row(0.8, 0.4, significant=True), row(0.6, 0.7), row(0.9, 0.3, in_dictionary=False)],
        "b": [row(0.49, 0.1, significant=True), row(0.5, 0.5)],
    }
    assert skill.base_candidates(goal_rows) == [
        (pytest.approx(1 / 3), True, "a"),
        (0.0, False, "a"),
        (0.0, False, "b"),
    ]


def test_leave_one_out_is_none_when_the_rest_is_not_estimable():
    significant_goal = [(d, s, "a") for d, s, _ in logistic_points(0.1, n=200)]
    rng = np.random.default_rng(2)
    nonsignificant_goal = [(float(d), False, "b") for d in rng.uniform(0, 0.4, 40)]
    leave_one_out = skill.d_ref_diagnostics(significant_goal + nonsignificant_goal)["leave_one_out"]
    assert leave_one_out["a"] is None
    assert leave_one_out["b"] == pytest.approx(skill.estimate_base_discount_d_ref(significant_goal))


def test_generated_statistics_reproduce_d_ref():
    """生成済み JSON の (d, significant) から d* を推定し直し、selection の値と一致する（手編集・古い JSON の混入を検知）。"""
    dictionary = json.loads(skill.DICTIONARY_PATH.read_text(encoding="utf-8"))
    tech_ids = {s["skill_id"] for s in dictionary["skills"]}
    candidates, stored = [], set()
    for path in sorted(skill.OUT_DIR.glob("*.json")):
        stats = json.loads(path.read_text(encoding="utf-8"))
        selection = stats["selection"]
        stored.add((selection["base_discount_d_ref"], selection["base_discount_d_ref_n_units"]))
        for u in stats["units"]:
            pg, po = u["region_p_skill_given_goal"], u["region_p_skill_given_other"]
            if all(m["skill_id"] in tech_ids for m in u["members"]) and pg >= selection["base_min_share"]:
                candidates.append((skill.distinctiveness(pg, po), u["significant"], stats["goal_id"]))
    assert len(stored) == 1
    d_ref, n_units = stored.pop()
    assert len(candidates) == pytest.approx(n_units, abs=2)  # 丸めた pg が境界に近い unit の分だけずれうる
    assert skill.estimate_base_discount_d_ref(candidates) == pytest.approx(d_ref, abs=1e-3)


def test_d_ref_estimate_and_diagnostics_are_reproducible():
    points = logistic_points(0.1, n=300)
    assert skill.estimate_base_discount_d_ref(points) == skill.estimate_base_discount_d_ref(points)
    first, second = skill.d_ref_diagnostics(points), skill.d_ref_diagnostics(points)
    assert first == second
    low, high = first["bootstrap_90"]
    assert low < skill.estimate_base_discount_d_ref(points) < high


def test_assign_roles_discounts_base_weight_by_d():
    d_ref = 0.1
    # d = (pg − po) / (pg + po)
    full = skill_row(1e-12, 0.6, 0.4)  # d = 0.2 ≥ d_ref → 満額
    partial = skill_row(0.5, 0.55, 0.45)  # d = 0.1 → ちょうど満額
    half = skill_row(0.5, 0.525, 0.475)  # d = 0.05 → 半分
    zero = skill_row(0.5, 0.6, 0.6)  # d = 0 → 基本リストに入らない
    tiny = skill_row(0.5, 0.50000001, 0.5)  # d ≈ 1e-8 → 重み ≈ 5e-8 を丸めて 0 → 基本リストに入らない
    rows = [full, partial, half, zero, tiny]
    skill.assign_roles(rows, d_ref)
    assert full["base_weight"] == 0.6 and "base" in full["roles"]
    assert partial["base_weight"] == pytest.approx(0.55, abs=1e-6)
    assert half["base_weight"] == pytest.approx(0.525 * 0.05 / d_ref, abs=1e-6) and "base" in half["roles"]
    assert zero["base_weight"] == 0 and "base" not in zero["roles"]
    assert tiny["base_weight"] == 0 and "base" not in tiny["roles"]


def test_assign_roles_d_ref_does_not_change_distinctive_list():
    def rows():
        return [skill_row(1e-12, 0.6, 0.4), skill_row(1e-12, 0.3, 0.1), skill_row(0.5, 0.525, 0.475)]

    a, b = rows(), rows()
    skill.assign_roles(a, 0.05)
    skill.assign_roles(b, 0.3)
    for x, y in zip(a, b):
        assert x["distinctive_weight"] == y["distinctive_weight"]
        assert ("distinctive" in x["roles"]) == ("distinctive" in y["roles"])
        assert x["significant"] == y["significant"]


def test_assign_roles_rejects_invalid_d_ref():
    for bad in (0, -0.1, float("nan"), float("inf")):
        with pytest.raises(ValueError):
            skill.assign_roles([skill_row(1e-12, 0.6, 0.4)], bad)
