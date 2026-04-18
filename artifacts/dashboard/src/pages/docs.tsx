import { BookOpen, ExternalLink } from "lucide-react";

const docSections = [
  {
    title: "快速开始",
    items: [
      { label: "OpenAI SDK 接入示例", code: 'client = OpenAI(base_url="https://your.replit.app/proxy/v1", api_key="sk-proxy-xxx")' },
      { label: "curl 测试", code: 'curl -X POST https://your.replit.app/proxy/v1/chat/completions \\\n  -H "Authorization: Bearer sk-proxy-xxx" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}\'' },
    ],
  },
  {
    title: "模型前缀规则",
    items: [
      { label: "OpenAI", code: 'gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, o1, o3-mini, o4-mini ...' },
      { label: "Anthropic", code: 'claude-opus-4-5, claude-sonnet-4-5, claude-haiku-3-5, claude-3-7-sonnet ...' },
      { label: "Gemini", code: 'gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-pro ...' },
    ],
  },
  {
    title: "多模态示例",
    items: [
      { label: "图片 + 文字（所有提供商统一格式）", code: '{\n  "model": "gemini-2.5-pro",\n  "messages": [{\n    "role": "user",\n    "content": [\n      {"type": "text", "text": "这张图里有什么？"},\n      {"type": "image_url", "image_url": {"url": "https://..."}}\n    ]\n  }]\n}' },
    ],
  },
];

export default function Docs() {
  return (
    <div className="px-6 py-6 max-w-[900px] mx-auto w-full space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded bg-blue-500" />
        <h2 className="text-base font-semibold text-white">项目文档</h2>
      </div>

      <div className="space-y-5">
        {docSections.map((section) => (
          <div key={section.title} className="rounded-lg border border-[#1e2d3d] bg-[#111827] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e2d3d] bg-[#0f1923]">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">{section.title}</span>
            </div>
            <div className="p-4 space-y-4">
              {section.items.map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-slate-400 mb-2">{item.label}</p>
                  <pre className="bg-[#0d1117] border border-[#1e2d3d] rounded p-3 text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                    {item.code}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[#1e2d3d] bg-[#111827]">
          <ExternalLink className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <p className="text-xs text-slate-400">
            统计 API 完整文档见 <span className="text-blue-400 font-mono">/api/stats/*</span> 端点；支持 CORS 跨域请求。
          </p>
        </div>
      </div>
    </div>
  );
}
