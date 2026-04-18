import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, Copy, Check, Eye, EyeOff, Key, Lock, Unlock, RefreshCw } from "lucide-react";
import { formatK } from "@/lib/format";

interface ApiKeyRecord {
  id: number;
  name: string;
  keyPrefix: string;
  key?: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
}

interface NewKeyResult extends ApiKeyRecord {
  key: string;
}

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";
const ADMIN_KEY_STORAGE = "proxy_admin_key";

function CopyInline({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-all ${copied ? "bg-emerald-500/20 text-emerald-400" : "bg-[#1e2d3d] text-slate-400 hover:text-slate-200"}`}>
      {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
      {copied ? "已复制" : "复制"}
    </button>
  );
}

function KeyCell({ k }: { k: ApiKeyRecord }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const fullKey = k.key ?? null;

  const copyFull = async () => {
    if (!fullKey) return;
    await navigator.clipboard.writeText(fullKey).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!fullKey) {
    return (
      <div className="flex items-center gap-2">
        <code className="font-mono text-violet-300 bg-[#0d1117] border border-[#1e2d3d] rounded px-2 py-0.5">
          {k.keyPrefix}
        </code>
        <span className="text-[10px] text-amber-400/80" title="此密钥在升级前创建，仅存哈希，无法找回完整内容">
          仅哈希
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <code
        className={`font-mono text-violet-300 bg-[#0d1117] border border-[#1e2d3d] rounded px-2 py-0.5 max-w-[260px] truncate ${!visible ? "select-none" : ""}`}
        title={visible ? fullKey : undefined}
      >
        {visible ? fullKey : k.keyPrefix}
      </code>
      <button
        onClick={() => setVisible(!visible)}
        className="text-slate-500 hover:text-slate-200 transition-colors"
        title={visible ? "隐藏" : "查看完整密钥"}
        data-testid={`button-toggle-key-${k.id}`}
      >
        {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={copyFull}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-all ${copied ? "bg-emerald-500/20 text-emerald-400" : "bg-[#1e2d3d] text-slate-400 hover:text-slate-200"}`}
        title="复制完整密钥"
        data-testid={`button-copy-full-key-${k.id}`}
      >
        {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
        {copied ? "已复制" : "复制完整"}
      </button>
    </div>
  );
}

function NewKeyModal({ onCreated, adminKey }: { onCreated: (key: NewKeyResult) => void; adminKey: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    if (!name.trim()) { setError("请输入密钥名称"); return; }
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${BASE_URL}/api/keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { Authorization: `Bearer ${adminKey}` } : {}),
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${resp.status}`);
      }
      const data: NewKeyResult = await resp.json();
      onCreated(data);
      setName("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        生成新密钥
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111827] border border-[#1e2d3d] rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Key className="w-4 h-4 text-blue-400" />
          生成新 API 密钥
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">密钥名称（用于标识用途，例如：我的应用）</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="例如：生产环境 / 客户端 A"
              className="w-full px-3 py-2 rounded bg-[#0d1117] border border-[#1e2d3d] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={create}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {loading ? "生成中…" : "生成"}
            </button>
            <button
              onClick={() => { setOpen(false); setName(""); setError(""); }}
              className="px-4 py-2 rounded border border-[#1e2d3d] text-slate-300 text-sm hover:bg-[#1e2d3d] transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevealModal({ result, onClose }: { result: NewKeyResult; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(result.key).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111827] border border-[#1e2d3d] rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-white font-semibold">密钥已生成：{result.name}</h3>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 mb-4">
          <p className="text-xs text-amber-400 font-medium">⚠️ 请立即保存此密钥，关闭后将无法再次查看</p>
        </div>
        <div className="relative mb-4">
          <pre className={`w-full px-3 py-3 rounded bg-[#0d1117] border border-[#1e2d3d] text-sm font-mono text-emerald-300 overflow-x-auto break-all ${!visible ? "filter blur-sm select-none" : ""}`}>
            {result.key}
          </pre>
          <button
            onClick={() => setVisible(!visible)}
            className="absolute top-2.5 right-2.5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${copied ? "bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "已复制" : "复制密钥"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-[#1e2d3d] text-slate-300 text-sm hover:bg-[#1e2d3d] transition-colors"
          >
            我已保存，关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminKeyBar({ adminKey, onSave }: { adminKey: string; onSave: (k: string) => void }) {
  const [input, setInput] = useState(adminKey);
  const [show, setShow] = useState(false);

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#1e2d3d] bg-[#111827]">
      <div className="flex items-center gap-2 flex-shrink-0">
        {adminKey ? <Unlock className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-amber-400" />}
        <span className="text-xs text-slate-400">管理员密钥</span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <input
          type={show ? "text" : "password"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave(input.trim())}
          placeholder="输入 PROXY_API_KEYS 中的任一密钥（若未配置则留空）"
          className="flex-1 px-3 py-1.5 rounded bg-[#0d1117] border border-[#1e2d3d] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 font-mono"
        />
        <button onClick={() => setShow(!show)} className="text-slate-500 hover:text-slate-300">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button
          onClick={() => onSave(input.trim())}
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
        >
          保存
        </button>
      </div>
      {adminKey && (
        <span className="text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono flex-shrink-0">已认证</span>
      )}
    </div>
  );
}

export default function Keys() {
  const [adminKey, setAdminKey] = useState<string>(() => localStorage.getItem(ADMIN_KEY_STORAGE) ?? "");
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newResult, setNewResult] = useState<NewKeyResult | null>(null);

  const saveAdminKey = (k: string) => {
    setAdminKey(k);
    if (k) localStorage.setItem(ADMIN_KEY_STORAGE, k);
    else localStorage.removeItem(ADMIN_KEY_STORAGE);
  };

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${BASE_URL}/api/keys`, {
        headers: adminKey ? { Authorization: `Bearer ${adminKey}` } : {},
      });
      if (resp.status === 403) {
        setError("认证失败：请在上方输入有效的管理员密钥");
        setKeys([]);
        return;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setKeys(await resp.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const toggleKey = async (id: number) => {
    try {
      const resp = await fetch(`${BASE_URL}/api/keys/${id}/toggle`, {
        method: "PATCH",
        headers: adminKey ? { Authorization: `Bearer ${adminKey}` } : {},
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const updated: ApiKeyRecord = await resp.json();
      setKeys((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
    } catch (err) {
      alert("操作失败：" + (err instanceof Error ? err.message : String(err)));
    }
  };

  const deleteKey = async (id: number, name: string) => {
    if (!confirm(`确认删除密钥「${name}」？此操作不可撤销。`)) return;
    try {
      const resp = await fetch(`${BASE_URL}/api/keys/${id}`, {
        method: "DELETE",
        headers: adminKey ? { Authorization: `Bearer ${adminKey}` } : {},
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      alert("删除失败：" + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleCreated = (result: NewKeyResult) => {
    setNewResult(result);
    setKeys((prev) => [result, ...prev]);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "从未";
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="px-6 py-6 max-w-[900px] mx-auto w-full space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded bg-blue-500" />
          <h2 className="text-base font-semibold text-white">密钥管理</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchKeys} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#1e2d3d] text-xs text-slate-300 hover:bg-[#1e2d3d] transition-colors">
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
          <NewKeyModal onCreated={handleCreated} adminKey={adminKey} />
        </div>
      </div>

      <AdminKeyBar adminKey={adminKey} onSave={saveAdminKey} />

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e2d3d] bg-[#0f1923]">
          <Key className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">API 密钥列表</span>
          <span className="ml-auto text-xs text-slate-500 font-mono">{keys.length} 个密钥</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">加载中…</div>
        ) : keys.length === 0 ? (
          <div className="py-12 text-center">
            <Key className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">暂无密钥，点击「生成新密钥」创建</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2d3d]">
                <th className="px-4 py-2.5 text-left text-slate-500 font-medium">名称</th>
                <th className="px-4 py-2.5 text-left text-slate-500 font-medium">密钥前缀</th>
                <th className="px-4 py-2.5 text-left text-slate-500 font-medium">创建时间</th>
                <th className="px-4 py-2.5 text-left text-slate-500 font-medium">最后使用</th>
                <th className="px-4 py-2.5 text-center text-slate-500 font-medium">状态</th>
                <th className="px-4 py-2.5 text-center text-slate-500 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr
                  key={k.id}
                  className={`border-b border-[#1e2d3d]/50 last:border-0 hover:bg-white/[0.02] transition-colors ${!k.isActive ? "opacity-50" : ""}`}
                  data-testid={`key-row-${k.id}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-200">{k.name}</td>
                  <td className="px-4 py-3">
                    <KeyCell k={k} />
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">{formatDate(k.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{formatDate(k.lastUsedAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleKey(k.id)}
                      title={k.isActive ? "点击停用" : "点击启用"}
                      className="transition-colors"
                    >
                      {k.isActive ? (
                        <ToggleRight className="w-5 h-5 text-emerald-400 mx-auto" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-slate-600 mx-auto" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => deleteKey(k.id, k.name)}
                      title="删除密钥"
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mx-auto" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] px-4 py-3">
        <p className="text-xs text-slate-500 leading-relaxed">
          客户端使用生成的密钥作为 Bearer Token：<code className="text-violet-300 font-mono">Authorization: Bearer sk-proxy-xxx</code>。
          密钥生成后仅显示一次，请立即保存。停用后的密钥立即失效；如需重新启用，切换状态即可。
          <span className="text-amber-400 ml-1">环境变量 <code>PROXY_API_KEYS</code> 中的主密钥仍然有效（向下兼容）。</span>
        </p>
      </div>

      {newResult && (
        <RevealModal result={newResult} onClose={() => setNewResult(null)} />
      )}
    </div>
  );
}
