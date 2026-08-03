import { buildIssuePayload, recordFromIssue, type FormValues, type IssueLike } from "./record-model";
import type { GrowthRecord, LoadedData, ModuleKey } from "./types";

const LOCAL_TOKEN_KEY = "growthboard:github-token";
const SESSION_TOKEN_KEY = "growthboard:github-token-session";
const PENDING_KEY = "growthboard:pending-records";
const TOMBSTONE_KEY = "growthboard:hidden-records";
const API = "https://api.github.com";

interface GitHubIssue extends IssueLike { title: string; body?: string }
interface GitHubUser { login: string }
interface GitHubRepository { full_name: string; owner: GitHubUser }
interface Tombstone { id: number; type: ModuleKey; removedAt: string }

function headers(token: string) {
  return { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" };
}

async function request<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${url}`, { ...init, headers: { ...headers(token), ...init.headers } });
  if (!response.ok) {
    let detail = "";
    try { detail = String((await response.json() as { message?: string }).message || ""); } catch { /* empty response */ }
    if (response.status === 401) throw new Error("令牌无效或已过期，请重新连接。");
    if (response.status === 403) throw new Error("令牌权限不足，请确认已授予该仓库 Issues 读写权限。");
    if (response.status === 404) throw new Error("无法访问目标仓库，请检查令牌的仓库范围。");
    throw new Error(detail || `GitHub 同步失败（${response.status}）`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export function readToken() { return sessionStorage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(LOCAL_TOKEN_KEY) || ""; }
export function saveToken(token: string, remember: boolean) {
  localStorage.removeItem(LOCAL_TOKEN_KEY); sessionStorage.removeItem(SESSION_TOKEN_KEY);
  (remember ? localStorage : sessionStorage).setItem(remember ? LOCAL_TOKEN_KEY : SESSION_TOKEN_KEY, token.trim());
  window.dispatchEvent(new Event("growthboard:connection"));
}
export function clearToken() { localStorage.removeItem(LOCAL_TOKEN_KEY); sessionStorage.removeItem(SESSION_TOKEN_KEY); window.dispatchEvent(new Event("growthboard:connection")); }

function repositoryOwner(repository: string) {
  return repository.split("/", 1)[0]?.trim().toLowerCase() || "";
}

async function requireRepositoryOwner(repository: string, token: string) {
  const user = await request<GitHubUser>("/user", token);
  if (user.login.toLowerCase() !== repositoryOwner(repository)) {
    throw new Error(`当前仓库只允许仓库所有者 ${repositoryOwner(repository)} 编辑记录，当前登录账号为 ${user.login}。`);
  }
  return user.login;
}

export async function validateToken(repository: string, token: string) {
  const [repo, user] = await Promise.all([
    request<GitHubRepository>(`/repos/${repository}`, token),
    request<GitHubUser>("/user", token),
  ]);
  if (repo.full_name.toLowerCase() !== repository.toLowerCase()) throw new Error("令牌连接到了错误的仓库。");
  if (repo.owner.login.toLowerCase() !== user.login.toLowerCase()) {
    throw new Error(`只有仓库所有者 ${repo.owner.login} 可以连接并编辑记录，当前登录账号为 ${user.login}。`);
  }
  return repo.full_name;
}

export async function createRecord(repository: string, token: string, module: ModuleKey, values: FormValues) {
  const payload = buildIssuePayload(module, values);
  await requireRepositoryOwner(repository, token);
  const issue = await request<GitHubIssue>(`/repos/${repository}/issues`, token, { method: "POST", body: JSON.stringify(payload) });
  return recordFromIssue(module, values, issue);
}

export async function updateRecord(repository: string, token: string, record: GrowthRecord, values: FormValues, state = record.state) {
  const payload = buildIssuePayload(record.type, values);
  await requireRepositoryOwner(repository, token);
  const issue = await request<GitHubIssue>(`/repos/${repository}/issues/${record.id}`, token, { method: "PATCH", body: JSON.stringify({ title: payload.title, body: payload.body, state }) });
  return recordFromIssue(record.type, values, issue);
}

export async function deleteRecord(repository: string, token: string, record: GrowthRecord) {
  await requireRepositoryOwner(repository, token);
  await request(`/repos/${repository}/issues/${record.id}/labels`, token, { method: "POST", body: JSON.stringify({ labels: ["record:deleted"] }) });
}

function readArray<T>(key: string): T[] { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }
function writeArray<T>(key: string, values: T[]) { localStorage.setItem(key, JSON.stringify(values)); }

export function rememberPendingRecord(record: GrowthRecord) {
  const records = readArray<GrowthRecord>(PENDING_KEY).filter((item) => !(item.id === record.id && item.type === record.type));
  writeArray(PENDING_KEY, [record, ...records].slice(0, 100));
}

export function rememberRemovedRecord(record: GrowthRecord) {
  writeArray(TOMBSTONE_KEY, [{ id: record.id, type: record.type, removedAt: new Date().toISOString() }, ...readArray<Tombstone>(TOMBSTONE_KEY).filter((item) => !(item.id === record.id && item.type === record.type))].slice(0, 100));
  writeArray(PENDING_KEY, readArray<GrowthRecord>(PENDING_KEY).filter((item) => !(item.id === record.id && item.type === record.type)));
}

const upsert = <T extends GrowthRecord>(records: T[], record: T) => [record, ...records.filter((item) => item.id !== record.id)].sort((a, b) => b.activityDate.localeCompare(a.activityDate));

export function upsertLoadedRecord(data: LoadedData, record: GrowthRecord): LoadedData {
  if (record.type === "leetcode") return { ...data, leetcode: upsert(data.leetcode, record) };
  if (record.type === "papers") return { ...data, papers: upsert(data.papers, record) };
  if (record.type === "jobs") return { ...data, jobs: upsert(data.jobs, record) };
  return { ...data, goals: upsert(data.goals, record) };
}

export function removeLoadedRecord(data: LoadedData, record: GrowthRecord): LoadedData {
  if (record.type === "leetcode") return { ...data, leetcode: data.leetcode.filter((item) => item.id !== record.id) };
  if (record.type === "papers") return { ...data, papers: data.papers.filter((item) => item.id !== record.id) };
  if (record.type === "jobs") return { ...data, jobs: data.jobs.filter((item) => item.id !== record.id) };
  return { ...data, goals: data.goals.filter((item) => item.id !== record.id) };
}

export function mergePendingRecords(source: LoadedData): LoadedData {
  let data = source;
  const tombstones = readArray<Tombstone>(TOMBSTONE_KEY);
  const remainingTombstones: Tombstone[] = [];
  for (const tombstone of tombstones) {
    const records = data[tombstone.type] as GrowthRecord[];
    if (records.some((record) => record.id === tombstone.id)) { data = removeLoadedRecord(data, { ...records.find((record) => record.id === tombstone.id)! }); remainingTombstones.push(tombstone); }
  }
  writeArray(TOMBSTONE_KEY, remainingTombstones);

  const remainingPending: GrowthRecord[] = [];
  for (const pending of readArray<GrowthRecord>(PENDING_KEY)) {
    const deployed = (data[pending.type] as GrowthRecord[]).find((record) => record.id === pending.id);
    if (!deployed || deployed.updatedAt < pending.updatedAt) { data = upsertLoadedRecord(data, pending); remainingPending.push(pending); }
  }
  writeArray(PENDING_KEY, remainingPending);
  return data;
}
