import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import en from '../../messages/en';
import { BottomSheet } from './bottom-sheet';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('BottomSheet (14.5 AC2 — drag-to-dismiss picker)', () => {
  it('renders children in a dialog when open', () => {
    wrap(
      <BottomSheet open onClose={() => {}} title="Language">
        <p>sheet content</p>
      </BottomSheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Language' })).toBeTruthy();
    expect(screen.getByText('sheet content')).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    wrap(
      <BottomSheet open={false} onClose={() => {}}>
        <p>hidden</p>
      </BottomSheet>,
    );
    expect(screen.queryByText('hidden')).toBeNull();
  });

  it('backdrop tap dismisses', () => {
    const onClose = vi.fn();
    wrap(
      <BottomSheet open onClose={onClose}>
        <p>content</p>
      </BottomSheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape dismisses', () => {
    const onClose = vi.fn();
    wrap(
      <BottomSheet open onClose={onClose}>
        <p>content</p>
      </BottomSheet>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('drag past the threshold dismisses', () => {
    const onClose = vi.fn();
    wrap(
      <BottomSheet open onClose={onClose}>
        <p>content</p>
      </BottomSheet>,
    );
    const grab = screen.getByTestId('sheet-grab');
    fireEvent.pointerDown(grab, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(grab, { clientY: 260, pointerId: 1 });
    fireEvent.pointerUp(grab, { clientY: 260, pointerId: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a small drag snaps back instead of dismissing', () => {
    const onClose = vi.fn();
    wrap(
      <BottomSheet open onClose={onClose}>
        <p>content</p>
      </BottomSheet>,
    );
    const grab = screen.getByTestId('sheet-grab');
    fireEvent.pointerDown(grab, { clientY: 100, pointerId: 1 });
    // A tiny drag: below both the distance and the flick-distance thresholds.
    fireEvent.pointerMove(grab, { clientY: 130, pointerId: 1 });
    fireEvent.pointerUp(grab, { clientY: 130, pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
  });
});
