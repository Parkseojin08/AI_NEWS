import type { Article } from '../api/client';

interface ArticleCardProps {
  article: Article;
  lang: 'ko' | 'en';
  onRead: (id: number) => void;
}

const SOURCE_LABEL: Record<Article['source'], string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function ArticleCard({ article, lang, onRead }: ArticleCardProps) {
  // 제목은 항상 영문 원제. 본문(요약/설명)만 언어 토글 대상.
  // 'en': 항상 영문 원문 description.
  // 'ko': 한국어 요약(summary), null이면 description으로 대체 (요약 대기/실패 정상 케이스).
  const body = lang === 'en' ? article.description : (article.summary ?? article.description);

  const handleOpen = () => {
    // (a) 낙관적 읽음 발사 → (b) 원문 새 탭. 읽음 실패해도 이동은 진행.
    onRead(article.id);
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  };

  return (
    <article
      className={`card${article.isRead ? '' : ' card--unread'} card--${article.source}`}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      role="link"
      tabIndex={0}
    >
      <header className="card__head">
        <span className={`badge badge--${article.source}`}>
          {SOURCE_LABEL[article.source]}
        </span>
        <time className="card__date" dateTime={article.publishedAt}>
          {formatDate(article.publishedAt)}
        </time>
        {!article.isRead && <span className="card__dot">● 안읽음</span>}
      </header>

      <h2 className="card__title">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // 링크 기본 동작(새 탭)은 유지하되, 읽음 처리 발사 후 카드 중복 open 방지
            e.stopPropagation();
            onRead(article.id);
          }}
        >
          {article.title}
        </a>
      </h2>

      {body && <p className="card__body">{body}</p>}
    </article>
  );
}
