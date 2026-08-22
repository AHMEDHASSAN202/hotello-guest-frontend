const CART_KEY = 'gxp_guest_cart_v1';

/**
 * Client-persisted cart, keyed per stay (Epic 16, note 9) — there is no
 * server cart in MVP; the order POST is the source of truth. Survives app
 * restarts until ordered/cleared (16.5 AC3); a cart from another stay is
 * discarded on load. Same single-purpose-module shape as tokenStore.
 */
export interface CartLine {
  itemId: string;
  /** Variant option key or null; same item+option merge into one line. */
  variantKey: string | null;
  quantity: number;
  note: string;
}

export interface GuestCart {
  stayId: string;
  lines: CartLine[];
}

const sameLine = (a: CartLine, b: CartLine): boolean =>
  a.itemId === b.itemId && a.variantKey === b.variantKey;

export const cartStore = {
  load(stayId: string): GuestCart {
    const empty: GuestCart = { stayId, lines: [] };
    if (typeof window === 'undefined') return empty;
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw) as GuestCart;
      // Stay death / another stay → the old cart is gone (note 9).
      if (parsed.stayId !== stayId || !Array.isArray(parsed.lines)) return empty;
      return parsed;
    } catch {
      return empty;
    }
  },

  save(cart: GuestCart) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  },

  clear() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CART_KEY);
  },
};

/** Pure helpers — the dining screens call these and save the result. */
export function addLine(cart: GuestCart, line: CartLine): GuestCart {
  const existing = cart.lines.find((l) => sameLine(l, line));
  if (existing && existing.note === line.note) {
    return {
      ...cart,
      lines: cart.lines.map((l) =>
        sameLine(l, line)
          ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) }
          : l,
      ),
    };
  }
  return { ...cart, lines: [...cart.lines, line] };
}

export function updateQuantity(
  cart: GuestCart,
  index: number,
  quantity: number,
): GuestCart {
  if (quantity <= 0) {
    return { ...cart, lines: cart.lines.filter((_, i) => i !== index) };
  }
  return {
    ...cart,
    lines: cart.lines.map((l, i) =>
      i === index ? { ...l, quantity: Math.min(20, quantity) } : l,
    ),
  };
}

export function removeLine(cart: GuestCart, index: number): GuestCart {
  return { ...cart, lines: cart.lines.filter((_, i) => i !== index) };
}
