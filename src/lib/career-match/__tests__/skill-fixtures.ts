import type { SkillStatistics, SkillStatisticsUnit, SkillUnitRole } from "../types";

// selected = false の unit は基本リストにも特有リストにも入らない（重みは 0）
export function unit(
  unitId: string,
  memberIds: string[],
  baseWeight: number,
  selected = true,
  distinctiveWeight = 0,
): SkillStatisticsUnit {
  const base_weight = selected ? baseWeight : 0;
  const distinctive_weight = selected ? distinctiveWeight : 0;
  if (selected && base_weight <= 0 && distinctive_weight <= 0) {
    throw new Error(`unit ${unitId}: selected unit needs a positive weight`);
  }
  const roles: SkillUnitRole[] = [
    ...(base_weight > 0 ? (["base"] as const) : []),
    ...(distinctive_weight > 0 ? (["distinctive"] as const) : []),
  ];
  return {
    unit_id: unitId,
    type: memberIds.length > 1 ? "group" : "skill",
    name: unitId,
    members: memberIds.map((id) => ({
      skill_id: id,
      name: id,
      so_item: id,
      p_skill_given_goal: 0.5,
      region_p_skill_given_goal: 0.5,
    })),
    source_years: [2025],
    goal_respondents: 1000,
    other_respondents: 10000,
    p_skill_given_goal: 0.5,
    p_skill_given_other: 0.3,
    region_source_years: [2025],
    region_goal_respondents: 50,
    region_other_respondents: 500,
    region_p_skill_given_goal: 0.5,
    region_p_skill_given_other: 0.3,
    quantity: 0.5,
    quality: 62.5,
    contribution: baseWeight,
    p_value: selected ? 1e-10 : 0.5,
    significant: selected,
    roles,
    base_weight,
    distinctive_weight,
    selected,
  };
}

export function skillStatistics(
  goalId: string,
  units: SkillStatisticsUnit[],
  distinctiveShare = 0.2,
): SkillStatistics {
  return {
    goal_id: goalId,
    mapping_status: "exact",
    devtypes: {},
    source: "stackoverflow_developer_survey",
    source_years: [2025],
    license: {
      name: "Open Database License (ODbL) v1.0",
      url: "https://opendatacommons.org/licenses/odbl/1-0/",
      contents_license: "Database Contents License (DbCL) v1.0",
      contents_url: "https://opendatacommons.org/licenses/dbcl/1-0/",
      attribution: "Contains information from the Stack Overflow Developer Survey.",
      modifications: "Aggregated by 8FitLab.",
    },
    calculation_version: "0.8.0",
    groups_version: "1.4.0",
    calculation_date: "2026-09-29",
    min_reliable_sample: 100,
    region: { country: "Japan", method: "empirical_bayes_beta_binomial", prior_strength: 80 },
    selection: {
      alpha: 0.05,
      correction: "bonferroni",
      significance_scope: "world",
      base_min_share: 0.5,
      base_discount_d_ref: 0.1,
      base_discount_d_ref_method: "logistic-p50",
      base_discount_d_ref_n_units: 100,
      base_discount_d_ref_n_significant: 50,
      distinctive_share: distinctiveShare,
      distinctive_share_goals: [goalId],
      weight_scope: "region",
    },
    skill_split: {
      base_total: units.reduce((sum, u) => sum + u.base_weight, 0),
      distinctive_total: units.reduce((sum, u) => sum + u.distinctive_weight, 0),
    },
    units,
  };
}
