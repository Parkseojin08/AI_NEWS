interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * 표시할 페이지 번호 목록을 만든다. 페이지가 많으면 현재 페이지 주변만 보이고
 * 나머지는 '…'로 축약한다. 예) 현재 5 / 전체 64 → [1, '…', 4, 5, 6, '…', 64]
 */
function buildPages(current: number, total: number): (number | '…')[] {
  const delta = 1; // 현재 페이지 양옆으로 보여줄 개수
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);
  const pages: (number | '…')[] = [1];
  if (left > 2) pages.push('…');
  for (let i = left; i <= right; i += 1) pages.push(i);
  if (right < total - 1) pages.push('…');
  if (total > 1) pages.push(total);
  return pages;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPages(page, totalPages);

  return (
    <nav className="pagination" role="navigation" aria-label="페이지 이동">
      <button
        type="button"
        className="pagination__btn"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="이전 페이지"
      >
        ‹
      </button>

      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="pagination__ellipsis" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={`pagination__btn${p === page ? ' pagination__btn--active' : ''}`}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        className="pagination__btn"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="다음 페이지"
      >
        ›
      </button>
    </nav>
  );
}
