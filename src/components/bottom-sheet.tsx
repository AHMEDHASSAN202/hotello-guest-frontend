'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The app's one bottom sheet (impl note 5) — built once, reused for every
 * picker (language switcher first). Native-app behavior: slides up, drags to
 * dismiss (past ~120px or a flick), backdrop tap and Escape close it.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const t = useTranslations('common');
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startedAt: number } | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setOffset(0);
  }, [open]);

  if (!open) return null;

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { startY: e.clientY, startedAt: Date.now() };
    // Not available in jsdom / older WebViews — purely an enhancement.
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setOffset(Math.max(0, e.clientY - drag.current.startY));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    const elapsed = Date.now() - drag.current.startedAt;
    const velocity = dy / Math.max(1, elapsed); // px/ms
    drag.current = null;
    // Full drag, or a flick (fast AND far enough to be intentional).
    if (dy > 120 || (dy > 50 && velocity > 0.5)) onClose();
    else setOffset(0);
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto max-w-[430px]">
      <button
        aria-label={t('close')}
        onClick={onClose}
        className="animate-fade-in absolute inset-0 h-full w-full bg-ink/40"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="bottom-sheet"
        style={{
          transform: offset ? `translateY(${offset}px)` : undefined,
          transition: offset ? 'none' : 'transform 0.2s ease-out',
        }}
        className="animate-sheet-in absolute inset-x-0 bottom-0 rounded-t-sheet bg-card px-5 pt-3 shadow-sheet pb-safe"
      >
        {/* Drag is scoped to the grab area (Epic 15) so sheet bodies can hold
            scrollable lists and text inputs without fighting the gesture. */}
        <div
          data-testid="sheet-grab"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="-mx-5 touch-none px-5"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" aria-hidden />
          {title ? (
            <h2 className="mb-3 text-center text-[15px] font-semibold text-ink">{title}</h2>
          ) : null}
        </div>
        <div className="max-h-[70dvh] overflow-y-auto pb-6">{children}</div>
      </div>
    </div>
  );
}
