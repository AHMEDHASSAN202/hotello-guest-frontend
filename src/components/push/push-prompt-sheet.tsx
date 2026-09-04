'use client';

import { Bell, Share, SquarePlus, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { isIosSafariBrowser, subscribeToPush, type PromptMoment } from '@/lib/push';
import { BottomSheet } from '../bottom-sheet';
import { Button } from '../ui';

/** `PromptMoment` → the `push.prompt.*` message key for that moment's copy. */
const MOMENT_KEY: Record<PromptMoment, 'postRequest' | 'postOrder' | 'inbox'> = {
  post_request: 'postRequest',
  post_order: 'postOrder',
  inbox_open: 'inbox',
};

/**
 * Epic 23, Task 12 (23.2 AC1/AC2) — the contextual pre-prompt. Two branches:
 * the standard enable/decline sheet (Android/desktop/already-installed iOS),
 * and the iOS-Safari-not-installed two-step "add to Home Screen first" guide
 * — the raw `Notification.requestPermission()` dialog is never triggered
 * cold; "enable" here is the only path to it, and iOS Safari outside a
 * standalone install has no working path to it at all (`subscribeToPush`
 * isn't even offered there).
 */
export function PushPromptSheet({
  moment,
  onClose,
}: {
  moment: PromptMoment;
  onClose: () => void;
}) {
  const t = useTranslations('push');
  const [enabling, setEnabling] = useState(false);
  const ios = isIosSafariBrowser();
  const key = MOMENT_KEY[moment];

  async function enable() {
    if (enabling) return;
    setEnabling(true);
    await subscribeToPush();
    // Whether the browser granted, denied, or the request otherwise failed,
    // the sheet's job is done once the guest has answered — a `blocked`/
    // `off` state surfaces elsewhere (settings), not as a sheet retry loop.
    setEnabling(false);
    onClose();
  }

  if (ios) {
    return (
      <BottomSheet open onClose={onClose}>
        <div data-testid="push-prompt-ios-guide">
          <div className="flex flex-col items-center gap-1 pb-4 text-center">
            <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
              <Bell className="h-6 w-6 text-accent" aria-hidden />
            </span>
            <h2 className="text-[16px] font-semibold text-ink">{t('ios.title')}</h2>
          </div>
          <div className="flex flex-col gap-3">
            <GuideStep
              step={1}
              icon={Share}
              title={t('ios.step1Title')}
              body={t('ios.step1Body')}
            />
            <GuideStep
              step={2}
              icon={SquarePlus}
              title={t('ios.step2Title')}
              body={t('ios.step2Body')}
            />
          </div>
          <Button onClick={onClose} className="mt-5">
            {t('ios.done')}
          </Button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open onClose={onClose} title={t(`prompt.${key}.title`)}>
      <div data-testid="push-prompt-standard" className="flex flex-col items-center gap-4 pb-1 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
          <Bell className="h-7 w-7 text-accent" aria-hidden />
        </span>
        <p className="text-[13px] leading-relaxed text-ink-soft">{t(`prompt.${key}.body`)}</p>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={() => void enable()} loading={enabling}>
            {t('prompt.enable')}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={enabling}>
            {t('prompt.notNow')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

/** One step of the iOS A2HS guide — a card, not a text wall (spec note 6);
 * further visual polish lands in the device pass. */
function GuideStep({
  step,
  icon: Icon,
  title,
  body,
}: {
  step: number;
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-line bg-card p-3">
      <span
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft"
        aria-hidden
      >
        <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
        <span className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-contrast">
          {step}
        </span>
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{body}</p>
      </div>
    </div>
  );
}
