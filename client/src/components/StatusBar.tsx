import { useEffect, useState } from 'react';
import { getStatus } from '../api/client';
import type { CollectLogEntry } from '../api/client';

const SOURCE_LABEL: Record<CollectLogEntry['source'], string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

export function StatusBar() {
  const [entries, setEntries] = useState<CollectLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStatus()
      .then((res) => {
        if (!cancelled) setEntries(res.lastCollect);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '상태 조회 실패');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 가장 최근 수집 시각
  const latest = entries?.reduce<CollectLogEntry | null>((acc, cur) => {
    if (!acc) return cur;
    return new Date(cur.executedAt) > new Date(acc.executedAt) ? cur : acc;
  }, null);

  return (
    <div className="statusbar">
      <span className="statusbar__label">
        {error
          ? '상태 정보를 불러오지 못했습니다'
          : latest
            ? `마지막 수집: ${relativeTime(latest.executedAt)}`
            : '수집 상태 확인 중...'}
      </span>
      {entries && (
        <span className="statusbar__sources">
          {entries.map((e) => (
            <span
              key={e.source}
              className={`status-chip${e.status === 'error' ? ' status-chip--error' : ''}`}
              title={
                e.status === 'error'
                  ? e.errorMessage ?? '수집 오류'
                  : `신규 ${e.newCount}건 · ${relativeTime(e.executedAt)}`
              }
            >
              {SOURCE_LABEL[e.source]}: {e.status === 'error' ? '오류' : `+${e.newCount}`}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
