# 基本リストの重みの割り引き（d*）の検証結果

Skill Statistics 0.8.0。`scripts/compare_base_discount.py` で一時フォルダに生成し、`scripts/compare-base-discount.mjs`（採点は `src/lib/career-match/skill-score.ts`）で比較した。
「現状」は 0.7.0（base_weight = pg）、「固定0.1」「dstar±0.02」は d* を置き換えた参考列。

## A. d* の推定の診断

```
d* = 0.094321（推定に使った unit 141 件：有意 71・有意でない 70）
ブートストラップ 90% 区間 = 0.0779 〜 0.1130（500 回、seed 0、失敗 0 回）
  ※ 統計ファイル（Goal のファイル名順・丸めた pg / po）から計算し直した値。生成時の標準出力（Goal の定義順・丸める前の値）では 0.0755 〜 0.1124。候補の並び順が違うとリサンプルが変わるため
1 Goal 除外 = 0.0863 〜 0.1043（最も動かす Goal：backend-developer を除くと 0.1043）
  backend-developer を除く: 0.1043
  cloud-architect を除く: 0.1001
  data-analyst を除く: 0.0944
  data-engineer を除く: 0.0940
  data-scientist を除く: 0.0885
  devops-sre を除く: 0.0944
  frontend-developer を除く: 0.0961
  full-stack-developer を除く: 0.0996
  it-project-manager を除く: 0.0863
  mobile-app-developer を除く: 0.0953
  network-engineer を除く: 0.0893
  product-manager を除く: 0.0892
  software-architect を除く: 0.1032
  test-analyst を除く: 0.0866
有意かどうかを最もよく分ける d = 0.0882
有意でない基本技術の d の 90 パーセンタイル = 0.0987
基本技術の d の中央値 = 0.0772
```

## B. 職種別の基本リスト（候補：辞書にあり pg ≥ 0.5）

| Goal | unit | pg | po | d | significant | base_weight 変更前 | 変更後 | roles（変更後） |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| backend-developer | server-language | 0.989 | 0.934 | 0.029 | True | 0.989 | 0.301 | base+distinctive |
| backend-developer | relational-database | 0.912 | 0.852 | 0.034 | True | 0.912 | 0.330 | base+distinctive |
| backend-developer | public-cloud | 0.856 | 0.814 | 0.025 | True | 0.856 | 0.229 | base+distinctive |
| backend-developer | server-framework | 0.801 | 0.665 | 0.093 | True | 0.801 | 0.786 | base+distinctive |
| backend-developer | container-runtime | 0.752 | 0.620 | 0.096 | True | 0.752 | 0.752 | base+distinctive |
| backend-developer | sql | 0.556 | 0.460 | 0.094 | True | 0.556 | 0.556 | base+distinctive |
| backend-developer | js-package-manager | 0.505 | 0.610 | 0.000 | False | 0.505 | 0.000 |  |
| backend-developer | javascript | 0.502 | 0.641 | 0.000 | False | 0.502 | 0.000 |  |
| backend-developer | frontend-framework | 0.515 | 0.720 | 0.000 | False | 0.515 | 0.000 |  |
| cloud-architect | infrastructure-as-code | 0.646 | 0.141 | 0.641 | True | 0.646 | 0.646 | base+distinctive |
| cloud-architect | container-orchestration | 0.653 | 0.187 | 0.555 | True | 0.653 | 0.653 | base+distinctive |
| cloud-architect | shell | 0.768 | 0.411 | 0.303 | True | 0.768 | 0.768 | base+distinctive |
| cloud-architect | infrastructure-language | 0.850 | 0.612 | 0.163 | True | 0.850 | 0.850 | base+distinctive |
| cloud-architect | container-runtime | 0.838 | 0.633 | 0.140 | True | 0.838 | 0.838 | base+distinctive |
| cloud-architect | relational-database | 0.905 | 0.858 | 0.026 | False | 0.905 | 0.252 | base |
| cloud-architect | public-cloud | 0.884 | 0.831 | 0.030 | True | 0.884 | 0.285 | base+distinctive |
| cloud-architect | monitoring | 0.528 | 0.224 | 0.405 | True | 0.528 | 0.528 | base+distinctive |
| cloud-architect | python-package-manager | 0.580 | 0.372 | 0.218 | True | 0.580 | 0.580 | base+distinctive |
| cloud-architect | os-package-manager | 0.617 | 0.467 | 0.138 | True | 0.617 | 0.617 | base+distinctive |
| cloud-architect | nosql-database | 0.553 | 0.411 | 0.147 | True | 0.553 | 0.553 | base+distinctive |
| cloud-architect | frontend-framework | 0.593 | 0.682 | 0.000 | False | 0.593 | 0.000 |  |
| cloud-architect | javascript | 0.529 | 0.614 | 0.000 | False | 0.529 | 0.000 |  |
| data-analyst | analysis-language | 0.833 | 0.566 | 0.191 | True | 0.833 | 0.833 | base+distinctive |
| data-analyst | sql | 0.758 | 0.466 | 0.238 | True | 0.758 | 0.758 | base+distinctive |
| data-analyst | relational-database | 0.879 | 0.859 | 0.011 | False | 0.879 | 0.104 | base |
| data-analyst | public-cloud | 0.782 | 0.835 | 0.000 | False | 0.782 | 0.000 |  |
| data-analyst | html-css | 0.528 | 0.530 | 0.000 | False | 0.528 | 0.000 |  |
| data-engineer | data-engineering-python | 0.907 | 0.555 | 0.241 | True | 0.907 | 0.907 | base+distinctive |
| data-engineer | sql | 0.781 | 0.463 | 0.255 | True | 0.781 | 0.781 | base+distinctive |
| data-engineer | data-warehouse | 0.570 | 0.116 | 0.661 | True | 0.570 | 0.570 | base+distinctive |
| data-engineer | public-cloud | 0.884 | 0.832 | 0.030 | True | 0.884 | 0.282 | base+distinctive |
| data-engineer | server-framework | 0.823 | 0.677 | 0.097 | False | 0.823 | 0.823 | base |
| data-engineer | relational-database | 0.885 | 0.861 | 0.014 | False | 0.885 | 0.132 | base |
| data-engineer | python-package-manager | 0.659 | 0.369 | 0.282 | True | 0.659 | 0.659 | base+distinctive |
| data-engineer | container-runtime | 0.735 | 0.630 | 0.077 | False | 0.735 | 0.601 | base |
| data-engineer | shell | 0.599 | 0.414 | 0.182 | True | 0.599 | 0.599 | base+distinctive |
| data-scientist | analysis-language | 0.946 | 0.560 | 0.256 | True | 0.946 | 0.946 | base+distinctive |
| data-scientist | deep-learning-framework | 0.676 | 0.186 | 0.569 | True | 0.676 | 0.676 | base+distinctive |
| data-scientist | python-package-manager | 0.739 | 0.366 | 0.338 | True | 0.739 | 0.739 | base+distinctive |
| data-scientist | fastapi | 0.512 | 0.133 | 0.588 | True | 0.512 | 0.512 | base+distinctive |
| data-scientist | relational-database | 0.822 | 0.864 | 0.000 | False | 0.822 | 0.000 |  |
| data-scientist | container-runtime | 0.732 | 0.633 | 0.072 | False | 0.732 | 0.562 | base |
| data-scientist | public-cloud | 0.788 | 0.834 | 0.000 | True | 0.788 | 0.000 |  |
| data-scientist | sql | 0.618 | 0.464 | 0.143 | False | 0.618 | 0.618 | base |
| data-scientist | shell | 0.544 | 0.411 | 0.139 | False | 0.544 | 0.544 | base |
| data-scientist | frontend-framework | 0.549 | 0.683 | 0.000 | False | 0.549 | 0.000 |  |
| devops-sre | shell | 0.821 | 0.407 | 0.337 | True | 0.821 | 0.821 | base+distinctive |
| devops-sre | container-runtime | 0.919 | 0.628 | 0.188 | True | 0.919 | 0.919 | base+distinctive |
| devops-sre | relational-database | 0.949 | 0.857 | 0.051 | False | 0.949 | 0.512 | base |
| devops-sre | infrastructure-language | 0.843 | 0.609 | 0.161 | True | 0.843 | 0.843 | base+distinctive |
| devops-sre | container-orchestration | 0.630 | 0.186 | 0.545 | True | 0.630 | 0.630 | base+distinctive |
| devops-sre | infrastructure-as-code | 0.585 | 0.143 | 0.608 | True | 0.585 | 0.585 | base+distinctive |
| devops-sre | configuration-management | 0.525 | 0.090 | 0.706 | True | 0.525 | 0.525 | base+distinctive |
| devops-sre | monitoring | 0.576 | 0.209 | 0.467 | True | 0.576 | 0.576 | base+distinctive |
| devops-sre | os-package-manager | 0.695 | 0.461 | 0.202 | True | 0.695 | 0.695 | base+distinctive |
| devops-sre | public-cloud | 0.812 | 0.832 | 0.000 | True | 0.812 | 0.000 |  |
| devops-sre | python-package-manager | 0.627 | 0.369 | 0.259 | True | 0.627 | 0.627 | base+distinctive |
| devops-sre | sql | 0.573 | 0.467 | 0.102 | False | 0.573 | 0.573 | base |
| devops-sre | js-package-manager | 0.607 | 0.590 | 0.015 | False | 0.607 | 0.095 | base |
| devops-sre | frontend-framework | 0.600 | 0.684 | 0.000 | False | 0.600 | 0.000 |  |
| devops-sre | javascript | 0.569 | 0.610 | 0.000 | False | 0.569 | 0.000 |  |
| devops-sre | html-css | 0.521 | 0.529 | 0.000 | False | 0.521 | 0.000 |  |
| frontend-developer | javascript-language | 0.976 | 0.663 | 0.191 | True | 0.976 | 0.976 | base+distinctive |
| frontend-developer | frontend-framework | 0.950 | 0.656 | 0.183 | True | 0.950 | 0.950 | base+distinctive |
| frontend-developer | js-package-manager | 0.888 | 0.568 | 0.220 | True | 0.888 | 0.888 | base+distinctive |
| frontend-developer | html-css | 0.858 | 0.506 | 0.258 | True | 0.858 | 0.858 | base+distinctive |
| frontend-developer | js-bundler | 0.711 | 0.295 | 0.413 | True | 0.711 | 0.711 | base+distinctive |
| frontend-developer | nodejs | 0.678 | 0.451 | 0.201 | True | 0.678 | 0.678 | base+distinctive |
| frontend-developer | relational-database | 0.799 | 0.866 | 0.000 | False | 0.799 | 0.000 |  |
| frontend-developer | cross-platform-mobile | 0.531 | 0.273 | 0.321 | True | 0.531 | 0.531 | base+distinctive |
| frontend-developer | frontend-meta-framework | 0.504 | 0.271 | 0.300 | True | 0.504 | 0.504 | base+distinctive |
| frontend-developer | container-runtime | 0.568 | 0.642 | 0.000 | False | 0.568 | 0.000 |  |
| frontend-developer | public-cloud | 0.594 | 0.850 | 0.000 | False | 0.594 | 0.000 |  |
| full-stack-developer | javascript-language | 0.912 | 0.581 | 0.222 | True | 0.912 | 0.912 | base+distinctive |
| full-stack-developer | server-language | 0.972 | 0.931 | 0.021 | True | 0.972 | 0.219 | base+distinctive |
| full-stack-developer | html-css | 0.769 | 0.426 | 0.286 | True | 0.769 | 0.769 | base+distinctive |
| full-stack-developer | frontend-framework | 0.826 | 0.592 | 0.165 | True | 0.826 | 0.826 | base+distinctive |
| full-stack-developer | js-package-manager | 0.774 | 0.499 | 0.216 | True | 0.774 | 0.774 | base+distinctive |
| full-stack-developer | relational-database | 0.901 | 0.844 | 0.033 | True | 0.901 | 0.315 | base+distinctive |
| full-stack-developer | server-framework | 0.801 | 0.617 | 0.130 | True | 0.801 | 0.801 | base+distinctive |
| full-stack-developer | public-cloud | 0.821 | 0.822 | 0.000 | False | 0.821 | 0.000 |  |
| full-stack-developer | container-runtime | 0.711 | 0.606 | 0.080 | False | 0.711 | 0.604 | base |
| full-stack-developer | sql | 0.629 | 0.406 | 0.215 | True | 0.629 | 0.629 | base+distinctive |
| it-project-manager | relational-database | 0.911 | 0.859 | 0.030 | False | 0.911 | 0.285 | base |
| it-project-manager | sql | 0.596 | 0.468 | 0.120 | False | 0.596 | 0.596 | base |
| it-project-manager | html-css | 0.605 | 0.529 | 0.067 | False | 0.605 | 0.432 | base |
| it-project-manager | javascript | 0.632 | 0.613 | 0.016 | False | 0.632 | 0.104 | base |
| it-project-manager | public-cloud | 0.692 | 0.834 | 0.000 | False | 0.692 | 0.000 |  |
| it-project-manager | python | 0.596 | 0.550 | 0.040 | False | 0.596 | 0.251 | base |
| it-project-manager | container-runtime | 0.581 | 0.637 | 0.000 | False | 0.581 | 0.000 |  |
| it-project-manager | shell | 0.503 | 0.413 | 0.098 | False | 0.503 | 0.503 | base |
| it-project-manager | frontend-framework | 0.588 | 0.681 | 0.000 | False | 0.588 | 0.000 |  |
| it-project-manager | nodejs | 0.512 | 0.476 | 0.037 | False | 0.512 | 0.201 | base |
| it-project-manager | js-package-manager | 0.500 | 0.591 | 0.000 | False | 0.500 | 0.000 |  |
| mobile-app-developer | mobile-ide | 0.941 | 0.228 | 0.609 | True | 0.941 | 0.941 | base+distinctive |
| mobile-app-developer | mobile-native-language | 0.826 | 0.136 | 0.718 | True | 0.826 | 0.826 | base+distinctive |
| mobile-app-developer | sqlite | 0.650 | 0.330 | 0.327 | True | 0.650 | 0.650 | base+distinctive |
| mobile-app-developer | baas | 0.561 | 0.171 | 0.533 | True | 0.561 | 0.561 | base+distinctive |
| mobile-app-developer | cross-platform-mobile | 0.573 | 0.279 | 0.346 | True | 0.573 | 0.573 | base+distinctive |
| mobile-app-developer | jvm-build | 0.503 | 0.202 | 0.427 | True | 0.503 | 0.503 | base+distinctive |
| mobile-app-developer | frontend-framework | 0.675 | 0.687 | 0.000 | False | 0.675 | 0.000 |  |
| mobile-app-developer | os-package-manager | 0.574 | 0.463 | 0.107 | True | 0.574 | 0.574 | base+distinctive |
| mobile-app-developer | relational-database | 0.616 | 0.867 | 0.000 | False | 0.616 | 0.000 |  |
| mobile-app-developer | public-cloud | 0.586 | 0.847 | 0.000 | False | 0.586 | 0.000 |  |
| network-engineer | shell | 0.803 | 0.412 | 0.322 | True | 0.803 | 0.803 | base+distinctive |
| network-engineer | relational-database | 0.928 | 0.859 | 0.039 | False | 0.928 | 0.383 | base |
| network-engineer | container-runtime | 0.727 | 0.633 | 0.070 | False | 0.727 | 0.537 | base |
| network-engineer | python | 0.648 | 0.550 | 0.082 | False | 0.648 | 0.563 | base |
| network-engineer | sql | 0.608 | 0.466 | 0.132 | False | 0.608 | 0.608 | base |
| network-engineer | os-package-manager | 0.579 | 0.469 | 0.105 | True | 0.579 | 0.579 | base+distinctive |
| network-engineer | html-css | 0.601 | 0.530 | 0.063 | False | 0.601 | 0.404 | base |
| network-engineer | python-package-manager | 0.537 | 0.376 | 0.177 | True | 0.537 | 0.537 | base+distinctive |
| network-engineer | javascript | 0.570 | 0.611 | 0.000 | False | 0.570 | 0.000 |  |
| network-engineer | public-cloud | 0.565 | 0.837 | 0.000 | False | 0.565 | 0.000 |  |
| product-manager | public-cloud | 0.834 | 0.834 | 0.000 | False | 0.834 | 0.002 | base |
| product-manager | relational-database | 0.816 | 0.860 | 0.000 | False | 0.816 | 0.000 |  |
| product-manager | python | 0.626 | 0.548 | 0.066 | False | 0.626 | 0.439 | base |
| product-manager | sql | 0.584 | 0.467 | 0.111 | False | 0.584 | 0.584 | base |
| product-manager | javascript | 0.629 | 0.612 | 0.014 | False | 0.629 | 0.091 | base |
| product-manager | html-css | 0.598 | 0.527 | 0.063 | False | 0.598 | 0.399 | base |
| product-manager | frontend-framework | 0.627 | 0.682 | 0.000 | False | 0.627 | 0.000 |  |
| product-manager | container-runtime | 0.537 | 0.634 | 0.000 | False | 0.537 | 0.000 |  |
| software-architect | relational-database | 0.939 | 0.901 | 0.021 | True | 0.939 | 0.208 | base+distinctive |
| software-architect | server-language | 0.951 | 0.942 | 0.005 | False | 0.951 | 0.051 | base |
| software-architect | server-framework | 0.855 | 0.766 | 0.055 | True | 0.855 | 0.495 | base+distinctive |
| software-architect | container-runtime | 0.799 | 0.724 | 0.049 | True | 0.799 | 0.416 | base+distinctive |
| software-architect | public-cloud | 0.791 | 0.740 | 0.033 | True | 0.791 | 0.281 | base+distinctive |
| software-architect | frontend-framework | 0.760 | 0.682 | 0.054 | False | 0.760 | 0.434 | base |
| software-architect | shell | 0.669 | 0.539 | 0.107 | True | 0.669 | 0.669 | base+distinctive |
| software-architect | sql | 0.651 | 0.546 | 0.088 | True | 0.651 | 0.609 | base+distinctive |
| software-architect | javascript | 0.678 | 0.633 | 0.034 | False | 0.678 | 0.246 | base |
| software-architect | js-package-manager | 0.645 | 0.640 | 0.004 | False | 0.645 | 0.025 | base |
| software-architect | html-css | 0.608 | 0.578 | 0.025 | False | 0.608 | 0.162 | base |
| test-analyst | relational-database | 0.889 | 0.859 | 0.017 | False | 0.889 | 0.160 | base |
| test-analyst | container-runtime | 0.690 | 0.636 | 0.041 | False | 0.690 | 0.302 | base |
| test-analyst | python | 0.659 | 0.549 | 0.091 | False | 0.659 | 0.634 | base |
| test-analyst | shell | 0.596 | 0.413 | 0.181 | False | 0.596 | 0.596 | base |
| test-analyst | javascript | 0.615 | 0.614 | 0.001 | False | 0.615 | 0.008 | base |
| test-analyst | frontend-framework | 0.630 | 0.684 | 0.000 | False | 0.630 | 0.000 |  |
| test-analyst | nodejs | 0.526 | 0.478 | 0.048 | False | 0.526 | 0.265 | base |
| test-analyst | public-cloud | 0.601 | 0.835 | 0.000 | False | 0.601 | 0.000 |  |

## C・D. 達成率・内訳（compare-base-discount.mjs の出力）

## 統計ごとの β・d*

| 統計 | β | d* |
| --- | --- | --- |
| 現状 | 0.2137 | - |
| 固定0.1 | 0.2967 | 0.1 |
| dstar-0.02 | 0.2864 | 0.074321 |
| dstar | 0.2942 | 0.094321 |
| dstar+0.02 | 0.3029 | 0.114321 |

## 不変条件 1・2：内訳の合計と採用 unit

| Goal | 現状 基本/特有/base_total/内訳の合計 | 固定0.1 基本/特有/base_total/内訳の合計 | dstar-0.02 基本/特有/base_total/内訳の合計 | dstar 基本/特有/base_total/内訳の合計 | dstar+0.02 基本/特有/base_total/内訳の合計 |
| --- | --- | --- | --- | --- | --- |
| backend-developer | 9 / 15 / 6.387 / 100.0 | 6 / 15 / 2.800 / 100.0 | 6 / 15 / 3.200 / 100.0 | 6 / 15 / 2.954 / 100.0 | 6 / 15 / 2.449 / 100.0 |
| cloud-architect | 13 / 27 / 8.945 / 100.0 | 11 / 27 / 6.540 / 100.0 | 11 / 27 / 6.716 / 100.0 | 11 / 27 / 6.571 / 100.0 | 11 / 27 / 6.477 / 100.0 |
| data-analyst | 5 / 7 / 3.779 / 100.0 | 3 / 7 / 1.688 / 100.0 | 3 / 7 / 1.722 / 100.0 | 3 / 7 / 1.694 / 100.0 | 3 / 7 / 1.676 / 100.0 |
| data-engineer | 9 / 17 / 6.844 / 100.0 | 9 / 17 / 5.274 / 100.0 | 9 / 17 / 5.600 / 100.0 | 9 / 17 / 5.355 / 100.0 | 9 / 17 / 5.054 / 100.0 |
| data-scientist | 10 / 14 / 6.927 / 100.0 | 7 / 14 / 4.566 / 100.0 | 7 / 14 / 4.749 / 100.0 | 7 / 14 / 4.598 / 100.0 | 7 / 14 / 4.500 / 100.0 |
| devops-sre | 16 / 24 / 10.851 / 100.0 | 12 / 24 / 7.367 / 100.0 | 12 / 24 / 7.565 / 100.0 | 12 / 24 / 7.401 / 100.0 | 12 / 24 / 7.233 / 100.0 |
| frontend-developer | 11 / 13 / 8.056 / 100.0 | 8 / 13 / 6.096 / 100.0 | 8 / 13 / 6.096 / 100.0 | 8 / 13 / 6.096 / 100.0 | 8 / 13 / 6.096 / 100.0 |
| full-stack-developer | 10 / 20 / 8.116 / 100.0 | 9 / 20 / 5.784 / 100.0 | 9 / 20 / 6.100 / 100.0 | 9 / 20 / 5.849 / 100.0 | 9 / 20 / 5.650 / 100.0 |
| it-project-manager | 11 / 6 / 6.717 / 100.0 | 7 / 6 / 2.291 / 100.0 | 7 / 6 / 2.715 / 100.0 | 7 / 6 / 2.372 / 100.0 | 7 / 6 / 2.079 / 100.0 |
| mobile-app-developer | 10 / 14 / 6.506 / 100.0 | 7 / 14 / 4.629 / 100.0 | 7 / 14 / 4.629 / 100.0 | 7 / 14 / 4.629 / 100.0 | 7 / 14 / 4.591 / 100.0 |
| network-engineer | 10 / 18 / 6.567 / 100.0 | 8 / 18 / 4.306 / 100.0 | 8 / 18 / 4.854 / 100.0 | 8 / 18 / 4.413 / 100.0 | 8 / 18 / 4.034 / 100.0 |
| product-manager | 8 / 1 / 5.252 / 100.0 | 5 / 1 / 1.462 / 100.0 | 5 / 1 / 1.766 / 100.0 | 5 / 1 / 1.515 / 100.0 | 5 / 1 / 1.337 / 100.0 |
| software-architect | 11 / 18 / 8.345 / 100.0 | 11 / 18 / 3.429 / 100.0 | 11 / 18 / 4.260 / 100.0 | 11 / 18 / 3.595 / 100.0 | 11 / 18 / 3.041 / 100.0 |
| test-analyst | 8 / 1 / 5.206 / 100.0 | 6 / 1 / 1.888 / 100.0 | 6 / 1 / 2.189 / 100.0 | 6 / 1 / 1.966 / 100.0 | 6 / 1 / 1.726 / 100.0 |

## 代表的な入力での技術スキル層の達成率

| Goal | 入力 | 技術 | 現状 | 固定0.1 | dstar-0.02 | dstar | dstar+0.02 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| backend-developer | 中核 | java, spring-boot, postgresql, docker, aws | 58.4 | 64.6 | 66.1 | 64.7 | 64.2 |
| backend-developer | 共通のみ | javascript, html-css, react, npm | 18.7 | 0.0 | 0.0 | 0.0 | 0.0 |
| backend-developer | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| backend-developer | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| cloud-architect | 中核 | aws, azure, terraform, docker, kubernetes, python | 41.7 | 45.7 | 45.9 | 45.7 | 45.6 |
| cloud-architect | 共通のみ | javascript, html-css, sql | 4.7 | 0.0 | 0.0 | 0.0 | 0.0 |
| cloud-architect | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| cloud-architect | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| data-analyst | 中核 | python, pandas, sql, jupyter | 41.1 | 77.4 | 76.6 | 77.3 | 77.5 |
| data-analyst | 共通のみ | javascript, html-css, docker | 11.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| data-analyst | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| data-analyst | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| data-engineer | 中核 | python, sql, apache-spark, aws, docker, postgresql | 55.7 | 45.7 | 47.7 | 46.0 | 45.5 |
| data-engineer | 共通のみ | javascript, html-css, npm | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| data-engineer | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| data-engineer | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| data-scientist | 中核 | python, pandas, numpy, scikit-learn, jupyter | 12.8 | 17.4 | 16.9 | 17.3 | 17.5 |
| data-scientist | 共通のみ | sql, postgresql, docker, aws | 33.6 | 17.7 | 20.0 | 18.1 | 16.8 |
| data-scientist | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| data-scientist | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| devops-sre | 中核 | docker, kubernetes, terraform, aws, bash-shell, python | 41.5 | 47.5 | 46.7 | 47.4 | 48.1 |
| devops-sre | 共通のみ | javascript, html-css, sql | 12.0 | 5.5 | 5.4 | 5.5 | 4.9 |
| devops-sre | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| devops-sre | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| frontend-developer | 中核 | javascript, html-css, react, npm | 44.8 | 54.8 | 55.0 | 54.9 | 54.7 |
| frontend-developer | 共通のみ | python, sql, docker | 5.5 | 0.0 | 0.0 | 0.0 | 0.0 |
| frontend-developer | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| frontend-developer | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| full-stack-developer | 中核 | javascript, html-css, react, nodejs, postgresql, npm | 60.1 | 60.2 | 60.0 | 60.1 | 60.4 |
| full-stack-developer | 共通のみ | python, docker, aws | 24.5 | 9.8 | 11.9 | 10.3 | 8.8 |
| full-stack-developer | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| full-stack-developer | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| it-project-manager | 中核 | sql, python | 13.9 | 25.6 | 24.0 | 25.2 | 26.9 |
| it-project-manager | 共通のみ | javascript, html-css, npm | 20.3 | 15.5 | 17.9 | 15.9 | 14.8 |
| it-project-manager | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| it-project-manager | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| mobile-app-developer | 中核 | kotlin, swift, android-studio, xcode | 29.4 | 38.0 | 38.0 | 38.0 | 38.3 |
| mobile-app-developer | 共通のみ | javascript, html-css, sql | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| mobile-app-developer | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| mobile-app-developer | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| network-engineer | 中核 | bash-shell, python, powershell | 20.3 | 25.9 | 25.3 | 25.9 | 26.1 |
| network-engineer | 共通のみ | javascript, html-css | 14.0 | 6.2 | 7.5 | 6.5 | 5.8 |
| network-engineer | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| network-engineer | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| product-manager | 中核 | sql, python | 18.1 | 48.0 | 46.1 | 47.7 | 48.5 |
| product-manager | 共通のみ | javascript, html-css | 18.4 | 22.2 | 25.1 | 22.8 | 21.1 |
| product-manager | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| product-manager | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| software-architect | 中核 | python, postgresql, docker, aws, kubernetes, sql, bash-shell | 52.7 | 54.4 | 52.4 | 54.1 | 54.6 |
| software-architect | 共通のみ | javascript, html-css, react, npm | 25.3 | 16.8 | 18.4 | 17.0 | 16.4 |
| software-architect | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| software-architect | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| test-analyst | 中核 | python, javascript, java | 19.2 | 22.6 | 21.8 | 23.1 | 21.4 |
| test-analyst | 共通のみ | sql, html-css | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| test-analyst | 何も持たない | - | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| test-analyst | 採用unitすべて | (全メンバー) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |

## 本来必要な技術の内訳の割合（%）

| Goal | 技術 | 現状 | 固定0.1 | dstar-0.02 | dstar | dstar+0.02 |
| --- | --- | --- | --- | --- | --- | --- |
| data-scientist | sql | 7.0 | 9.5 | 9.3 | 9.5 | 9.6 |
| frontend-developer | javascript | 11.7 | 14.2 | 14.3 | 14.3 | 14.2 |
| data-analyst | sql | 20.0 | 37.5 | 37.1 | 37.4 | 37.6 |
| backend-developer | sql | 8.1 | 14.9 | 14.0 | 15.0 | 14.8 |

## 内訳の割合が 1% 未満の採用 unit（最後の統計）

- backend-developer: groovy(distinctive 0.45), nosql-database(distinctive 0.25)
- cloud-architect: apache-spark(distinctive 0.79), make(distinctive 0.72), virtualization(distinctive 0.46), cargo(distinctive 0.41), rust(distinctive 0.32), quarkus(distinctive 0.22), mlflow(distinctive 0.21), hadoop(distinctive 0.21), databricks(distinctive 0.21), ruby(distinctive 0.11), ruby-on-rails(distinctive 0.07)
- data-analyst: apache-spark(distinctive 0.94)
- data-engineer: rstudio(distinctive 0.69), r(distinctive 0.65), mlflow(distinctive 0.40), tidyverse(distinctive 0.25), vba(distinctive 0.21)
- data-scientist: django(distinctive 0.81), hadoop(distinctive 0.74)
- devops-sre: flask(distinctive 0.84), make(distinctive 0.83), fastapi(distinctive 0.80), js-package-manager(base 0.76), virtualization(distinctive 0.73), lua(distinctive 0.57), cloudflare(distinctive 0.51), django(distinctive 0.32), perl(distinctive 0.31), hadoop(distinctive 0.29), quarkus(distinctive 0.15), nosql-database(distinctive 0.05)
- frontend-developer: nosql-database(distinctive 0.48), nestjs(distinctive 0.14)
- full-stack-developer: composer(distinctive 0.84), vps-hosting(distinctive 0.81), nuget(distinctive 0.70), dotnet-runtime(distinctive 0.55), cloudflare(distinctive 0.45), baas(distinctive 0.27), jquery(distinctive 0.18), dart(distinctive 0.15)
- mobile-app-developer: java(distinctive 0.78), ktor(distinctive 0.66), groovy(distinctive 0.64), nosql-database(distinctive 0.34)
- network-engineer: lua(distinctive 0.99), gtk(distinctive 0.97), native-compiler(distinctive 0.58), laravel(distinctive 0.47)
- product-manager: public-cloud(base 0.08)
- software-architect: server-language(base 0.96), configuration-management(distinctive 0.95), groovy(distinctive 0.94), infrastructure-as-code(distinctive 0.77), js-package-manager(base 0.47)
- test-analyst: javascript(base 0.26)

