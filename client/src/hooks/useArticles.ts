import { useCallback, useEffect, useRef, useState } from 'react';
import { getArticles, markRead } from '../api/client';
import type { Article, Source } from '../api/client';

const PAGE_SIZE = 20;
// 콜드 스타트 안내 임계값: 로딩이 이 시간을 넘기면 "서버 깨우는 중" 안내를 띄운다.
const SLOW_LOADING_MS = 15000;

export interface UseArticlesResult {
  articles: Article[];
  source: Source | 'all';
  unread: boolean;
  unreadCount: number;
  page: number;
  totalPages: number;
  loading: boolean;
  slowLoading: boolean;
  error: string | null;
  setSource: (source: Source | 'all') => void;
  setUnread: (unread: boolean) => void;
  goToPage: (page: number) => void;
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
  const [slowLoading, setSlowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 최신 요청만 반영하기 위한 토큰 (필터 빠른 전환 시 경쟁 방지)
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (nextPage: number, currentSource: Source | 'all', currentUnread: boolean) => {
      const myId = ++requestId.current;
      setLoading(true);
      setError(null);
      // 새 로딩 시작마다 안내를 초기화하고, 15초 타이머를 건다.
      // 타이머 콜백은 자신이 아직 최신 요청일 때만 안내를 켠다.
      setSlowLoading(false);
      const slowTimer = setTimeout(() => {
        if (myId === requestId.current) setSlowLoading(true);
      }, SLOW_LOADING_MS);
      try {
        const res = await getArticles({
          source: currentSource === 'all' ? undefined : currentSource,
          unread: currentUnread || undefined,
          page: nextPage,
          limit: PAGE_SIZE,
        });
        if (myId !== requestId.current) return; // 더 최신 요청이 있으면 폐기
        // 번호형 페이지네이션: 이어붙이지 않고 해당 페이지로 교체
        setArticles(res.items);
        setPage(res.page);
        setTotalPages(res.totalPages);
        setUnreadCount(res.unreadCount);
      } catch (e) {
        if (myId !== requestId.current) return;
        setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다');
      } finally {
        // 로딩 종료(성공/에러 무관): 타이머 해제 + 안내 종료.
        clearTimeout(slowTimer);
        if (myId === requestId.current) {
          setLoading(false);
          setSlowLoading(false);
        }
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

  const goToPage = useCallback(
    (next: number) => {
      if (loading) return;
      // 범위 밖/현재 페이지면 무시
      const target = Math.min(Math.max(1, next), Math.max(1, totalPages));
      if (target === page) return;
      fetchPage(target, source, unread);
    },
    [loading, page, totalPages, source, unread, fetchPage],
  );

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

  return {
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
  };
}
