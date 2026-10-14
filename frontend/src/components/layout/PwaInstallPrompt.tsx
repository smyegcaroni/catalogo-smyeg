import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type InstallMode = 'native' | 'ios' | 'safari' | 'browser';
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'caroni-geodatos:pwa-dismissed-at';
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

function manualMode(): InstallMode {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) {
    return 'ios';
  }
  if (/Mac/i.test(navigator.platform) &&
      /Safari/i.test(ua) &&
      !/Chrome|Chromium|Edg/i.test(ua)) {
    return 'safari';
  }
  return 'browser';
}

export function PwaInstallPrompt() {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<InstallMode>('browser');
  const [installing, setInstalling] = useState(false);
  const installEvent = useRef<InstallEvent | null>(null);

  useEffect(() => {
    if (window.location.hostname !== 'catalogo.caroni.org.ve') return;
    if ('serviceWorker' in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register('/service-worker.js?v=20261003pwaicon3', {
        updateViaCache: 'none',
      })
        .catch((error: unknown) => console.warn('PWA registration failed', error));
    }
    if (window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone ||
        recentlyDismissed()) return;

    let timer = window.setTimeout(() => {
      setMode(manualMode());
      setOpen(true);
    }, 7000);
    const onInstallAvailable = (event: Event) => {
      event.preventDefault();
      installEvent.current = event as InstallEvent;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setMode('native');
        setOpen(true);
      }, 1200);
    };
    const onInstalled = () => {
      installEvent.current = null;
      setOpen(false);
      try { localStorage.removeItem(DISMISS_KEY); } catch { /* Storage may be disabled. */ }
    };
    window.addEventListener('beforeinstallprompt', onInstallAvailable);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onInstallAvailable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    setOpen(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* Storage may be disabled. */ }
  }

  async function install() {
    const event = installEvent.current;
    if (!event) {
      setMode(manualMode());
      return;
    }
    setInstalling(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      installEvent.current = null;
      if (choice.outcome === 'accepted') setOpen(false);
      else dismiss();
    } catch {
      setMode(manualMode());
    } finally {
      setInstalling(false);
    }
  }

  const instructionsKey = mode === 'ios'
    ? 'pwaInstall.instructions.ios'
    : mode === 'safari'
      ? 'pwaInstall.instructions.safari'
      : 'pwaInstall.instructions.browser';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <img
            src="/app-icon-192.png?v=20261003pwaicon3"
            alt=""
            width={64}
            height={64}
            className="mx-auto rounded-xl sm:mx-0"
          />
          <DialogTitle>{t('pwaInstall.title')}</DialogTitle>
          <DialogDescription>{t('pwaInstall.description')}</DialogDescription>
        </DialogHeader>
        {mode !== 'native' && (
          <p className="text-sm font-medium text-foreground">
            {t(instructionsKey)}
          </p>
        )}
        <p className="rounded-md border-s-4 border-sky-600 bg-sky-50 p-3 text-sm text-slate-700 dark:bg-sky-950 dark:text-slate-100">
          {t('pwaInstall.offlineLimit')}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>{t('pwaInstall.later')}</Button>
          <Button onClick={mode === 'native' ? () => void install() : dismiss} disabled={installing}>
            {t(mode === 'native' ? 'pwaInstall.install' : 'pwaInstall.understood')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
