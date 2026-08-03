import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Activity, BookOpen, BriefcaseBusiness, CalendarClock, CheckCircle2, ChevronRight,
  CircleDot, Cloud, Code2, ExternalLink, FileText, GitBranch, Goal, Home, Menu, Moon, Plus,
  Save, Search, Settings, Sparkles, Sun, Target, X,
} from "lucide-react";
import { formatDate, isDue, loadData } from "./data";
import { ConnectionCard, RecordComposer, openRecordComposer } from "./RecordComposer";
import { mergePendingRecords, removeLoadedRecord, upsertLoadedRecord } from "./github-sync";
import type { GoalRecord, GrowthRecord, JobRecord, LeetcodeRecord, LoadedData, ModuleKey, PaperRecord } from "./types";

type Route = "dashboard" | ModuleKey | "timeline" | "settings";
type IconType = ComponentType<{ size?: number; strokeWidth?: number }>;
const moduleMeta: Record<ModuleKey, { label: string; short: string; icon: IconType; color: string; form: string }> = {
  leetcode: { label: "刷题", short: "题", icon: Code2, color: "purple", form: "leetcode.yml" },
  papers: { label: "论文", short: "文", icon: BookOpen, color: "blue", form: "paper.yml" },
  jobs: { label: "求职", short: "职", icon: BriefcaseBusiness, color: "green", form: "job.yml" },
  goals: { label: "目标", short: "标", icon: Target, color: "amber", form: "goal.yml" },
};

function routeFromHash(): Route {
  const value = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  return (["leetcode", "papers", "jobs", "goals", "timeline", "settings"] as Route[]).includes(value as Route) ? value as Route : "dashboard";
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 19 ? "下午好" : "晚上好";
}

function useModulePrefs(data?: LoadedData) {
  const [prefs, setPrefs] = useState<Record<ModuleKey, boolean>>(() => {
    try { return { leetcode: true, papers: true, jobs: true, goals: true, ...JSON.parse(localStorage.getItem("growthboard:modules") || "{}") }; }
    catch { return { leetcode: true, papers: true, jobs: true, goals: true }; }
  });
  const enabled = useMemo(() => {
    const global = data?.config.modules || { leetcode: true, papers: true, jobs: true, goals: true };
    return Object.fromEntries((Object.keys(global) as ModuleKey[]).map((key) => [key, global[key] && prefs[key]])) as Record<ModuleKey, boolean>;
  }, [data, prefs]);
  const update = (key: ModuleKey, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next); localStorage.setItem("growthboard:modules", JSON.stringify(next));
  };
  return { prefs, enabled, update };
}

export function App() {
  const [data, setData] = useState<LoadedData>();
  const [error, setError] = useState("");
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("growthboard:theme") as "light" | "dark") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const { prefs, enabled, update } = useModulePrefs(data);

  useEffect(() => { loadData().then(mergePendingRecords).then(setData).catch((reason: Error) => setError(reason.message)); }, []);
  useEffect(() => { const handler = () => setRoute(routeFromHash()); addEventListener("hashchange", handler); return () => removeEventListener("hashchange", handler); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("growthboard:theme", theme); }, [theme]);
  useEffect(() => {
    if (route in enabled && !enabled[route as ModuleKey]) window.location.hash = "#/";
  }, [enabled, route]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const navigate = (next: Route) => { window.location.hash = next === "dashboard" ? "#/" : `#/${next}`; setRoute(next); };
  return (
    <div className="app-shell">
      <Sidebar data={data} route={route} enabled={enabled} navigate={navigate} />
      <div className="main-column">
        <Topbar data={data} theme={theme} setTheme={setTheme} onSearch={() => setSearchOpen(true)} />
        <main id="main-content" className="content">
          {route === "dashboard" && <Dashboard data={data} enabled={enabled} navigate={navigate} />}
          {route === "leetcode" && <LeetcodePage records={data.leetcode} repository={data.config.repository} />}
          {route === "papers" && <PapersPage records={data.papers} repository={data.config.repository} />}
          {route === "jobs" && <JobsPage records={data.jobs} repository={data.config.repository} />}
          {route === "goals" && <GoalsPage records={data.goals} repository={data.config.repository} />}
          {route === "timeline" && <TimelinePage data={data} enabled={enabled} />}
          {route === "settings" && <SettingsPage data={data} prefs={prefs} enabled={enabled} update={update} />}
        </main>
        <footer><span>后台数据更新于 {formatDate(data.generatedAt, data.config.locale)}</span><span>网站内即时更新 · GitHub 后台同步</span></footer>
      </div>
      <MobileNav route={route} enabled={enabled} navigate={navigate} />
      <button className="fab" onClick={() => setQuickOpen(!quickOpen)} aria-label="添加记录"><Plus size={24} /></button>
      {quickOpen && <QuickMenu repository={data.config.repository} enabled={enabled} close={() => setQuickOpen(false)} />}
      {searchOpen && <SearchDialog data={data} enabled={enabled} close={() => setSearchOpen(false)} />}
      <RecordComposer repository={data.config.repository} onSaved={(record) => setData((current) => current ? upsertLoadedRecord(current, record) : current)} onRemoved={(record) => setData((current) => current ? removeLoadedRecord(current, record) : current)} />
    </div>
  );
}

function Sidebar({ data, route, enabled, navigate }: { data: LoadedData; route: Route; enabled: Record<ModuleKey, boolean>; navigate: (route: Route) => void }) {
  const nav: { key: Route; label: string; icon: IconType }[] = [
    { key: "dashboard", label: "首页", icon: Home },
    ...((Object.keys(moduleMeta) as ModuleKey[]).filter((key) => enabled[key]).map((key) => ({ key, label: moduleMeta[key].label, icon: moduleMeta[key].icon }))),
    { key: "timeline", label: "时间轴", icon: Activity },
  ];
  return <aside className="sidebar">
    <button className="brand" onClick={() => navigate("dashboard")} aria-label={`返回${data.config.siteName}首页`}><span className="brand-mark">G</span><span>{data.config.siteName}</span></button>
    <nav aria-label="主导航">{nav.map(({ key, label, icon: Icon }) => <button key={key} className={route === key ? "active" : ""} onClick={() => navigate(key)} aria-label={label}><Icon size={19} /><span>{label}</span></button>)}</nav>
    <div className="sidebar-spacer" />
    <button className={route === "settings" ? "active" : ""} onClick={() => navigate("settings")} aria-label="设置"><Settings size={19} /><span>设置</span></button>
    <div className="repo-sync"><GitBranch size={18} /><span>后台同步</span></div>
  </aside>;
}

function Topbar({ data, theme, setTheme, onSearch }: { data: LoadedData; theme: string; setTheme: (theme: "light" | "dark") => void; onSearch: () => void }) {
  return <header className="topbar">
    <div><div className="eyebrow">{new Intl.DateTimeFormat(data.config.locale, { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date())}</div><strong>{greeting()}，{data.config.ownerName}</strong></div>
    <div className="top-actions"><button className="search-trigger" onClick={onSearch} aria-label="搜索记录"><Search size={18} /><span>搜索记录</span><kbd>⌘ K</kbd></button><button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="切换主题">{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button></div>
  </header>;
}

function Dashboard({ data, enabled, navigate }: { data: LoadedData; enabled: Record<ModuleKey, boolean>; navigate: (route: Route) => void }) {
  const month = new Date().toISOString().slice(0, 7);
  const cards = [
    enabled.leetcode && { key: "leetcode" as const, value: data.leetcode.filter((r) => r.solvedAt?.startsWith(month)).length, label: "本月刷题", note: `${data.leetcode.filter((r) => isDue(r.nextReviewAt)).length} 道待复习` },
    enabled.papers && { key: "papers" as const, value: data.papers.filter((r) => r.finishedAt?.startsWith(month)).length, label: "本月论文", note: `${data.papers.filter((r) => r.status !== "finished").length} 篇进行中` },
    enabled.jobs && { key: "jobs" as const, value: data.jobs.filter((r) => r.appliedAt?.startsWith(month)).length, label: "本月投递", note: `${data.jobs.filter((r) => ["interview", "assessment"].includes(r.stage)).length} 个进展` },
    enabled.goals && { key: "goals" as const, value: data.goals.length ? Math.round(data.goals.reduce((sum, r) => sum + Math.min(r.currentValue / Math.max(r.targetValue, 1), 1), 0) / data.goals.length * 100) : 0, label: "目标完成率", note: `${data.goals.filter((r) => r.status === "completed").length} / ${data.goals.length} 已完成`, suffix: "%" },
  ].filter(Boolean) as { key: ModuleKey; value: number; label: string; note: string; suffix?: string }[];
  const due: { key: ModuleKey; title: string; date?: string }[] = [
    ...data.leetcode.filter((r) => enabled.leetcode && isDue(r.nextReviewAt)).map((r) => ({ key: "leetcode" as const, title: `复习 ${r.title}`, date: r.nextReviewAt })),
    ...data.papers.filter((r) => enabled.papers && isDue(r.nextReviewAt)).map((r) => ({ key: "papers" as const, title: `阅读 ${r.title}`, date: r.nextReviewAt })),
    ...data.jobs.filter((r) => enabled.jobs && isDue(r.nextStepAt)).map((r) => ({ key: "jobs" as const, title: `跟进 ${r.company}`, date: r.nextStepAt })),
    ...data.goals.filter((r) => enabled.goals && r.status !== "completed" && isDue(r.dueAt)).map((r) => ({ key: "goals" as const, title: r.title, date: r.dueAt })),
  ].slice(0, 5);
  const all = allRecords(data, enabled);
  return <>
    <section className="hero"><div><span className="hero-kicker"><Sparkles size={16} /> Personal growth OS</span><h1>{data.config.profile.headline}</h1><p>{data.config.tagline}</p></div><div className="streak"><span>{activityStreak(all)}</span><small>连续记录天数</small></div></section>
    <section className="stat-grid">{cards.map((card) => <button key={card.key} className={`stat-card ${moduleMeta[card.key].color}`} onClick={() => navigate(card.key)}><span className="stat-label">{card.label}<ChevronRight size={16} /></span><strong>{card.value}{card.suffix}</strong><small>{card.note}</small><MiniBars values={recentCounts(all.filter((r) => r.type === card.key), 7)} /></button>)}</section>
    <section className="dashboard-grid">
      <div className="panel today-panel"><PanelHead title="今日待办" subtitle={due.length ? `${due.length} 项需要处理` : "今天已经清空"} /><div className="task-list">{due.length ? due.map((item, index) => { const Icon = moduleMeta[item.key].icon; return <button key={`${item.key}-${index}`} onClick={() => navigate(item.key)}><span className={`task-icon ${moduleMeta[item.key].color}`}><Icon size={18} /></span><span><strong>{item.title}</strong><small>{formatDate(item.date)}</small></span><ChevronRight size={17} /></button>; }) : <Empty compact text="暂无到期任务，保持节奏即可。" />}</div></div>
      <div className="panel heat-panel"><PanelHead title="活动热力图" subtitle="最近 16 周" /><Heatmap records={all} /></div>
      <div className="panel trend-panel"><PanelHead title="本周趋势" subtitle="按模块统计" /><WeeklyTrend data={data} enabled={enabled} /></div>
      <div className="panel upcoming-panel"><PanelHead title="最近动态" subtitle="自动汇总" /><div className="activity-list">{all.slice(0, 5).map((record) => <button key={`${record.type}-${record.id}`} onClick={() => navigate(record.type)}><span className={`dot ${moduleMeta[record.type].color}`} /><span><strong>{record.title}</strong><small>{moduleMeta[record.type].label} · {formatDate(record.activityDate)}</small></span></button>)}</div></div>
    </section>
  </>;
}

function LeetcodePage({ records, repository }: { records: LeetcodeRecord[]; repository: string }) {
  const [query, setQuery] = useState(""); const [difficulty, setDifficulty] = useState("all");
  const filtered = records.filter((r) => `${r.title} ${r.topics.join(" ")} ${r.language}`.toLowerCase().includes(query.toLowerCase()) && (difficulty === "all" || r.difficulty === difficulty));
  return <ModulePage title="刷题记录" description="用复习节奏把做过的题真正变成能力。" module="leetcode" repository={repository} stats={[{ label: "总题数", value: records.length }, { label: "Easy", value: records.filter((r) => r.difficulty === "easy").length }, { label: "Medium", value: records.filter((r) => r.difficulty === "medium").length }, { label: "Hard", value: records.filter((r) => r.difficulty === "hard").length }, { label: "待复习", value: records.filter((r) => isDue(r.nextReviewAt)).length }] }>
    <Filters query={query} setQuery={setQuery}><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="难度"><option value="all">全部难度</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></Filters>
    <div className="record-grid">{filtered.length ? filtered.map((r) => <article className="record-card" key={r.id}><div className="card-top"><span className={`pill ${r.difficulty}`}>{r.difficulty}</span><span className="muted">#{r.id}</span></div><h3>{r.title}</h3><div className="tag-row">{r.topics.map((tag) => <span key={tag}>{tag}</span>)}</div><dl><div><dt>状态</dt><dd>{r.status}</dd></div><div><dt>掌握度</dt><dd>{r.mastery ?? "—"}/5</dd></div><div><dt>下次复习</dt><dd className={isDue(r.nextReviewAt) ? "danger" : ""}>{formatDate(r.nextReviewAt)}</dd></div><div><dt>语言</dt><dd>{r.language || "—"}</dd></div></dl><CardLinks record={r} primary={r.problemUrl} /></article>) : <Empty text="没有匹配的刷题记录。" />}</div>
  </ModulePage>;
}

function PapersPage({ records, repository }: { records: PaperRecord[]; repository: string }) {
  const [query, setQuery] = useState(""); const filtered = records.filter((r) => `${r.title} ${r.authors} ${r.venue} ${r.researchArea}`.toLowerCase().includes(query.toLowerCase()));
  return <ModulePage title="论文阅读" description="把待读队列、精读过程和复习节点放在一起。" module="papers" repository={repository} stats={[{ label: "论文总数", value: records.length }, { label: "精读中", value: records.filter((r) => r.status === "reading").length }, { label: "已完成", value: records.filter((r) => r.status === "finished").length }, { label: "待复习", value: records.filter((r) => isDue(r.nextReviewAt)).length }]}>
    <Filters query={query} setQuery={setQuery} />
    <div className="record-grid paper-grid">{filtered.length ? filtered.map((r) => <article className="record-card" key={r.id}><div className="card-top"><span className="pill blue">{r.venue || "Paper"} {r.year}</span><span className="rating">{"★".repeat(r.rating || 0)}{"☆".repeat(Math.max(0, 5 - (r.rating || 0)))}</span></div><h3>{r.title}</h3><p className="card-summary">{r.summary || "尚未填写一句话总结。"}</p><div className="progress-line"><span style={{ width: `${Math.min(r.progress || 0, 100)}%` }} /></div><small>{r.progress || 0}% · {r.status}</small><CardLinks record={r} primary={r.paperUrl} secondary={r.codeUrl} /></article>) : <Empty text="没有匹配的论文记录。" />}</div>
  </ModulePage>;
}

const stages = ["saved", "preparing", "applied", "assessment", "interview", "offer", "rejected", "withdrawn"];
const stageLabel: Record<string, string> = { saved: "收藏", preparing: "准备", applied: "已投递", assessment: "笔试", interview: "面试", offer: "Offer", rejected: "拒绝", withdrawn: "结束" };
function JobsPage({ records, repository }: { records: JobRecord[]; repository: string }) {
  return <ModulePage title="求职进展" description="只记录适合公开的信息；敏感信息不要写入公开 Issue。" module="jobs" repository={repository} stats={[{ label: "总岗位", value: records.length }, { label: "已投递", value: records.filter((r) => !["saved", "preparing"].includes(r.stage)).length }, { label: "面试中", value: records.filter((r) => r.stage === "interview").length }, { label: "Offer", value: records.filter((r) => r.stage === "offer").length }]}>
    <div className="privacy-note"><BriefcaseBusiness size={19} /><span><strong>公开隐私提醒</strong> 请勿填写私人联系方式、薪资详情或未公开 Offer 信息。</span></div>
    <div className="kanban">{stages.filter((stage) => records.some((r) => r.stage === stage) || ["saved", "applied", "interview", "offer"].includes(stage)).map((stage) => <section className="kanban-column" key={stage}><header><span>{stageLabel[stage]}</span><b>{records.filter((r) => r.stage === stage).length}</b></header>{records.filter((r) => r.stage === stage).map((r) => <button type="button" className="job-card" onClick={() => openRecordComposer("jobs", r)} key={r.id}><strong>{r.company}</strong><span>{r.role || "未填写岗位"}</span><small>{r.location || "地点不限"} · {formatDate(r.nextStepAt || r.appliedAt)}</small></button>)}</section>)}</div>
  </ModulePage>;
}

function GoalsPage({ records, repository }: { records: GoalRecord[]; repository: string }) {
  return <ModulePage title="目标计划" description="把长期方向拆成可量化、可复盘的进度。" module="goals" repository={repository} stats={[{ label: "目标数", value: records.length }, { label: "进行中", value: records.filter((r) => r.status === "active").length }, { label: "已完成", value: records.filter((r) => r.status === "completed").length }]}>
    <div className="goal-list">{records.length ? records.map((r) => { const ratio = Math.min(r.currentValue / Math.max(r.targetValue, 1), 1); return <article className="goal-card" key={r.id}><div className="goal-ring" style={{ background: `conic-gradient(var(--amber) ${ratio * 360}deg, var(--line) 0)` }}><span>{Math.round(ratio * 100)}%</span></div><div><span className="eyebrow">{r.period || "目标"} · {r.metric || "进度"}</span><h3>{r.title}</h3><p>{r.currentValue} / {r.targetValue} · 截止 {formatDate(r.dueAt)}</p><button type="button" onClick={() => openRecordComposer("goals", r)}><Save size={14} />站内编辑</button></div></article>; }) : <Empty text="还没有目标，先创建第一个可量化目标。" />}</div>
  </ModulePage>;
}

function TimelinePage({ data, enabled }: { data: LoadedData; enabled: Record<ModuleKey, boolean> }) {
  const records = allRecords(data, enabled);
  return <section><PageTitle title="成长时间轴" description="所有已启用模块的记录按活动日期汇总。" /><div className="timeline">{records.map((r) => { const Icon = moduleMeta[r.type].icon; return <button type="button" key={`${r.type}-${r.id}`} onClick={() => openRecordComposer(r.type, r)}><time>{formatDate(r.activityDate)}</time><span className={`timeline-icon ${moduleMeta[r.type].color}`}><Icon size={18} /></span><div><span className="eyebrow">{moduleMeta[r.type].label}</span><strong>{r.title}</strong><small>#{r.id} · {r.state === "closed" ? "已归档" : "活动中"}</small></div></button>; })}</div></section>;
}

function SettingsPage({ data, prefs, enabled, update }: { data: LoadedData; prefs: Record<ModuleKey, boolean>; enabled: Record<ModuleKey, boolean>; update: (key: ModuleKey, value: boolean) => void }) {
  return <section><PageTitle title="网站设置" description="连接后台同步，并按需要显示或隐藏各个成长模块。" /><div className="settings-grid"><ConnectionCard repository={data.config.repository} /><div className="panel settings-panel"><PanelHead title="模块开关" subtitle="当前设备偏好会保存在浏览器中" />{(Object.keys(moduleMeta) as ModuleKey[]).map((key) => { const meta = moduleMeta[key]; const Icon = meta.icon; const globallyEnabled = data.config.modules[key]; return <label className="setting-row" key={key}><span className={`task-icon ${meta.color}`}><Icon size={18} /></span><span><strong>{meta.label}</strong><small>{globallyEnabled ? "可在本设备显示或隐藏" : "已被站点全局关闭"}</small></span><input type="checkbox" role="switch" checked={enabled[key]} disabled={!globallyEnabled} onChange={(e) => update(key, e.target.checked)} aria-label={`显示${meta.label}模块`} /></label>; })}</div><div className="panel config-panel"><PanelHead title="同步说明" subtitle="无需离开网站" /><p>新增、编辑、归档、恢复和删除都会在当前页面立即生效，并在后台同步到仓库。自动部署完成后，其他设备也会读取到最新数据。</p><pre>{JSON.stringify({ modules: data.config.modules }, null, 2)}</pre></div></div></section>;
}

function ModulePage({ title, description, module, repository, stats, children }: { title: string; description: string; module: ModuleKey; repository: string; stats: { label: string; value: number }[]; children: React.ReactNode }) {
  return <section><PageTitle title={title} description={description} action={<button type="button" className="primary-link" onClick={() => openRecordComposer(module)}><Plus size={17} />添加记录</button>} /><div className="module-stats">{stats.map((stat) => <div key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}</div>{children}</section>;
}

function Filters({ query, setQuery, children }: { query: string; setQuery: (value: string) => void; children?: React.ReactNode }) { return <div className="filters"><label><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标题、标签或备注" /></label>{children}</div>; }
function PageTitle({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="page-title"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
function PanelHead({ title, subtitle }: { title: string; subtitle: string }) { return <div className="panel-head"><div><h2>{title}</h2><span>{subtitle}</span></div></div>; }
function Empty({ text, compact = false }: { text: string; compact?: boolean }) { return <div className={`empty ${compact ? "compact" : ""}`}><CircleDot size={24} /><span>{text}</span></div>; }
function CardLinks({ record, primary, secondary }: { record: GrowthRecord; primary?: string; secondary?: string }) { return <div className="card-links">{primary && <a href={primary} target="_blank" rel="noreferrer">原始资料 <ExternalLink size={14} /></a>}{secondary && <a href={secondary} target="_blank" rel="noreferrer">代码资料 <ExternalLink size={14} /></a>}<button type="button" onClick={() => openRecordComposer(record.type, record)}><Save size={14} />站内编辑</button>{record.pending && <span className="sync-badge"><Cloud size={13} />等待后台确认</span>}</div>; }
function MiniBars({ values }: { values: number[] }) { const max = Math.max(...values, 1); return <div className="mini-bars" aria-hidden="true">{values.map((v, i) => <i key={i} style={{ height: `${20 + v / max * 80}%` }} />)}</div>; }

function Heatmap({ records }: { records: GrowthRecord[] }) {
  const counts = new Map<string, number>(); records.forEach((r) => counts.set(r.activityDate.slice(0, 10), (counts.get(r.activityDate.slice(0, 10)) || 0) + 1));
  return <div className="heatmap" aria-label="最近 16 周活动热力图">{Array.from({ length: 112 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (111 - index)); const key = date.toISOString().slice(0, 10); const count = counts.get(key) || 0; return <i key={key} title={`${key}: ${count} 条`} data-level={Math.min(count, 4)} />; })}</div>;
}
function WeeklyTrend({ data, enabled }: { data: LoadedData; enabled: Record<ModuleKey, boolean> }) {
  const series = (Object.keys(moduleMeta) as ModuleKey[]).filter((key) => enabled[key]).map((key) => ({ key, values: recentCounts(data[key], 7) }));
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return <div className="weekly"><div className="weekly-chart">{Array.from({ length: 7 }, (_, day) => <div className="day-column" key={day}>{series.map((s) => <i key={s.key} className={moduleMeta[s.key].color} style={{ height: `${Math.max(3, s.values[day] / max * 100)}%` }} />)}</div>)}</div><div className="legend">{series.map((s) => <span key={s.key}><i className={moduleMeta[s.key].color} />{moduleMeta[s.key].label}</span>)}</div></div>;
}
function allRecords(data: LoadedData, enabled: Record<ModuleKey, boolean>) { return ([...data.leetcode, ...data.papers, ...data.jobs, ...data.goals] as GrowthRecord[]).filter((r) => enabled[r.type]).sort((a, b) => b.activityDate.localeCompare(a.activityDate)); }
function recentCounts(records: GrowthRecord[], days: number) { return Array.from({ length: days }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - (days - 1 - i)); const key = date.toISOString().slice(0, 10); return records.filter((r) => r.activityDate.slice(0, 10) === key).length; }); }
function activityStreak(records: GrowthRecord[]) { const days = new Set(records.map((r) => r.activityDate.slice(0, 10))); let count = 0; const cursor = new Date(); if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1); while (days.has(cursor.toISOString().slice(0, 10))) { count++; cursor.setDate(cursor.getDate() - 1); } return count; }

function QuickMenu({ repository, enabled, close }: { repository: string; enabled: Record<ModuleKey, boolean>; close: () => void }) { return <div className="quick-menu"><header><strong>添加记录</strong><button onClick={close} aria-label="关闭"><X size={17} /></button></header>{(Object.keys(moduleMeta) as ModuleKey[]).filter((key) => enabled[key]).map((key) => { const meta = moduleMeta[key]; const Icon = meta.icon; return <button type="button" key={key} onClick={() => { close(); openRecordComposer(key); }}><span className={`task-icon ${meta.color}`}><Icon size={18} /></span><span>添加{meta.label}记录</span><Plus size={14} /></button>; })}</div>; }
function SearchDialog({ data, enabled, close }: { data: LoadedData; enabled: Record<ModuleKey, boolean>; close: () => void }) { const [query, setQuery] = useState(""); const results = query ? allRecords(data, enabled).filter((r) => r.title.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : []; return <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className="search-dialog" role="dialog" aria-modal="true" aria-label="全局搜索"><header><Search size={19} /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索全部记录…" /><button onClick={close} aria-label="关闭搜索"><X size={18} /></button></header><div>{query && !results.length ? <Empty compact text="没有找到记录。" /> : results.map((r) => <button type="button" className="search-result" key={`${r.type}-${r.id}`} onClick={() => { close(); openRecordComposer(r.type, r); }}><span className={`dot ${moduleMeta[r.type].color}`} /><span><strong>{r.title}</strong><small>{moduleMeta[r.type].label} · #{r.id}</small></span><Save size={15} /></button>)}</div></section></div>; }

function MobileNav({ route, enabled, navigate }: { route: Route; enabled: Record<ModuleKey, boolean>; navigate: (route: Route) => void }) { const items: { key: Route; label: string; icon: IconType }[] = [{ key: "dashboard", label: "首页", icon: Home }, ...(["leetcode", "papers", "jobs"] as ModuleKey[]).filter((key) => enabled[key]).slice(0, 3).map((key) => ({ key, label: moduleMeta[key].label, icon: moduleMeta[key].icon })), { key: "settings", label: "更多", icon: Menu }]; return <nav className="mobile-nav" aria-label="移动导航">{items.map(({ key, label, icon: Icon }) => <button className={route === key ? "active" : ""} key={key} onClick={() => navigate(key)} aria-label={label}><Icon size={20} /><span>{label}</span></button>)}</nav>; }
function LoadingState() { return <div className="state-screen"><span className="brand-mark">G</span><strong>正在加载 GrowthBoard</strong><div className="loader" /></div>; }
function ErrorState({ message }: { message: string }) { return <div className="state-screen"><FileText size={32} /><strong>数据加载失败</strong><p>{message}</p><button onClick={() => location.reload()}>重新加载</button></div>; }
