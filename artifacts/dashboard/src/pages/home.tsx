import {
  GitBranch, Layers, Wrench, Brain, Key,
  Radio, Server, Settings2, Activity, Lock,
} from "lucide-react";

interface FeatureCard {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
}

const features: FeatureCard[] = [
  {
    icon: GitBranch,
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
    title: "智能模型路由",
    description: "根据模型名称前缀自动路由：gemini-* → Gemini，claude-* → Anthropic，其余均走 OpenAI。单一入口覆盖所有后端，无需手动切换。",
  },
  {
    icon: Layers,
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
    title: "多格式自动兼容",
    description: "同时提供 /proxy/v1/chat/completions（OpenAI 格式）和 /proxy/v1/messages（Anthropic 格式）两个端点，原生客户端无缝接入。",
  },
  {
    icon: Wrench,
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-400",
    title: "工具调用 / Function Calling",
    description: "完整支持 OpenAI 格式 tools + tool_calls，自动转换到 Anthropic（tool_use）和 Gemini（functionDeclarations）原生格式，跨后端无缝调用。",
  },
  {
    icon: Brain,
    iconBg: "bg-pink-500/20",
    iconColor: "text-pink-400",
    title: "扩展思考模式",
    description: "在模型名称后加 -thinking（隐藏推理过程）或 -thinking-visible（展示推理过程）后缀，自动为 Claude 和 Gemini 开启扩展思考，灵活控制输出。",
  },
  {
    icon: Key,
    iconBg: "bg-yellow-500/20",
    iconColor: "text-yellow-400",
    title: "多种认证方式",
    description: "同时支持 Authorization: Bearer、x-goog-api-key 请求头、?key= URL 参数三种认证方式，兼容 OpenAI / Gemini / Anthropic 各类主流客户端。",
  },
  {
    icon: Radio,
    iconBg: "bg-cyan-500/20",
    iconColor: "text-cyan-400",
    title: "流式输出 SSE",
    description: "三个后端（OpenAI、Anthropic、Gemini）均支持 Server-Sent Events 流式输出，统一转为 OpenAI chunk 格式，实时逐 Token 返回。",
  },
  {
    icon: Server,
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
    title: "高并发多进程",
    description: "生产环境自动启用 Node.js Cluster 多进程模式，按 CPU 核心数（最多 4 Worker）并行处理请求，Worker 崩溃后自动重启，开发环境保持单进程。",
  },
  {
    icon: Lock,
    iconBg: "bg-violet-500/20",
    iconColor: "text-violet-400",
    title: "动态密钥管理",
    description: "支持在密钥管理页实时生成 sk-proxy-* 格式 API Key，存储 SHA-256 哈希，密钥本身不落库。可随时启停或删除，停用后立即失效。",
  },
  {
    icon: Settings2,
    iconBg: "bg-indigo-500/20",
    iconColor: "text-indigo-400",
    title: "在线密钥配置",
    description: "通过 Portal 界面在线管理 API 密钥：一键生成、启停、删除。密钥生成后仅显示一次，请立即保存。环境变量中的主密钥向下兼容，可同时使用。",
  },
  {
    icon: Activity,
    iconBg: "bg-rose-500/20",
    iconColor: "text-rose-400",
    title: "实时监控与日志",
    description: "内置统计面板：请求量、Token 用量、费用估算、延迟分布、按供应商分布等全维度图表。实时日志页以 SSE 推送请求详情，支持状态筛选。",
  },
];

export default function Home() {
  return (
    <div className="px-6 py-6 max-w-[1200px] mx-auto w-full">
      <div className="mb-6">
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">核心功能</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-lg border border-[#1e2d3d] bg-[#111827]/80 p-4 hover:border-[#2d3f53] hover:bg-[#111827] transition-all group"
            data-testid={`feature-card-${feature.title}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-md ${feature.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <feature.icon className={`w-4 h-4 ${feature.iconColor}`} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-blue-300 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
