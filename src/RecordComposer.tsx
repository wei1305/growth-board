import { useEffect, useState, type FormEvent } from "react";
import { Archive, Check, Cloud, CloudOff, LoaderCircle, RotateCcw, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { clearToken, createRecord, deleteRecord, readToken, rememberPendingRecord, rememberRemovedRecord, saveToken, updateRecord, validateToken } from "./github-sync";
import { defaultValues, moduleForms, recordToValues, type FormValues } from "./record-model";
import type { GrowthRecord, ModuleKey } from "./types";

interface ComposerTarget { module: ModuleKey; record?: GrowthRecord }
const COMPOSE_EVENT = "growthboard:compose";

export function openRecordComposer(module: ModuleKey, record?: GrowthRecord) {
  window.dispatchEvent(new CustomEvent<ComposerTarget>(COMPOSE_EVENT, { detail: { module, record } }));
}

function ConnectionSetup({ repository, onConnected, compact = false }: { repository: string; onConnected: () => void; compact?: boolean }) {
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [message, setMessage] = useState("");

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    if (!token.trim()) { setMessage("请输入细粒度访问令牌。"); setStatus("error"); return; }
    setStatus("checking"); setMessage("");
    try {
      await validateToken(repository, token.trim());
      saveToken(token.trim(), remember);
      setToken(""); setStatus("idle"); onConnected();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "连接失败，请重试。"); setStatus("error"); }
  };

  return <form className={`connection-setup ${compact ? "compact" : ""}`} onSubmit={connect}>
    <div className="connection-heading"><span className="connection-icon"><ShieldCheck size={21} /></span><div><strong>连接后台同步</strong><small>只需配置一次，之后所有记录都在网站内管理。</small></div></div>
    <label><span>细粒度访问令牌</span><input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="github_pat_…" aria-label="GitHub 细粒度访问令牌" /></label>
    <label className="remember-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>记住在当前浏览器</span></label>
    <p className="security-copy">只有仓库所有者账号可以连接。令牌应仅授权 <strong>{repository}</strong>，仓库权限只开启 <strong>Issues：读写</strong>。令牌不会上传到仓库或构建产物。</p>
    {message && <p className="form-error" role="alert">{message}</p>}
    <button className="primary-link" disabled={status === "checking"}>{status === "checking" ? <LoaderCircle className="spin" size={17} /> : <Cloud size={17} />}验证并连接</button>
  </form>;
}

export function ConnectionCard({ repository }: { repository: string }) {
  const [connected, setConnected] = useState(() => Boolean(readToken()));
  useEffect(() => { const update = () => setConnected(Boolean(readToken())); addEventListener("growthboard:connection", update); return () => removeEventListener("growthboard:connection", update); }, []);
  if (!connected) return <div className="panel connection-card"><ConnectionSetup repository={repository} onConnected={() => setConnected(true)} compact /></div>;
  return <div className="panel connection-card connected"><div className="connection-heading"><span className="connection-icon"><Check size={21} /></span><div><strong>后台同步已连接</strong><small>新增、编辑、归档和删除均在网站内完成。</small></div></div><div className="connection-meta"><span><Cloud size={15} /> {repository}</span><button type="button" onClick={() => { clearToken(); setConnected(false); }}><CloudOff size={15} />断开连接</button></div></div>;
}

export function RecordComposer({ repository, onSaved, onRemoved }: { repository: string; onSaved: (record: GrowthRecord) => void; onRemoved: (record: GrowthRecord) => void }) {
  const [target, setTarget] = useState<ComposerTarget | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [connected, setConnected] = useState(() => Boolean(readToken()));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const open = (event: Event) => {
      const next = (event as CustomEvent<ComposerTarget>).detail;
      setTarget(next); setValues(next.record ? recordToValues(next.record) : defaultValues(next.module)); setStatus("idle"); setMessage(""); setConfirmDelete(false); setConnected(Boolean(readToken()));
    };
    const connection = () => setConnected(Boolean(readToken()));
    addEventListener(COMPOSE_EVENT, open); addEventListener("growthboard:connection", connection);
    return () => { removeEventListener(COMPOSE_EVENT, open); removeEventListener("growthboard:connection", connection); };
  }, []);

  useEffect(() => {
    if (!target) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && status !== "saving") setTarget(null); };
    addEventListener("keydown", closeOnEscape); return () => removeEventListener("keydown", closeOnEscape);
  }, [target, status]);

  if (!target) return null;
  const schema = moduleForms[target.module];
  const close = () => { if (status !== "saving") setTarget(null); };

  const persist = async (event: FormEvent) => {
    event.preventDefault();
    const token = readToken();
    if (!token) { setConnected(false); return; }
    setStatus("saving"); setMessage("");
    try {
      const record = target.record ? await updateRecord(repository, token, target.record, values) : await createRecord(repository, token, target.module, values);
      rememberPendingRecord(record); onSaved(record); setTarget({ module: record.type, record }); setStatus("saved"); setMessage("已保存并立即更新，后台正在完成持久化同步。");
    } catch (reason) { setStatus("error"); setMessage(reason instanceof Error ? reason.message : "保存失败，请重试。"); }
  };

  const toggleArchive = async () => {
    if (!target.record) return;
    const token = readToken(); if (!token) { setConnected(false); return; }
    setStatus("saving"); setMessage("");
    try {
      const record = await updateRecord(repository, token, target.record, values, target.record.state === "closed" ? "open" : "closed");
      rememberPendingRecord(record); onSaved(record); setTarget({ module: record.type, record }); setStatus("saved"); setMessage(record.state === "closed" ? "记录已归档，页面已立即更新。" : "记录已恢复，页面已立即更新。");
    } catch (reason) { setStatus("error"); setMessage(reason instanceof Error ? reason.message : "操作失败，请重试。"); }
  };

  const remove = async () => {
    if (!target.record) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    const token = readToken(); if (!token) { setConnected(false); return; }
    setStatus("saving"); setMessage("");
    try { await deleteRecord(repository, token, target.record); rememberRemovedRecord(target.record); onRemoved(target.record); setTarget(null); }
    catch (reason) { setStatus("error"); setMessage(reason instanceof Error ? reason.message : "删除失败，请重试。"); }
  };

  return <div className="dialog-backdrop composer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="composer-dialog" role="dialog" aria-modal="true" aria-labelledby="composer-title">
      <header><div><span className={`task-icon ${target.module}`}>{target.record ? <Save size={18} /> : <Cloud size={18} />}</span><div><span className="eyebrow">{target.record ? `记录 #${target.record.id}` : "新记录"}</span><h2 id="composer-title">{target.record ? `编辑${schema.label}记录` : `添加${schema.label}记录`}</h2></div></div><button type="button" onClick={close} aria-label="关闭记录表单"><X size={20} /></button></header>
      {!connected ? <div className="composer-connect"><ConnectionSetup repository={repository} onConnected={() => setConnected(true)} /></div> : <form className="record-form" onSubmit={persist}>
        {target.module === "jobs" && <div className="privacy-note"><ShieldCheck size={18} /><span><strong>公开数据提醒</strong> 后台仍使用公开 Issue 存储，请勿填写私人联系方式、薪资或保密信息。</span></div>}
        <div className="field-grid">{schema.fields.map((field) => <label className={field.wide ? "wide" : ""} key={field.name}><span>{field.label}{field.required && <b> *</b>}</span>{field.type === "select" ? <select required={field.required} value={values[field.name] || ""} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}>{field.options?.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select> : field.type === "textarea" ? <textarea value={values[field.name] || ""} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} placeholder={field.placeholder} rows={3} /> : <input type={field.type} required={field.required} min={field.min} max={field.max} value={values[field.name] || ""} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} placeholder={field.placeholder} />}</label>)}</div>
        {message && <p className={status === "saved" ? "form-success" : "form-error"} role="status">{status === "saved" && <Check size={16} />}{message}</p>}
        <footer>{target.record && <div className="secondary-actions"><button type="button" onClick={toggleArchive} disabled={status === "saving"}>{target.record.state === "closed" ? <RotateCcw size={16} /> : <Archive size={16} />}{target.record.state === "closed" ? "恢复" : "归档"}</button><button type="button" className={confirmDelete ? "confirm-delete" : ""} onClick={remove} disabled={status === "saving"}><Trash2 size={16} />{confirmDelete ? "再次点击确认删除" : "删除"}</button></div>}<div className="form-actions"><button type="button" onClick={close}>取消</button><button className="primary-link" disabled={status === "saving"}>{status === "saving" ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{target.record ? "保存修改" : "保存记录"}</button></div></footer>
      </form>}
    </section>
  </div>;
}
