import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';
import { InstitutionalSeal } from './InstitutionalSeal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PWAInstallButtonProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Check if app is in standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIOSDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // Fallback for browsers without beforeinstallprompt
      setShowIOSModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition shadow-2xs cursor-pointer ${
          variant === 'full'
            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-500 font-bold'
            : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
        } ${className}`}
        title="Install IGNOU SC-2033 as an app on your home screen or desktop"
        aria-label="Install App"
      >
        <Download className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {/* Guided installation modal for iOS / Desktop without automated prompt */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-slate-900 relative">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <InstitutionalSeal size="lg" className="mb-3" />
              <h3 className="text-base font-bold text-slate-900">
                Install IGNOU SC-2033
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Add to your home screen or desktop dock for instant offline access and native app feel.
              </p>

              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-left w-full space-y-2 text-xs text-slate-700">
                {isIOS ? (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">1.</span>
                      <span>Tap the <strong>Share</strong> button in Safari toolbar.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">2.</span>
                      <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">3.</span>
                      <span>Tap <strong>Add</strong> in the top right corner.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">1.</span>
                      <span>Open browser menu (three dots in Chrome/Edge).</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">2.</span>
                      <span>Click <strong>Install IGNOU SC-2033</strong> or <strong>Add to Home screen</strong>.</span>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="mt-5 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
