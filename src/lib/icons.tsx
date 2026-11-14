import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Bus,
  CalendarClock,
  ChartColumn,
  CircleEllipsis,
  CirclePlus,
  Coffee,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Repeat,
  Shirt,
  Target,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  bus: Bus,
  house: House,
  zap: Zap,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  coffee: Coffee,
  shirt: Shirt,
  "circle-ellipsis": CircleEllipsis,
  wallet: Wallet,
  "plus-circle": CirclePlus,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function CategoryIcon({
  name,
  className = "h-4 w-4",
}: {
  name?: string | null;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[name ?? ""] ?? CircleEllipsis;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}

export {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  ChartColumn,
  Landmark,
  Repeat,
  Target,
};
