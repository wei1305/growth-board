export type ModuleKey = "leetcode" | "papers" | "jobs" | "goals";
export interface SiteConfig { siteName: string; ownerName: string; tagline: string; repository: string; locale: string; theme: "light" | "dark" | "system"; modules: Record<ModuleKey, boolean>; profile: { headline: string; bio: string } }
export interface BaseRecord { id: number; type: ModuleKey; title: string; issueUrl: string; state: "open" | "closed"; archived: boolean; labels: string[]; createdAt: string; updatedAt: string; activityDate: string; pending?: boolean }
export interface LeetcodeRecord extends BaseRecord { type: "leetcode"; problemUrl?: string; difficulty: "easy" | "medium" | "hard"; language?: string; topics: string[]; solvedAt?: string; nextReviewAt?: string; mastery?: number; status: string; summary?: string; mistakes?: string; solutionUrl?: string }
export interface PaperRecord extends BaseRecord { type: "papers"; authors?: string; venue?: string; year?: string; paperUrl?: string; codeUrl?: string; researchArea?: string; status: string; progress?: number; rating?: number; startedAt?: string; finishedAt?: string; nextReviewAt?: string; summary?: string; contribution?: string }
export interface JobRecord extends BaseRecord { type: "jobs"; company: string; role?: string; location?: string; jobUrl?: string; channel?: string; appliedAt?: string; stage: string; nextStepAt?: string; note?: string; result?: string }
export interface GoalRecord extends BaseRecord { type: "goals"; module?: ModuleKey; period?: string; startAt?: string; dueAt?: string; targetValue: number; currentValue: number; metric?: string; status: string; review?: string }
export type GrowthRecord = LeetcodeRecord | PaperRecord | JobRecord | GoalRecord;
export interface DataEnvelope<T> { generatedAt: string; repository: string; records: T[] }
export interface LoadedData { config: SiteConfig; leetcode: LeetcodeRecord[]; papers: PaperRecord[]; jobs: JobRecord[]; goals: GoalRecord[]; generatedAt: string }
