import { useEffect } from 'react';
import { checkHealth } from './api/client';
import { useArticles } from './hooks/useArticles';
import { StatusBar } from './components/StatusBar';
import { FilterBar } from './components/FilterBar';
import { ArticleCard } from './components/ArticleCard';
import './App.css';

function App() {
  const {
    articles,
    source,
    unread,
    unreadCount,
    hasMore,
    loading,
    error,
    setSource,
    setUnread,
    loadMore,
    markArticleRead,
    reload,
  } = useArticles();

  // 콜드 스타트 웜업: 페이지 로드 즉시 /health 선발사 (실패 무시).
  // 지연 안내 UX(15초 초과 시 "서버 깨우는 중")는 Phase 6에서 마감.
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
      />

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
