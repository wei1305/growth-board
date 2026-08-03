import type { GoalRecord, GrowthRecord, JobRecord, LeetcodeRecord, ModuleKey, PaperRecord } from "./types";

export type FormValues = Record<string, string>;

export interface FieldDefinition {
  name: string;
  label: string;
  type: "text" | "url" | "date" | "number" | "select" | "textarea";
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
  wide?: boolean;
}

interface ModuleForm {
  label: string;
  issuePrefix: string;
  typeLabel: string;
  fields: FieldDefinition[];
}

const today = () => new Date().toISOString().slice(0, 10);
const option = (value: string, label = value) => ({ value, label });

export const moduleForms: Record<ModuleKey, ModuleForm> = {
  leetcode: {
    label: "刷题",
    issuePrefix: "LC",
    typeLabel: "type:leetcode",
    fields: [
      { name: "problem_title", label: "题目名称", type: "text", required: true, placeholder: "例如：146. LRU Cache", wide: true },
      { name: "problem_url", label: "题目链接", type: "url", placeholder: "https://leetcode.cn/problems/...", wide: true },
      { name: "difficulty", label: "难度", type: "select", required: true, options: [option("easy", "Easy"), option("medium", "Medium"), option("hard", "Hard")] },
      { name: "language", label: "编程语言", type: "text", placeholder: "TypeScript" },
      { name: "topics", label: "标签", type: "text", placeholder: "哈希表, 双向链表", wide: true },
      { name: "solved_at", label: "完成日期", type: "date", required: true },
      { name: "status", label: "状态", type: "select", required: true, options: [option("active", "学习中"), option("review", "待复习"), option("mastered", "已掌握")] },
      { name: "mastery", label: "掌握程度", type: "number", min: 0, max: 5 },
      { name: "next_review_at", label: "下次复习", type: "date" },
      { name: "summary", label: "解题思路", type: "textarea", placeholder: "记录核心思路和复杂度。", wide: true },
      { name: "mistakes", label: "易错点", type: "textarea", placeholder: "记录踩坑和边界条件。", wide: true },
      { name: "solution_url", label: "代码链接", type: "url", wide: true },
    ],
  },
  papers: {
    label: "论文",
    issuePrefix: "Paper",
    typeLabel: "type:paper",
    fields: [
      { name: "paper_title", label: "论文标题", type: "text", required: true, wide: true },
      { name: "paper_url", label: "论文链接", type: "url", wide: true },
      { name: "authors", label: "作者", type: "text", wide: true },
      { name: "venue", label: "Venue", type: "text", placeholder: "CVPR / arXiv" },
      { name: "year", label: "年份", type: "number", min: 1900, max: 2100 },
      { name: "research_area", label: "研究方向", type: "text" },
      { name: "status", label: "状态", type: "select", required: true, options: [option("queue", "待读"), option("reading", "精读中"), option("finished", "已完成")] },
      { name: "progress", label: "阅读进度", type: "number", min: 0, max: 100 },
      { name: "rating", label: "评分", type: "number", min: 0, max: 5 },
      { name: "started_at", label: "开始日期", type: "date" },
      { name: "finished_at", label: "完成日期", type: "date" },
      { name: "next_review_at", label: "下次复习", type: "date" },
      { name: "summary", label: "一句话总结", type: "textarea", wide: true },
      { name: "contribution", label: "核心贡献", type: "textarea", wide: true },
      { name: "code_url", label: "代码链接", type: "url", wide: true },
    ],
  },
  jobs: {
    label: "求职",
    issuePrefix: "Job",
    typeLabel: "type:job",
    fields: [
      { name: "company", label: "公司代号", type: "text", required: true, placeholder: "建议使用代号，不填写敏感信息" },
      { name: "role", label: "岗位", type: "text", required: true },
      { name: "location", label: "地点", type: "text" },
      { name: "job_url", label: "职位链接", type: "url", wide: true },
      { name: "channel", label: "投递渠道", type: "text" },
      { name: "applied_at", label: "投递日期", type: "date" },
      { name: "stage", label: "阶段", type: "select", required: true, options: [option("saved", "收藏"), option("preparing", "准备"), option("applied", "已投递"), option("assessment", "笔试"), option("interview", "面试"), option("offer", "Offer"), option("rejected", "拒绝"), option("withdrawn", "结束")] },
      { name: "next_step_at", label: "下一步日期", type: "date" },
      { name: "note", label: "公开备注", type: "textarea", placeholder: "不要填写联系方式、薪资或未公开信息。", wide: true },
      { name: "result", label: "结果", type: "textarea", wide: true },
    ],
  },
  goals: {
    label: "目标",
    issuePrefix: "Goal",
    typeLabel: "type:goal",
    fields: [
      { name: "goal_title", label: "目标名称", type: "text", required: true, wide: true },
      { name: "module", label: "关联模块", type: "select", options: [option("leetcode", "刷题"), option("papers", "论文"), option("jobs", "求职"), option("goals", "其他")] },
      { name: "period", label: "周期", type: "text", placeholder: "2026 Q3" },
      { name: "start_at", label: "开始日期", type: "date" },
      { name: "due_at", label: "截止日期", type: "date" },
      { name: "metric", label: "衡量单位", type: "text", placeholder: "道 / 篇 / 次" },
      { name: "target_value", label: "目标值", type: "number", required: true, min: 0 },
      { name: "current_value", label: "当前值", type: "number", required: true, min: 0 },
      { name: "status", label: "状态", type: "select", required: true, options: [option("active", "进行中"), option("completed", "已完成"), option("paused", "暂停")] },
      { name: "review", label: "复盘", type: "textarea", wide: true },
    ],
  },
};

export function defaultValues(module: ModuleKey): FormValues {
  const values: FormValues = {};
  for (const field of moduleForms[module].fields) values[field.name] = field.options?.[0]?.value ?? "";
  if (module === "leetcode") values.solved_at = today();
  if (module === "papers") values.started_at = today();
  if (module === "goals") values.start_at = today();
  if (module === "goals") values.current_value = "0";
  return values;
}

export function recordToValues(record: GrowthRecord): FormValues {
  const values = defaultValues(record.type);
  const assign = (entries: Record<string, string | number | undefined>) => Object.entries(entries).forEach(([key, value]) => { values[key] = value == null ? "" : String(value); });
  if (record.type === "leetcode") assign({ problem_title: record.title, problem_url: record.problemUrl, difficulty: record.difficulty, language: record.language, topics: record.topics.join(", "), solved_at: record.solvedAt, status: record.status, mastery: record.mastery, next_review_at: record.nextReviewAt, summary: record.summary, mistakes: record.mistakes, solution_url: record.solutionUrl });
  if (record.type === "papers") assign({ paper_title: record.title, paper_url: record.paperUrl, authors: record.authors, venue: record.venue, year: record.year, research_area: record.researchArea, status: record.status, progress: record.progress, rating: record.rating, started_at: record.startedAt, finished_at: record.finishedAt, next_review_at: record.nextReviewAt, summary: record.summary, contribution: record.contribution, code_url: record.codeUrl });
  if (record.type === "jobs") assign({ company: record.company, role: record.role, location: record.location, job_url: record.jobUrl, channel: record.channel, applied_at: record.appliedAt, stage: record.stage, next_step_at: record.nextStepAt, note: record.note, result: record.result });
  if (record.type === "goals") assign({ goal_title: record.title, module: record.module, period: record.period, start_at: record.startAt, due_at: record.dueAt, target_value: record.targetValue, current_value: record.currentValue, metric: record.metric, status: record.status, review: record.review });
  return values;
}

export function buildIssuePayload(module: ModuleKey, values: FormValues) {
  const schema = moduleForms[module];
  const titleField = schema.fields.find((field) => field.required && ["problem_title", "paper_title", "company", "goal_title"].includes(field.name));
  const titleValue = values[titleField?.name ?? ""]?.trim() || schema.label;
  const role = module === "jobs" && values.role?.trim() ? ` · ${values.role.trim()}` : "";
  const body = schema.fields.map((field) => `### ${field.label} / ${field.name}\n\n${values[field.name]?.trim() || "_No response_"}`).join("\n\n");
  return { title: `[${schema.issuePrefix}] ${titleValue}${role}`, body, labels: [schema.typeLabel] };
}

export interface IssueLike {
  number: number;
  html_url: string;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
}

const numberValue = (value: string, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const baseRecord = (module: ModuleKey, values: FormValues, issue: IssueLike) => ({ id: issue.number, type: module, issueUrl: issue.html_url, state: issue.state, archived: issue.state === "closed", labels: [moduleForms[module].typeLabel], createdAt: issue.created_at, updatedAt: issue.updated_at, activityDate: ({ leetcode: values.solved_at, papers: values.finished_at || values.started_at, jobs: values.applied_at, goals: values.due_at } as Record<ModuleKey, string>)[module] || issue.updated_at.slice(0, 10), pending: true });

export function recordFromIssue(module: ModuleKey, values: FormValues, issue: IssueLike): GrowthRecord {
  const base = baseRecord(module, values, issue);
  if (module === "leetcode") return { ...base, type: "leetcode", title: values.problem_title, problemUrl: values.problem_url || undefined, difficulty: (values.difficulty || "easy") as LeetcodeRecord["difficulty"], language: values.language || undefined, topics: values.topics?.split(/[,，;；]/).map((item) => item.trim()).filter(Boolean) ?? [], solvedAt: values.solved_at || undefined, nextReviewAt: values.next_review_at || undefined, mastery: numberValue(values.mastery), status: values.status || "active", summary: values.summary || undefined, mistakes: values.mistakes || undefined, solutionUrl: values.solution_url || undefined };
  if (module === "papers") return { ...base, type: "papers", title: values.paper_title, authors: values.authors || undefined, venue: values.venue || undefined, year: values.year || undefined, paperUrl: values.paper_url || undefined, codeUrl: values.code_url || undefined, researchArea: values.research_area || undefined, status: values.status || "queue", progress: numberValue(values.progress), rating: numberValue(values.rating), startedAt: values.started_at || undefined, finishedAt: values.finished_at || undefined, nextReviewAt: values.next_review_at || undefined, summary: values.summary || undefined, contribution: values.contribution || undefined } as PaperRecord;
  if (module === "jobs") return { ...base, type: "jobs", title: `${values.company}${values.role ? ` · ${values.role}` : ""}`, company: values.company, role: values.role || undefined, location: values.location || undefined, jobUrl: values.job_url || undefined, channel: values.channel || undefined, appliedAt: values.applied_at || undefined, stage: values.stage || "saved", nextStepAt: values.next_step_at || undefined, note: values.note || undefined, result: values.result || undefined } as JobRecord;
  return { ...base, type: "goals", title: values.goal_title, module: (values.module || undefined) as ModuleKey | undefined, period: values.period || undefined, startAt: values.start_at || undefined, dueAt: values.due_at || undefined, targetValue: numberValue(values.target_value), currentValue: numberValue(values.current_value), metric: values.metric || undefined, status: values.status || "active", review: values.review || undefined } as GoalRecord;
}
