import type { DataEnvelope, LoadedData, SiteConfig } from "./types";
const base = import.meta.env.BASE_URL;
async function loadJson<T>(file: string): Promise<T> { const response = await fetch(`${base}data/${file}`, { cache: "no-cache" }); if (!response.ok) throw new Error(`无法加载 ${file}`); return response.json() as Promise<T>; }
export async function loadData(): Promise<LoadedData> {
  const [config, leetcode, papers, jobs, goals] = await Promise.all([
    loadJson<SiteConfig>("site.json"), loadJson<DataEnvelope<LoadedData["leetcode"][number]>>("leetcode.json"), loadJson<DataEnvelope<LoadedData["papers"][number]>>("papers.json"), loadJson<DataEnvelope<LoadedData["jobs"][number]>>("jobs.json"), loadJson<DataEnvelope<LoadedData["goals"][number]>>("goals.json")
  ]);
  const timestamps = [leetcode, papers, jobs, goals].map((item) => item.generatedAt).filter(Boolean);
  return { config, leetcode: leetcode.records, papers: papers.records, jobs: jobs.records, goals: goals.records, generatedAt: timestamps.sort().at(-1) || new Date().toISOString() };
}
export function formatDate(value?: string, locale = "zh-CN") { if (!value) return "—"; const date = new Date(value.length === 10 ? `${value}T00:00:00` : value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date); }
export function isDue(value?: string) { if (!value) return false; return new Date(`${value}T23:59:59`).getTime() <= Date.now(); }
