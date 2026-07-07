import { type GraphLabels, type GraphSettings, type GraphFilters, type NodeType } from "../types";

// Indonesian defaults (matches the app's bilingual voice). Every string is overridable via the
// `labels` prop — props-driven portability, no inline copy in components. {title}/{n} interpolate.
export const DEFAULT_LABELS: GraphLabels = {
  brand: "Memory",
  heroTitle: "Grafik Memory",
  heroSubtitle: "Memory, agent, skill & tool",
  addPlaceholder: "Tambah memory",
  addUnder: "Tambah memory di {title}",
  subnodeOf: "Subnode dari:",
  importLabel: "Impor",
  hint: "LLM bisa salah dan panggilan memakai kredit",
  help: "Seret kanvas untuk geser · Scroll untuk zoom · Hover node untuk tombol Tambah · Seret node · Panel kanan atur filter/tampilan/gaya · Tekan / untuk menambah · Esc untuk reset",
  inspectorEmpty: "Klik memory, cluster, agent, skill, atau tool untuk melihat detail.",
  inspectFocus: "Fokus",
  inspectAddChild: "Tambah anak",
  inspectClose: "Tutup",
  filters: "Filter",
  searchPlaceholder: "Cari node…",
  tags: "Tag",
  attachments: "Lampiran",
  existingOnly: "Yang ada saja",
  orphans: "Orphan",
  groups: "Grup",
  display: "Tampilan",
  arrows: "Panah",
  textFade: "Ambang pudar teks",
  nodeSize: "Ukuran node",
  linkThickness: "Ketebalan link",
  animate: "Animasikan",
  animateStop: "Hentikan animasi",
  forces: "Gaya",
  centerForce: "Gaya tengah",
  repelForce: "Gaya tolak",
  linkForce: "Gaya link",
  linkDistance: "Jarak link",
  reset: "Reset",
  toastAdded: "Memory ditambahkan",
  toastSubAdded: "Sub memory ditambahkan",
  toastImported: "{n} memory diimpor",
  toastReset: "Kontrol direset",
  toastAddSub: "Tambah sub memory",
  addMemoryLabel: "Tambah memory",
};

export const DEFAULT_SETTINGS: GraphSettings = {
  arrows: false,
  textFade: 42,
  nodeSize: 100,
  linkThickness: 100,
  animate: false,
  centerForce: 47,
  repelForce: 56,
  linkForce: 96,
  linkDistance: 170,
};

// groups is seeded from the actual clusters at runtime (all visible) — see use-graph-state.
export const DEFAULT_FILTERS: Omit<GraphFilters, "groups"> = {
  query: "",
  tags: false,
  attachments: true,
  existingOnly: true,
  orphans: true,
};

export const TYPE_LABEL: Record<NodeType, string> = {
  core: "Core",
  cluster: "Cluster",
  memory: "Memory",
  agent: "Agent",
  skill: "Skill",
  tool: "Tool",
};

export const WORLD = { width: 1600, height: 1000, cx: 800, cy: 500 } as const;
