import {
  House,
  Tag,
  Heart,
  User,
  Store,
  Utensils,
  Coffee,
  Scissors,
  ShoppingBag,
  Wrench,
  Car,
  Grid3x3,
  type LucideIcon,
} from 'lucide-react-native'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  home: House,
  utensils: Utensils,
  coffee: Coffee,
  scissors: Scissors,
  heart: Heart,
  'shopping-bag': ShoppingBag,
  wrench: Wrench,
  car: Car,
}

export function categoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS[name] ?? Grid3x3
}

export const TabIcons = { House, Tag, Heart, User, Store }
