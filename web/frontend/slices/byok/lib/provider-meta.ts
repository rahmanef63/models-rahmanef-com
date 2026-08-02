// byok-domain metadata: provider display labels, the supported-count, and the Cred/Catalog shapes the
// Providers UI + chat model picker read. Lives in byok — these are provider concerns, not app-generic
// (they used to sit in app/_components/shared, which coupled the slice to the app root).
export const PROVIDER_LABEL: Record<string, string> = {
  "openai-codex": "OpenAI · ChatGPT / Codex",
  "anthropic-oauth": "Claude · Pro / Max",
  "github-copilot": "GitHub Copilot · subscription",
  openrouter: "OpenRouter",
  openai: "OpenAI API",
  anthropic: "Anthropic",
  google: "Google Gemini",
  groq: "Groq",
  deepseek: "DeepSeek",
  xai: "xAI",
  mistral: "Mistral",
  moonshotai: "Moonshot",
  togetherai: "Together AI",
  "fireworks-ai": "Fireworks",
  cerebras: "Cerebras",
  perplexity: "Perplexity",
  deepinfra: "DeepInfra",
  nebius: "Nebius",
  hyperbolic: "Hyperbolic",
  sambanova: "SambaNova",
  novita: "Novita",
  cohere: "Cohere",
  glm: "Zhipu GLM",
  "github-models": "GitHub Models",
  "vercel-gateway": "Vercel AI Gateway",
  "moonshotai-cn": "Moonshot (China)",
  nvidia: "NVIDIA NIM",
  huggingface: "Hugging Face",
  alibaba: "Alibaba Qwen",
  siliconflow: "SiliconFlow",
  "ollama-cloud": "Ollama Cloud",
  xiaomi: "Xiaomi MiMo",
  baseten: "Baseten",
  "nano-gpt": "NanoGPT",
  zenmux: "ZenMux",
};

export type Cred = { provider: string; kind: string; models?: string[]; keyCount?: number; lastCheckedAt?: number; lastCheckedOk?: boolean; lastCheckedCode?: string; lastCheckedDetail?: string };
export type Catalog = Record<string, { models?: Record<string, unknown> }>;

export const SUPPORTED = 32; // key-paste providers (openai/anthropic/google/openrouter + 28 OpenAI-compatible); OAuth (codex/claude/copilot) + custom endpoints on top
