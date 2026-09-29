"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { submitAssessment } from "@/app/actions/assessment";
import type { EducationMaster, RoleGroup } from "@/lib/career-match/data";
import { SUBMIT_ERRORS } from "@/lib/labels";
import { track } from "@/lib/track";

interface Option {
  id: string;
  name: string;
  description?: string;
}

interface OptionGroup {
  id: string;
  name: string;
  options: Option[];
}

interface Props {
  goals: { goal_id: string; name: string; summary: string }[];
  /** Goal に関係するスキル・ツール・資格の ID */
  relevantByGoal: Record<string, string[]>;
  techGroups: OptionGroup[];
  humanGroups: OptionGroup[];
  toolGroups: OptionGroup[];
  certifications: Option[];
  roleGroups: RoleGroup[];
  allRoles: { role_id: string; label: string }[];
  education: EducationMaster;
  initialGoal: string | null;
}

interface ExperienceRow {
  key: number;
  role_id: string;
  years: string;
  searching: boolean;
  query: string;
}

const OTHER_ROLE = "__other__";

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 md:p-6">
      <div className="flex items-baseline gap-3">
        <span className="bg-brand-gradient inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-ink">
          {step}
        </span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const selectClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm focus:border-sky focus:ring-2 focus:ring-sky/30 focus:outline-none";

function ChipGroups({
  title,
  groups,
  selected,
  visible,
  onToggle,
}: {
  title?: string;
  groups: OptionGroup[];
  selected: ReadonlySet<string>;
  visible: (option: Option) => boolean;
  onToggle: (id: string) => void;
}) {
  const shown = groups
    .map((group) => ({ ...group, options: group.options.filter(visible) }))
    .filter((group) => group.options.length > 0);
  if (shown.length === 0) return null;
  return (
    <div>
      {title && <h3 className="mb-3 text-sm font-bold">{title}</h3>}
      <div className="space-y-4">
        {shown.map((group) => (
          <fieldset key={group.id}>
            <legend className="mb-2 text-xs font-bold text-muted">{group.name}</legend>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => {
                const on = selected.has(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onToggle(option.id)}
                    aria-pressed={on}
                    title={option.description}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      on
                        ? "border-cyan bg-cyan-soft font-bold text-ink"
                        : "border-line bg-white text-muted hover:border-sky hover:text-ink"
                    }`}
                  >
                    {on && <span aria-hidden="true">✓ </span>}
                    {option.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function AssessmentForm({
  goals,
  relevantByGoal,
  techGroups,
  humanGroups,
  toolGroups,
  certifications,
  roleGroups,
  allRoles,
  education,
  initialGoal,
}: Props) {
  const router = useRouter();
  const datalistId = useId();
  const [goalId, setGoalId] = useState<string | null>(initialGoal);
  const [skills, setSkills] = useState<Set<string>>(new Set());
  const [certs, setCerts] = useState<Set<string>>(new Set());
  const [onlyGoalSkills, setOnlyGoalSkills] = useState(true);
  const [query, setQuery] = useState("");
  const [experiences, setExperiences] = useState<ExperienceRow[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [levelId, setLevelId] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const roleByLabel = useMemo(() => new Map(allRoles.map((r) => [r.label, r.role_id])), [allRoles]);
  const jaRoleIds = useMemo(() => new Set(roleGroups.flatMap((g) => g.roles.map((r) => r.role_id))), [roleGroups]);
  const relevant = useMemo(() => new Set(goalId ? relevantByGoal[goalId] : []), [goalId, relevantByGoal]);
  const normalizedQuery = query.trim().toLowerCase();
  // 選択済みのものは、絞り込みで隠れても外せるよう常に表示する
  const visible = (option: Option, selected: ReadonlySet<string>) =>
    selected.has(option.id) ||
    ((!goalId || !onlyGoalSkills || relevant.has(option.id)) &&
      (!normalizedQuery || option.name.toLowerCase().includes(normalizedQuery)));
  // 資格は Goal で絞り込まない（一般的な資格を持っている人が選べないため）。Goal を選んだら、関係する資格を先に分けて示す
  const visibleCertification = (option: Option) =>
    certs.has(option.id) || !normalizedQuery || option.name.toLowerCase().includes(normalizedQuery);
  const certificationGroups: OptionGroup[] = goalId
    ? [
        {
          id: "goal-certifications",
          name: "このGoalに関係する資格",
          options: certifications.filter((o) => relevant.has(o.id)),
        },
        {
          id: "other-certifications",
          name: "その他の資格（このGoalの計算とSkill Gapには影響しません）",
          options: certifications.filter((o) => !relevant.has(o.id)),
        },
      ]
    : [{ id: "certifications", name: "取得済みの資格", options: certifications }];
  const level = education.levels.find((l) => l.level_id === levelId);
  const fields = education.fields.filter((f) => f.levels.includes(levelId));

  function selectGoal(id: string) {
    setGoalId(id);
    track("goal_selected", { goal_id: id });
  }

  function toggleSkill(skillId: string) {
    track(skills.has(skillId) ? "skill_removed" : "skill_added", { skill_id: skillId, goal_id: goalId });
    setSkills((prev) => toggled(prev, skillId));
  }

  function toggleCertification(certId: string) {
    track(certs.has(certId) ? "skill_removed" : "skill_added", { cert_id: certId, goal_id: goalId });
    setCerts((prev) => toggled(prev, certId));
  }

  function updateExperience(key: number, patch: Partial<ExperienceRow>) {
    setExperiences((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function chooseRole(key: number, roleId: string) {
    if (roleId === OTHER_ROLE) {
      updateExperience(key, { searching: true, role_id: "", query: "" });
      return;
    }
    updateExperience(key, { role_id: roleId, searching: false });
    if (roleId) track("experience_added", { role_id: roleId });
  }

  function searchRole(key: number, query: string) {
    const roleId = roleByLabel.get(query) ?? "";
    updateExperience(key, { query, role_id: roleId });
    if (roleId) track("experience_added", { role_id: roleId });
  }

  function chooseLevel(id: string) {
    setLevelId(id);
    setFieldId("");
    if (id) track("education_added", { education_level_id: id });
  }

  const validExperiences = experiences
    .filter((e) => e.role_id && Number(e.years) > 0)
    .map((e) => ({ role_id: e.role_id, years: Number(e.years) }));
  const incompleteExperience = experiences.some((e) => (e.role_id === "") !== (e.years === "") || (e.searching && !e.role_id && e.query));

  function submit() {
    if (!goalId) return;
    setError(null);
    startTransition(async () => {
      const result = await submitAssessment({
        goal_id: goalId,
        skill_ids: [...skills],
        certification_ids: [...certs],
        experiences: validExperiences,
        education_level_id: levelId || null,
        field_id: fieldId || null,
      });
      if (result.ok) {
        router.push(`/career-match/result/${result.assessmentId}`);
      } else {
        setError(SUBMIT_ERRORS[result.error] ?? "入力内容を確認してください。");
      }
    });
  }

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Section step={1} title="目指すGoal">
        <div className="grid gap-2 sm:grid-cols-2">
          {goals.map((goal) => {
            const selected = goal.goal_id === goalId;
            return (
              <button
                key={goal.goal_id}
                type="button"
                onClick={() => selectGoal(goal.goal_id)}
                aria-pressed={selected}
                className={`rounded-xl border p-3 text-left transition ${
                  selected ? "border-indigo bg-indigo-soft ring-2 ring-indigo/20" : "border-line hover:border-sky"
                }`}
              >
                <span className={`block text-sm font-bold ${selected ? "text-indigo" : ""}`}>{goal.name}</span>
                <span className="mt-0.5 block text-xs text-muted">{goal.summary}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section step={2} title="持っているスキル" hint="実務・学習を問わず、基本的な使い方がわかるものを選んでください。">
        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="スキル・ツール・資格を検索（例: Laravel）"
            aria-label="スキル・ツール・資格を検索"
            className={selectClass}
          />
          {goalId && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyGoalSkills}
                onChange={(e) => setOnlyGoalSkills(e.target.checked)}
                className="size-4 accent-indigo"
              />
              選んだGoalに関係するものだけ表示
            </label>
          )}
        </div>
        <div className="space-y-6">
          <ChipGroups
            title="技術（言語・フレームワーク・データベース・クラウドなど）"
            groups={techGroups}
            selected={skills}
            visible={(o) => visible(o, skills)}
            onToggle={toggleSkill}
          />
          <ChipGroups
            title="手法・知識"
            groups={humanGroups}
            selected={skills}
            visible={(o) => visible(o, skills)}
            onToggle={toggleSkill}
          />
          <ChipGroups
            title="使っているツール"
            groups={toolGroups}
            selected={skills}
            visible={(o) => visible(o, skills)}
            onToggle={toggleSkill}
          />
        </div>
        <p className="mt-4 text-xs text-muted">選択中：{skills.size}件</p>
      </Section>

      <Section
        step={3}
        title="資格"
        hint="取得済みの資格を選んでください（任意）。資格が証明するスキルを持っているものとして計算します。"
      >
        <ChipGroups
          groups={certificationGroups}
          selected={certs}
          visible={visibleCertification}
          onToggle={toggleCertification}
        />
        {certifications.every((o) => !visibleCertification(o)) && (
          <p className="text-sm text-muted">条件に合う資格はありません。</p>
        )}
        <p className="mt-4 text-xs text-muted">選択中：{certs.size}件</p>
      </Section>

      <Section step={4} title="職歴" hint="これまでの職種と経験年数を追加してください（任意）。同じ職種は合算して計算します。">
        <datalist id={datalistId}>
          {allRoles
            .filter((r) => !jaRoleIds.has(r.role_id))
            .map((r) => (
              <option key={r.role_id} value={r.label} />
            ))}
        </datalist>
        <div className="space-y-3">
          {experiences.map((row) => (
            <div key={row.key} className="grid gap-2 rounded-xl bg-mist p-3 sm:grid-cols-[1fr_7rem_auto]">
              {row.searching ? (
                <input
                  list={datalistId}
                  value={row.query}
                  onChange={(e) => searchRole(row.key, e.target.value)}
                  placeholder="職種を英語で検索（例: sales）"
                  aria-label="職種（英語で検索）"
                  className={selectClass}
                />
              ) : (
                <select
                  value={row.role_id}
                  onChange={(e) => chooseRole(row.key, e.target.value)}
                  aria-label="職種"
                  className={selectClass}
                >
                  <option value="">職種を選択</option>
                  {roleGroups.map((group) => (
                    <optgroup key={group.group_id} label={group.name}>
                      {group.roles.map((role) => (
                        <option key={role.role_id} value={role.role_id}>
                          {role.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value={OTHER_ROLE}>その他の職種（英語名で検索）</option>
                </select>
              )}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={50}
                  step={0.5}
                  value={row.years}
                  onChange={(e) => updateExperience(row.key, { years: e.target.value })}
                  aria-label="経験年数"
                  placeholder="1.5"
                  className={selectClass}
                />
                <span className="text-sm text-muted">年</span>
              </div>
              <button
                type="button"
                onClick={() => setExperiences((rows) => rows.filter((r) => r.key !== row.key))}
                className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white hover:text-coral"
              >
                削除
              </button>
              {row.searching && row.query && !row.role_id && (
                <p className="text-xs text-coral sm:col-span-3">候補から職種を選んでください。</p>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setExperiences((rows) => [...rows, { key: nextKey, role_id: "", years: "", searching: false, query: "" }]);
            setNextKey((k) => k + 1);
          }}
          className="mt-3 rounded-full border border-dashed border-sky px-4 py-2 text-sm font-bold text-indigo hover:bg-sky-soft"
        >
          ＋ 職歴を追加
        </button>
      </Section>

      <Section
        step={5}
        title="最終学歴"
        hint="最後に卒業（修了）した学校を選んでください。学歴・専攻分野とも任意です。"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={levelId} onChange={(e) => chooseLevel(e.target.value)} aria-label="最終学歴" className={selectClass}>
            <option value="">学歴を選択（任意）</option>
            {education.levels.map((l) => (
              <option key={l.level_id} value={l.level_id}>
                {l.name}
              </option>
            ))}
          </select>
          {level?.field_selectable && (
            <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} aria-label="専攻分野" className={selectClass}>
              <option value="">{level.level_id === "high-school" ? "学科を選択（任意）" : "専攻分野を選択（任意）"}</option>
              {fields.map((f) => (
                <option key={f.field_id} value={f.field_id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </Section>

      <div className="sticky bottom-4 rounded-2xl border border-line bg-white/95 p-4 shadow-lg backdrop-blur">
        {error && <p className="mb-3 text-sm text-coral">{error}</p>}
        {incompleteExperience && <p className="mb-3 text-xs text-flame">職種と年数の両方が入力された職歴だけが計算に使われます。</p>}
        <button
          type="submit"
          disabled={!goalId || pending}
          className="w-full rounded-full bg-indigo py-3 font-bold text-white shadow-lg shadow-indigo/20 transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "計算しています…" : goalId ? "Career Matchを計算する" : "Goalを選んでください"}
        </button>
      </div>
    </form>
  );
}
