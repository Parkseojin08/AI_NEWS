import { useEffect, useState } from 'react';
import { checkHealth } from './api/client';
import { useArticles } from './hooks/useArticles';
import { StatusBar } from './components/StatusBar';
import { FilterBar } from './components/FilterBar';
import { ArticleCard } from './components/ArticleCard';
import { Pagination } from './components/Pagination';
import './App.css';
import { registerSW } from 'virtual:pwa-register';

function App() {
  useEffect(() => {
    registerSW({ immediate: true });
  }, []);

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches,
  );
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: BeforeInstallPromptEvent) => {
      // 브라우저 기본 미니 인포바를 막고, 우리 버튼으로 설치를 유도
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowInstallHelp(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const installPWA = async () => {
    // Chrome/Edge: 네이티브 설치 프롬프트가 준비된 경우 바로 띄운다
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') setIsInstalled(true);
      return;
    }
    // Safari/iPhone·Firefox 등 네이티브 프롬프트가 없는 경우: 설치 방법 안내 토글
    setShowInstallHelp((v) => !v);
  };

  const {
    articles,
    source,
    unread,
    unreadCount,
    page,
    totalPages,
    loading,
    slowLoading,
    error,
    setSource,
    setUnread,
    goToPage,
    markArticleRead,
    reload,
  } = useArticles();

  // 페이지 이동 시 목록 맨 위로 스크롤 (아래 페이지 버튼에서 눌러도 위부터 보이게)
  const handlePageChange = (next: number) => {
    goToPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [lang, setLang] = useState<'ko' | 'en'>(() => {
    const saved = localStorage.getItem('lang');
    return saved === 'en' || saved === 'ko' ? saved : 'ko';
  });

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  useEffect(() => {
    checkHealth().catch(() => {
      /* 웜업 실패는 무시 */
    });
  }, []);

  const isEmpty = !loading && !error && articles.length === 0;

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">AI News Hub</h1>
        <StatusBar />
      </header>

      <FilterBar
        source={source}
        unread={unread}
        unreadCount={unreadCount}
        onSourceChange={setSource}
        onUnreadChange={setUnread}
        lang={lang}
        onLangChange={setLang}
        onInstall={installPWA}
        showInstall={!isInstalled}
      />

      {showInstallHelp && (
        <p className="app__install-help">
          설치 방법 — <strong>Chrome/Edge(PC)</strong>: 주소창 오른쪽 설치 아이콘 또는 ⋮ 메뉴 →
          &ldquo;앱 설치&rdquo;. <strong>Android Chrome</strong>: ⋮ 메뉴 → &ldquo;앱 설치/홈 화면에 추가&rdquo;.
          <strong> iPhone(Safari)</strong>: 공유 버튼 → &ldquo;홈 화면에 추가&rdquo;.
        </p>
      )}

      {loading && slowLoading && (
        <div className="app__waking" role="status" aria-live="polite">
          <span className="app__waking-spinner" aria-hidden="true" />
          서버 깨우는 중 (최대 1분)
        </div>
      )}

      {error && (
        <div className="app__error">
          <span>{error}</span>
          <button type="button" onClick={reload}>
            다시 시도
          </button>
        </div>
      )}

      {isEmpty && <p className="app__empty">표시할 기사가 없습니다.</p>}

      <main className="app__list">
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            lang={lang}
            onRead={markArticleRead}
          />
        ))}
      </main>

      {loading && <p className="app__loading">불러오는 중...</p>}

      {!loading && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}

export default App;