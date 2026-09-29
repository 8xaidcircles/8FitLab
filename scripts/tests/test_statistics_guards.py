"""統計生成スクリプトの安全網（生データ不要）。実行: python -m pytest scripts/tests"""

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
