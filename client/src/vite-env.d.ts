/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// PWA 설치 프롬프트 이벤트 (표준 DOM lib에 아직 없어 직접 선언)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
  appinstalled: Event;
}
