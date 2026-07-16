import { useEffect, useState } from 'react';
import { checkHealth } from './api/client';
import { useArticles } from './hooks/useArticles';
import { StatusBar } from './components/StatusBar';
import { FilterBar } from './components/FilterBar';
import { ArticleCard } from './components/ArticleCard';
import './App.css';
import { registerSW } from 'virtual:pwa-register';

function App() {
  useEffect(() => {
    registerSW({ immediate: true });
  }, []);

  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const installPWA = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();

    await installPrompt.userChoice;

    setInstallPrompt(null);
  };

  const {
    articles,
    source,
    unread,
    unreadCount,
    hasMore,
    loading,
    slowLoading,
    error,
    setSource,
    setUnread,
    loadMore,
    markArticleRead,
    reload,
  } = useArticles();

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
        canInstall={!!installPrompt}
      />

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

      {hasMore && !loading && (
        <div className="app__more">
          <button type="button" onClick={loadMore}>
            더 보기
          </button>
        </div>
      )}
    </div>
  );
}

export default App;