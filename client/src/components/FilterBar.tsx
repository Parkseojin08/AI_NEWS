import type { Source } from '../api/client';

interface FilterBarProps {
  source: Source | 'all';
  unread: boolean;
  unreadCount: number;
  lang: 'ko' | 'en';
  onSourceChange: (source: Source | 'all') => void;
  onUnreadChange: (unread: boolean) => void;
  onLangChange: (lang: 'ko' | 'en') => void;
  onInstall?: () => void;
  showInstall?: boolean;
}

const SOURCE_OPTIONS: { value: Source | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
];

const LANG_OPTIONS: { value: 'ko' | 'en'; label: string }[] = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
];

export function FilterBar({
  source,
  unread,
  unreadCount,
  lang,
  onSourceChange,
  onUnreadChange,
  onLangChange,
  onInstall,
  showInstall,
}: FilterBarProps) {
  return (
    <div className="filterbar">
      <div className="filterbar__sources" role="group" aria-label="소스 필터">
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`filter-btn${source === opt.value ? ' filter-btn--active' : ''}`}
            aria-pressed={source === opt.value}
            onClick={() => onSourceChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <label className="filterbar__unread">
        <input
          type="checkbox"
          checked={unread}
          onChange={(e) => onUnreadChange(e.target.checked)}
        />
        안읽음만
      </label>

      <div className="filterbar__lang" role="group" aria-label="본문 언어">
        {LANG_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`filter-btn${lang === opt.value ? ' filter-btn--active' : ''}`}
            aria-pressed={lang === opt.value}
            onClick={() => onLangChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {showInstall && (
        <button
          type="button"
          className="filter-btn filter-btn--install"
          onClick={onInstall}
        >
          APP Download
        </button>
      )}

      <span className="filterbar__count" title="전체 안읽음 수">
        안읽음 {unreadCount}
      </span>
    </div>
  );
}