import { nanoid } from "nanoid";

export type BasketItemType = "influencer" | "keyword" | "hashtag" | "topic";

export interface BasketItem {
  id: string;
  type: BasketItemType;
  label: string;
  data: Record<string, unknown>;
}

export interface Basket {
  id: string;
  name: string;
  items: BasketItem[];
  createdAt: string;
}

const ACTIVE_KEY = "fbm-active-basket";
const SAVED_KEY = "fbm-saved-baskets";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Active basket (in-progress collection) ──

export function getActiveBasket(): BasketItem[] {
  return read<BasketItem[]>(ACTIVE_KEY, []);
}

export function addToBasket(item: BasketItem): BasketItem[] {
  const items = getActiveBasket();
  if (items.some((i) => i.id === item.id)) return items;
  const updated = [...items, item];
  write(ACTIVE_KEY, updated);
  return updated;
}

export function removeFromBasket(itemId: string): BasketItem[] {
  const updated = getActiveBasket().filter((i) => i.id !== itemId);
  write(ACTIVE_KEY, updated);
  return updated;
}

export function isInBasket(itemId: string): boolean {
  return getActiveBasket().some((i) => i.id === itemId);
}

export function clearActiveBasket(): BasketItem[] {
  write(ACTIVE_KEY, []);
  return [];
}

// ── Saved baskets ──

export function saveBasket(name: string): Basket {
  const basket: Basket = {
    id: nanoid(10),
    name,
    items: getActiveBasket(),
    createdAt: new Date().toISOString(),
  };
  const saved = loadBaskets();
  write(SAVED_KEY, [...saved, basket]);
  clearActiveBasket();
  return basket;
}

export function loadBaskets(): Basket[] {
  return read<Basket[]>(SAVED_KEY, []);
}

export function loadBasketById(id: string): Basket | null {
  return loadBaskets().find((b) => b.id === id) ?? null;
}

export function deleteBasket(id: string): Basket[] {
  const updated = loadBaskets().filter((b) => b.id !== id);
  write(SAVED_KEY, updated);
  return updated;
}
