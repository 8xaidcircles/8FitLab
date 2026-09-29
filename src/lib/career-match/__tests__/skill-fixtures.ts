import type { SkillStatistics, SkillStatisticsUnit } from "../types";

export function unit(unitId: string, memberIds: string[], contribution: number, selected = true): SkillStatisticsUnit {
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
    contribution,
    p_value: selected ? 1e-10 : 0.5,
    significant: selected,
    selected,
  };
}

export function skillStatistics(goalId: string, units: SkillStatisticsUnit[]): SkillStatistics {
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
    calculation_version: "0.3.0",
    calculation_date: "2026-09-29",
    min_reliable_sample: 100,
    region: { country: "Japan", method: "empirical_bayes_beta_binomial", prior_strength: 80 },
    selection: {
      alpha: 0.05,
      correction: "bonferroni",
      significance_scope: "world",
      cumulative_share: 0.8,
      contribution_scope: "region",
    },
    units,
  };
}
