// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { addLine, cartStore, removeLine, updateQuantity } from './cart';

/** Epic 16 (16.5 AC3, note 9) — the per-stay client cart. */

const line = (o: Partial<Parameters<typeof addLine>[1]> = {}) => ({
  itemId: 'item-1',
  variantKey: null,
  quantity: 1,
  note: '',
  ...o,
});

describe('cartStore', () => {
  beforeEach(() => localStorage.clear());

  it('persists per stay and survives reloads (AC3)', () => {
    cartStore.save({ stayId: 'stay-1', lines: [line({ quantity: 2 })] });
    expect(cartStore.load('stay-1').lines).toHaveLength(1);
    expect(cartStore.load('stay-1').lines[0].quantity).toBe(2);
  });

  it("discards another stay's cart on load (note 9 — keyed by stay)", () => {
    cartStore.save({ stayId: 'stay-1', lines: [line()] });
    expect(cartStore.load('stay-2').lines).toHaveLength(0);
  });

  it('clear removes the stored cart', () => {
    cartStore.save({ stayId: 'stay-1', lines: [line()] });
    cartStore.clear();
    expect(cartStore.load('stay-1').lines).toHaveLength(0);
  });

  it('corrupt storage falls back to an empty cart', () => {
    localStorage.setItem('gxp_guest_cart_v1', '{not json');
    expect(cartStore.load('stay-1').lines).toHaveLength(0);
  });
});

describe('cart line helpers', () => {
  const empty = { stayId: 'stay-1', lines: [] };

  it('merges same item+variant+note into one line, capped at 20', () => {
    let cart = addLine(empty, line({ quantity: 2 }));
    cart = addLine(cart, line({ quantity: 3 }));
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(5);
    cart = addLine(cart, line({ quantity: 19 }));
    expect(cart.lines[0].quantity).toBe(20);
  });

  it('different variants stay separate lines', () => {
    let cart = addLine(empty, line({ variantKey: 'medium' }));
    cart = addLine(cart, line({ variantKey: 'large' }));
    expect(cart.lines).toHaveLength(2);
  });

  it('updateQuantity edits in place; zero removes the line', () => {
    let cart = addLine(empty, line({ quantity: 2 }));
    cart = updateQuantity(cart, 0, 5);
    expect(cart.lines[0].quantity).toBe(5);
    cart = updateQuantity(cart, 0, 0);
    expect(cart.lines).toHaveLength(0);
  });

  it('removeLine drops exactly the indexed line', () => {
    let cart = addLine(empty, line());
    cart = addLine(cart, line({ itemId: 'item-2' }));
    cart = removeLine(cart, 0);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].itemId).toBe('item-2');
  });
});
