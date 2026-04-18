import {
  Utensils,
  ShoppingCart,
  ShoppingBag,
  Car,
  Plane,
  Film,
  Receipt,
  Zap,
  Home,
  HeartPulse,
  Dumbbell,
  Coffee,
  BookOpen,
  Gift,
  User,
  CircleDot,
  Tag,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  car: Car,
  plane: Plane,
  film: Film,
  receipt: Receipt,
  zap: Zap,
  home: Home,
  "heart-pulse": HeartPulse,
  dumbbell: Dumbbell,
  coffee: Coffee,
  "book-open": BookOpen,
  gift: Gift,
  user: User,
  "circle-dot": CircleDot,
  tag: Tag,
};

export function CategoryIcon({
  name,
  size = 16,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const Icon = ICON_MAP[name] ?? Tag;
  return <Icon size={size} color={color} />;
}
