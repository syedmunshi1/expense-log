// Deterministic visual identity for each category.
// Given a freeform category string, returns a color + lucide icon name.

export type CategoryVisual = {
  color: string; // tailwind-compatible hex
  bg: string; // background tint (rgba)
  icon: string; // lucide-react icon name
};

const CATEGORY_MAP: Record<string, CategoryVisual> = {
  food: { color: "#f97316", bg: "rgba(249, 115, 22, 0.12)", icon: "utensils" },
  dining: { color: "#f97316", bg: "rgba(249, 115, 22, 0.12)", icon: "utensils" },
  groceries: { color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", icon: "shopping-cart" },
  grocery: { color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", icon: "shopping-cart" },
  transport: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", icon: "car" },
  travel: { color: "#0ea5e9", bg: "rgba(14, 165, 233, 0.12)", icon: "plane" },
  shopping: { color: "#ec4899", bg: "rgba(236, 72, 153, 0.12)", icon: "shopping-bag" },
  entertainment: { color: "#a855f7", bg: "rgba(168, 85, 247, 0.12)", icon: "film" },
  bills: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)", icon: "receipt" },
  utilities: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)", icon: "zap" },
  rent: { color: "#dc2626", bg: "rgba(220, 38, 38, 0.12)", icon: "home" },
  health: { color: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)", icon: "heart-pulse" },
  fitness: { color: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)", icon: "dumbbell" },
  coffee: { color: "#a16207", bg: "rgba(161, 98, 7, 0.12)", icon: "coffee" },
  education: { color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)", icon: "book-open" },
  gifts: { color: "#f43f5e", bg: "rgba(244, 63, 94, 0.12)", icon: "gift" },
  personal: { color: "#14b8a6", bg: "rgba(20, 184, 166, 0.12)", icon: "user" },
  other: { color: "#6b7280", bg: "rgba(107, 114, 128, 0.12)", icon: "circle-dot" },
};

const FALLBACK_COLORS = [
  { color: "#f97316", bg: "rgba(249, 115, 22, 0.12)" },
  { color: "#10b981", bg: "rgba(16, 185, 129, 0.12)" },
  { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)" },
  { color: "#ec4899", bg: "rgba(236, 72, 153, 0.12)" },
  { color: "#a855f7", bg: "rgba(168, 85, 247, 0.12)" },
  { color: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)" },
  { color: "#eab308", bg: "rgba(234, 179, 8, 0.12)" },
  { color: "#14b8a6", bg: "rgba(20, 184, 166, 0.12)" },
];

export function visualFor(category: string): CategoryVisual {
  const key = category.toLowerCase();
  for (const k of Object.keys(CATEGORY_MAP)) {
    if (key.includes(k)) return CATEGORY_MAP[k];
  }
  // Hash-based fallback for unknown categories
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  }
  const pick = FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
  return { ...pick, icon: "tag" };
}
