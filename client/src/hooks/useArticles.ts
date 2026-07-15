import { useCallback, useEffect, useRef, useState } from 'react';
import { getArticles, markRead } from '../api/client';
import type { Article, Source } from '../api/client';

const PAGE_SIZE = 20;

export interface UseArticlesResult {
  articles: Article[];
  source: Source | 'all';
  unread: boolean;
  unreadCount: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  setSource: (source: Source | 'all') => void;
  setUnread: (unread: boolean) => void;
  loadMore: () => void;
  markArticleRead: (id: number) => void;
  reload: () => void;
}

export function useArticles(): UseArticlesResult {
  const [articles, setArticles] = useState<Article[]>([]);
  const [source, setSourceState] = useState<Source | 'all'>('all');
  const [unread, setUnreadState] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 최신 요청만 반영하기 위한 토큰 (필터 빠른 전환 시 경쟁 방지)
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (nextPage: number, currentSource: Source | 'all', currentUnread: boolean) => {
      const myId = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await getArticles({
          source: currentSource === 'all' ? undefined : currentSource,
          unread: currentUnread || undefined,
          page: nextPage,
          limit: PAGE_SIZE,
        });
        if (myId !== requestId.current) return; // 더 최신 요청이 있으면 폐기
        setArticles((prev) =>
          nextPage === 1 ? res.items : [...prev, ...res.items],
        );
        setPage(res.page);
        setTotalPages(res.totalPages);
        setUnreadCount(res.unreadCount);
      } catch (e) {
        if (myId !== requestId.current) return;
        setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다');
      } finally {
        if (myId === requestId.current) setLoading(false);
      }
    },
    [],
  );

  // 필터 변경 시 목록 리셋 후 1페이지 재로드
  useEffect(() => {
    fetchPage(1, source, unread);
  }, [source, unread, fetchPage]);

  const setSource = useCallback((next: Source | 'all') => {
    setSourceState(next);
  }, []);

  const setUnread = useCallback((next: boolean) => {
    setUnreadState(next);
  }, []);

  const loadMore = useCallback(() => {
    if (loading) return;
    if (page >= totalPages) return;
    fetchPage(page + 1, source, unread);
  }, [loading, page, totalPages, source, unread, fetchPage]);

  const reload = useCallback(() => {
    fetchPage(1, source, unread);
  }, [source, unread, fetchPage]);

  // 낙관적 읽음 처리: UI 즉시 반영, PATCH는 백그라운드. 실패해도 원문 이동은 카드 쪽에서 진행.
  const markArticleRead = useCallback(
    (id: number) => {
      setArticles((prev) => {
        let changed = false;
        const next = prev.map((a) => {
          if (a.id === id && !a.isRead) {
            changed = true;
            return { ...a, isRead: true };
          }
          return a;
        });
        if (changed) setUnreadCount((c) => Math.max(0, c - 1));
        return next;
      });
      markRead(id).catch(() => {
        // 실패해도 UI는 읽음 유지(낙관적). 원문 이동은 이미 진행됨.
      });
    },
    [],
  );

  const hasMore = page < totalPages;

  return {
    articles,
    source,
    unread,
    unreadCount,
    page,
    totalPages,
    hasMore,
    loading,
    error,
    setSource,
    setUnread,
    loadMore,
    markArticleRead,
    reload,
  };
}
