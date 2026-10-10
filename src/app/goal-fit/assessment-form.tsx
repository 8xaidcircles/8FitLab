"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { submitAssessment } from "@/app/actions/assessment";
import type { EducationMaster, RoleGroup } from "@/lib/career-match/data";
import {
  EXPERIENCE_STATUSES,
  SKIPPED_EDUCATION_LEVEL_ID,
  type CertificationStatus,
  type ExperienceStatus,
  type SkillStatus,
} from "@/lib/career-match/types";
import {
  CERTIFICATION_STATUS_LABELS,
  EDUCATION_STATUS_LABELS,
  EXPERIENCE_STATUS_LABELS,
  MISSING_INPUT_SUMMARIES,
  SKILL_STATUS_LABELS,
  SUBMIT_ERRORS,
} from "@/lib/labels";
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
  certificationGroups: OptionGroup[];
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

function Section({
  step,
  title,
  hint,
  required,
  error,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border bg-white p-5 md:p-6 ${error ? "border-coral" : "border-line"}`}>
      <div className="flex items-baseline gap-3">
        <span className="bg-brand-gradient inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-ink">
          {step}
        </span>
        <h2 className="text-lg font-bold">{title}</h2>
        {required && <span className="rounded bg-coral/10 px-1.5 py-0.5 text-[10px] font-bold text-red-700">必須</span>}
      </div>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-coral">
          {error}
        </p>
      )}
    </section>
  );
}

const selectClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm focus:border-sky focus:ring-2 focus:ring-sky/30 focus:outline-none";

/** カテゴリーごとのアコーディオン。検索中（expandAll）は一致したものが見えるよう全カテゴリーを開く */
function ChipGroups({
  title,
  hint,
  groups,
  selected,
  visible,
  onToggle,
  expandAll,
  marked,
  disabled = false,
}: {
  title?: string;
  hint?: string;
  groups: OptionGroup[];
  selected: ReadonlySet<string>;
  visible: (option: Option) => boolean;
  onToggle: (id: string) => void;
  expandAll: boolean;
  /** ★を付けて各カテゴリーの先頭に並べる選択肢 */
  marked?: (option: Option) => boolean;
  /** 「回答をスキップする」などを選んでいる間は個別に選べない */
  disabled?: boolean;
}) {
  const baseId = useId();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const shown = groups
    .map((group) => {
      const options = group.options.filter(visible);
      if (marked) options.sort((a, b) => Number(marked(b)) - Number(marked(a)));
      return { ...group, options };
    })
    .filter((group) => group.options.length > 0);
  if (shown.length === 0) return null;
  return (
    <div>
      {title && <h3 className={`text-sm font-bold ${hint ? "mb-1" : "mb-3"}`}>{title}</h3>}
      {hint && <p className="mb-3 text-xs text-muted">{hint}</p>}
      <div className="divide-y divide-line rounded-xl border border-line">
        {shown.map((group) => {
          const expanded = expandAll || open.has(group.id);
          const selectedCount = group.options.filter((o) => selected.has(o.id)).length;
          const markedCount = marked ? group.options.filter(marked).length : 0;
          const panelId = `${baseId}-${group.id}`;
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => setOpen((prev) => toggled(prev, group.id))}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-mist"
              >
                <span className="flex-1 font-bold">
                  {group.name}
                  <span className="ml-1 text-xs font-normal text-muted">（{group.options.length}）</span>
                </span>
                {markedCount > 0 && <span className="text-xs font-bold text-flame">★ {markedCount}</span>}
                {selectedCount > 0 && (
                  <span className="rounded-full bg-cyan-soft px-2 py-0.5 text-xs font-bold text-ink">
                    ✓ {selectedCount}件選択
                  </span>
                )}
                <span className={`text-muted transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true">
                  ▾
                </span>
              </button>
              <div
                id={panelId}
                role="group"
                aria-label={group.name}
                className={`${expanded ? "grid" : "hidden"} grid-cols-3 gap-2 px-3 pb-3 min-[480px]:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7`}
              >
                {group.options.map((option) => {
                  const on = selected.has(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onToggle(option.id)}
                      aria-pressed={on}
                      disabled={disabled}
                      title={option.description}
                      className={`flex min-h-10 items-center justify-center rounded-lg border px-1.5 py-1.5 text-center text-xs leading-snug [overflow-wrap:anywhere] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        on
                          ? "border-cyan bg-cyan-soft font-bold text-ink"
                          : "border-line bg-white text-muted enabled:hover:border-sky enabled:hover:text-ink"
                      }`}
                    >
                      <span>
                        {on && <span aria-hidden="true">✓ </span>}
                        {marked?.(option) && (
                          <span className="text-flame" aria-label="このGoalに関係">
                            ★
                          </span>
                        )}
                        {option.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 職種のドロップダウン。IT 職種は常に表示し、IT 以外はカテゴリーごとのアコーディオンで開く */
function RoleSelect({
  roleGroups,
  value,
  onChoose,
}: {
  roleGroups: RoleGroup[];
  value: string;
  onChoose: (roleId: string) => void;
}) {
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const selectedGroup = roleGroups.find((g) => g.roles.some((r) => r.role_id === value));
  const selectedName = selectedGroup?.roles.find((r) => r.role_id === value)?.name;
  const itGroups = roleGroups.filter((g) => g.category === "it");
  const otherGroups = roleGroups.filter((g) => g.category === "other");

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function toggleOpen() {
    // 選択中の職種が IT 以外なら、そのカテゴリーを開いた状態で表示する
    if (!open && selectedGroup?.category === "other") setExpanded((prev) => new Set(prev).add(selectedGroup.group_id));
    setOpen((o) => !o);
  }

  function choose(roleId: string) {
    onChoose(roleId);
    setOpen(false);
  }

  const roleButtons = (group: RoleGroup) =>
    group.roles.map((role) => {
      const on = role.role_id === value;
      return (
        <li key={role.role_id}>
          <button
            type="button"
            onClick={() => choose(role.role_id)}
            aria-current={on ? "true" : undefined}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm ${on ? "bg-cyan-soft font-bold text-ink" : "hover:bg-mist"}`}
          >
            {on && <span aria-hidden="true">✓ </span>}
            {role.name}
          </button>
        </li>
      );
    });

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={`${baseId}-panel`}
        aria-label={selectedName ? `職種：${selectedName}` : "職種を選択"}
        className={`${selectClass} flex items-center gap-2 text-left`}
      >
        <span className={`flex-1 truncate ${selectedName ? "" : "text-muted"}`}>{selectedName ?? "職種を選択"}</span>
        <span className={`text-muted transition ${open ? "rotate-180" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div
          id={`${baseId}-panel`}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-96 overflow-y-auto rounded-xl border border-line bg-white p-2 shadow-lg"
        >
          {itGroups.map((group) => (
            <div key={group.group_id} className="mb-2">
              <p className="px-3 pt-2 pb-1 text-xs font-bold text-muted">{group.name}</p>
              <ul>{roleButtons(group)}</ul>
            </div>
          ))}
          {otherGroups.length > 0 && (
            <div className="mt-2 border-t border-line pt-2">
              <p className="px-3 pt-1 pb-2 text-xs font-bold text-muted">IT以外の職種</p>
              <div className="divide-y divide-line rounded-lg border border-line">
                {otherGroups.map((group) => {
                  const isOpen = expanded.has(group.group_id);
                  const panelId = `${baseId}-${group.group_id}`;
                  const hasSelected = group.group_id === selectedGroup?.group_id;
                  return (
                    <div key={group.group_id}>
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => toggled(prev, group.group_id))}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-mist"
                      >
                        <span className="flex-1 font-bold">
                          {group.name}
                          <span className="ml-1 text-xs font-normal text-muted">（{group.roles.length}）</span>
                        </span>
                        {hasSelected && (
                          <span className="rounded-full bg-cyan-soft px-2 py-0.5 text-xs font-bold text-ink">✓ 選択中</span>
                        )}
                        <span className={`text-muted transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true">
                          ▾
                        </span>
                      </button>
                      <ul id={panelId} className={isOpen ? "px-1 pb-2" : "hidden"}>
                        {roleButtons(group)}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => choose(OTHER_ROLE)}
            className="mt-2 w-full rounded-lg border-t border-line px-3 py-2.5 text-left text-sm font-bold text-indigo hover:bg-sky-soft"
          >
            リストに無い職種を検索（日本語・英語）
          </button>
        </div>
      )}
    </div>
  );
}

/** 個別の選択肢の代わりに選ぶもの（どれか 1 つ。選んでいる項目をもう一度押すと外れ、個別の選択肢を選べるようになる） */
function StatusChoice<K extends string>({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: Record<K, string>;
  value: K | null;
  onChange: (value: K | null) => void;
}) {
  const count = Object.keys(options).length;
  const columns = count > 2 ? "sm:grid-cols-3" : count === 2 ? "sm:grid-cols-2" : "";
  return (
    <div>
      <div role="radiogroup" aria-label={label} className={`grid gap-2 ${columns}`}>
        {(Object.entries(options) as [K, string][]).map(([key, text]) => {
          const on = value === key;
          return (
            <label
              key={key}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                on ? "border-indigo bg-indigo-soft font-bold text-indigo" : "border-line hover:border-sky"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={key}
                checked={on}
                onChange={() => onChange(key)}
                onClick={() => {
                  if (on) onChange(null);
                }}
                className="size-4 shrink-0 accent-indigo"
              />
              {text}
            </label>
          );
        })}
      </div>
      {value && <p className="mt-2 text-xs text-muted">個別に選び直すときは、選択中の項目をもう一度押してください。</p>}
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
  certificationGroups,
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
  const [skillStatus, setSkillStatus] = useState<SkillStatus | null>(null);
  const [certStatus, setCertStatus] = useState<CertificationStatus | null>(null);
  const [onlyGoalSkills, setOnlyGoalSkills] = useState(true);
  const [query, setQuery] = useState("");
  const [experienceStatus, setExperienceStatus] = useState<ExperienceStatus | null>(null);
  const [experiences, setExperiences] = useState<ExperienceRow[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [levelId, setLevelId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ skills?: string; certifications?: string; experience?: string; education?: string }>(
    {},
  );
  const [pending, startTransition] = useTransition();

  // 検索は日本語表示名（日本語職種リスト）と ESCO の英語名のどちらでも選べる
  const jaRoles = useMemo(() => roleGroups.flatMap((g) => g.roles), [roleGroups]);
  const roleByLabel = useMemo(
    () => new Map([...allRoles.map((r) => [r.label, r.role_id] as const), ...jaRoles.map((r) => [r.name, r.role_id] as const)]),
    [allRoles, jaRoles],
  );
  const jaRoleIds = useMemo(() => new Set(jaRoles.map((r) => r.role_id)), [jaRoles]);
  const relevant = useMemo(() => new Set(goalId ? relevantByGoal[goalId] : []), [goalId, relevantByGoal]);
  const normalizedQuery = query.trim().toLowerCase();
  // 選択済みのものは、絞り込みで隠れても外せるよう常に表示する
  const visible = (option: Option, selected: ReadonlySet<string>) =>
    selected.has(option.id) ||
    ((!goalId || !onlyGoalSkills || relevant.has(option.id)) &&
      (!normalizedQuery || option.name.toLowerCase().includes(normalizedQuery)));
  // 資格は Goal で絞り込まない（一般的な資格を持っている人が選べないため）。Goal を選んだら、関係する資格に★を付けて先に並べる
  const visibleCertification = (option: Option) =>
    certs.has(option.id) || !normalizedQuery || option.name.toLowerCase().includes(normalizedQuery);
  const markedCertification = goalId ? (option: Option) => relevant.has(option.id) : undefined;
  function selectGoal(id: string) {
    setGoalId(id);
    track("goal_selected", { goal_id: id });
  }

  function toggleSkill(skillId: string) {
    track(skills.has(skillId) ? "skill_removed" : "skill_added", { skill_id: skillId, goal_id: goalId });
    setSkills((prev) => toggled(prev, skillId));
    setFieldErrors((errors) => ({ ...errors, skills: undefined }));
  }

  function toggleCertification(certId: string) {
    track(certs.has(certId) ? "skill_removed" : "skill_added", { cert_id: certId, goal_id: goalId });
    setCerts((prev) => toggled(prev, certId));
    setFieldErrors((errors) => ({ ...errors, certifications: undefined }));
  }

  function chooseSkillStatus(status: SkillStatus | null) {
    setSkillStatus(status);
    if (status) setSkills(new Set());
    setFieldErrors((errors) => ({ ...errors, skills: undefined }));
  }

  function chooseCertificationStatus(status: CertificationStatus | null) {
    setCertStatus(status);
    if (status) setCerts(new Set());
    setFieldErrors((errors) => ({ ...errors, certifications: undefined }));
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

  function addExperienceRow() {
    setExperiences((rows) => [...rows, { key: nextKey, role_id: "", years: "", searching: false, query: "" }]);
    setNextKey((k) => k + 1);
  }

  function chooseExperienceStatus(status: ExperienceStatus) {
    setExperienceStatus(status);
    setFieldErrors((errors) => ({ ...errors, experience: undefined }));
    if (status === "entered" && experiences.length === 0) addExperienceRow();
  }

  function chooseLevel(id: string) {
    setLevelId(id);
    setFieldErrors((errors) => ({ ...errors, education: undefined }));
    if (id) track("education_added", { education_level_id: id });
  }

  const educationSkipped = levelId === SKIPPED_EDUCATION_LEVEL_ID;

  const validExperiences = experiences
    .filter((e) => e.role_id && Number(e.years) > 0)
    .map((e) => ({ role_id: e.role_id, years: Number(e.years) }));
  const incompleteExperience =
    experienceStatus === "entered" &&
    experiences.some((e) => (e.role_id === "") !== (e.years === "") || (e.searching && !e.role_id && e.query));

  function submit() {
    if (!goalId) return;
    setError(null);
    const errors = {
      skills: skills.size > 0 || skillStatus ? undefined : SUBMIT_ERRORS.skills_required,
      certifications: certs.size > 0 || certStatus ? undefined : SUBMIT_ERRORS.certifications_required,
      experience: !experienceStatus
        ? SUBMIT_ERRORS.experience_required
        : experienceStatus === "entered" && validExperiences.length === 0
          ? SUBMIT_ERRORS.experience_rows_required
          : undefined,
      education: levelId ? undefined : SUBMIT_ERRORS.education_required,
    };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    startTransition(async () => {
      const result = await submitAssessment({
        goal_id: goalId,
        skill_ids: skillStatus ? [] : [...skills],
        skill_status: skillStatus,
        certification_ids: certStatus ? [] : [...certs],
        certification_status: certStatus,
        experience_status: experienceStatus,
        experiences: experienceStatus === "entered" ? validExperiences : [],
        education_level_id: levelId,
      });
      if (result.ok) {
        router.push(`/goal-fit/result/${result.assessmentId}`);
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
        <div className="grid grid-cols-2 gap-2">
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

      <Section
        step={2}
        title="持っているスキル"
        hint="実務・学習を問わず、基本的な使い方がわかるものを選んでください。まだ無い場合は、下のどれかを選んでください。"
        required
        error={fieldErrors.skills}
      >
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
            expandAll={normalizedQuery !== ""}
            disabled={skillStatus !== null}
          />
          <ChipGroups
            title="手法・知識"
            hint="開発手法・テスト・プロジェクト管理・ネットワークなど、技術以外に求められる知識です。"
            groups={humanGroups}
            selected={skills}
            visible={(o) => visible(o, skills)}
            onToggle={toggleSkill}
            expandAll={normalizedQuery !== ""}
            disabled={skillStatus !== null}
          />
          <ChipGroups
            title="使っているツール"
            hint="ツールを選ぶと、そのツールに関係する手法・知識（例：Jest → テスト（単体・結合））を持っているものとして計算します。"
            groups={toolGroups}
            selected={skills}
            visible={(o) => visible(o, skills)}
            onToggle={toggleSkill}
            expandAll={normalizedQuery !== ""}
            disabled={skillStatus !== null}
          />
        </div>
        <p className="mt-4 text-xs text-muted">選択中：{skills.size}件</p>
        <div className="mt-5 border-t border-line pt-5">
          <StatusChoice
            name="skill_status"
            label="あてはまるスキルがない場合"
            options={SKILL_STATUS_LABELS}
            value={skillStatus}
            onChange={chooseSkillStatus}
          />
        </div>
      </Section>

      <Section
        step={3}
        title="資格"
        hint="取得済みの資格を選んでください。資格が証明するスキルを持っているものとして計算します。"
        required
        error={fieldErrors.certifications}
      >
        {markedCertification && (
          <p className="mb-3 text-xs text-muted">
            <span className="font-bold text-flame">★</span>
            はこのGoalに関係する資格です。★の無い資格は、このGoalの計算とSkill Gapには影響しません。
          </p>
        )}
        <ChipGroups
          groups={certificationGroups}
          selected={certs}
          visible={visibleCertification}
          onToggle={toggleCertification}
          expandAll={normalizedQuery !== ""}
          marked={markedCertification}
          disabled={certStatus !== null}
        />
        {certificationGroups.every((g) => g.options.every((o) => !visibleCertification(o))) && (
          <p className="text-sm text-muted">条件に合う資格はありません。</p>
        )}
        <p className="mt-4 text-xs text-muted">選択中：{certs.size}件</p>
        <div className="mt-5 border-t border-line pt-5">
          <StatusChoice
            name="certification_status"
            label="あてはまる資格がない場合"
            options={CERTIFICATION_STATUS_LABELS}
            value={certStatus}
            onChange={chooseCertificationStatus}
          />
        </div>
      </Section>

      <Section
        step={4}
        title="職歴"
        hint="実務経験がある場合は、これまでの職種と経験年数を追加してください。IT以外の職種（営業・事務・経理など）も選べます。同じ職種は合算して計算します。"
        required
        error={fieldErrors.experience}
      >
        <div role="radiogroup" aria-label="職務経歴" className="grid gap-2 sm:grid-cols-3">
          {EXPERIENCE_STATUSES.map((status) => (
            <label
              key={status}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                experienceStatus === status ? "border-indigo bg-indigo-soft font-bold text-indigo" : "border-line hover:border-sky"
              }`}
            >
              <input
                type="radio"
                name="experience_status"
                value={status}
                checked={experienceStatus === status}
                onChange={() => chooseExperienceStatus(status)}
                className="size-4 accent-indigo"
              />
              {EXPERIENCE_STATUS_LABELS[status]}
            </label>
          ))}
        </div>
        {experienceStatus === "entered" && (
          <div className="mt-4">
            <datalist id={datalistId}>
              {jaRoles.map((r) => (
                <option key={r.role_id} value={r.name} />
              ))}
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
                      placeholder="職種名で検索（例: 営業、事務、sales）"
                      aria-label="職種（日本語・英語で検索）"
                      className={selectClass}
                    />
                  ) : (
                    <RoleSelect roleGroups={roleGroups} value={row.role_id} onChoose={(roleId) => chooseRole(row.key, roleId)} />
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
              onClick={addExperienceRow}
              className="mt-3 rounded-lg border border-dashed border-sky px-4 py-2 text-sm font-bold text-indigo hover:bg-sky-soft"
            >
              ＋ 職歴を追加
            </button>
          </div>
        )}
      </Section>

      <Section
        step={5}
        title="最終学歴"
        hint="最後に卒業（修了）した学校を選んでください。"
        required
        error={fieldErrors.education}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={educationSkipped ? "" : levelId}
            onChange={(e) => chooseLevel(e.target.value)}
            aria-label="最終学歴"
            aria-required="true"
            aria-invalid={fieldErrors.education ? true : undefined}
            disabled={educationSkipped}
            className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <option value="" disabled>
              最終学歴を選択してください
            </option>
            {education.levels
              .filter((l) => l.level_id !== SKIPPED_EDUCATION_LEVEL_ID)
              .map((l) => (
                <option key={l.level_id} value={l.level_id}>
                  {l.name}
                </option>
              ))}
          </select>
          <StatusChoice
            name="education_status"
            label="最終学歴を回答しない場合"
            options={EDUCATION_STATUS_LABELS}
            value={educationSkipped ? SKIPPED_EDUCATION_LEVEL_ID : null}
            onChange={(status) => chooseLevel(status ?? "")}
          />
        </div>
      </Section>

      <div className="sticky bottom-4 rounded-2xl border border-line bg-white/95 p-4 shadow-lg backdrop-blur">
        {error && <p className="mb-3 text-sm text-coral">{error}</p>}
        {Object.values(fieldErrors).some(Boolean) && (
          <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-coral">
            {[
              fieldErrors.skills && MISSING_INPUT_SUMMARIES.skills_required,
              fieldErrors.certifications && MISSING_INPUT_SUMMARIES.certifications_required,
              fieldErrors.experience === SUBMIT_ERRORS.experience_required
                ? MISSING_INPUT_SUMMARIES.experience_required
                : fieldErrors.experience,
              fieldErrors.education && MISSING_INPUT_SUMMARIES.education_required,
            ]
              .filter((message): message is string => Boolean(message))
              .map((message) => (
                <li key={message}>{message}</li>
              ))}
          </ul>
        )}
        {incompleteExperience && <p className="mb-3 text-xs text-flame">職種と年数の両方が入力された職歴だけが計算に使われます。</p>}
        <button
          type="submit"
          disabled={!goalId || pending}
          className="w-full rounded-full bg-indigo py-3 font-bold text-white shadow-lg shadow-indigo/20 transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "計算しています…" : goalId ? "Goal Fitを計算する" : "Goalを選んでください"}
        </button>
      </div>
    </form>
  );
}
