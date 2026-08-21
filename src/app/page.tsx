import { QrCode } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Apex screen — the app is only ever entered via a hotel QR URL (`/{slug}`),
 * so the bare domain just points guests back to the QR in their room.
 */
export default function ApexPage() {
  const t = useTranslations('common');
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center pt-safe pb-safe">
      <div className="relative mb-8 flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-accent-soft" aria-hidden />
        <QrCode className="relative h-11 w-11 text-accent" strokeWidth={1.5} aria-hidden />
      </div>
      <h1 className="mb-2 text-xl font-semibold text-ink">{t('appName')}</h1>
      <p className="max-w-[32ch] text-[15px] leading-relaxed text-ink-soft">{t('scanHint')}</p>
    </div>
  );
}
