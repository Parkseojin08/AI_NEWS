import type { Source } from '../api/client';

interface FilterBarProps {
  source: Source | 'all';
  unread: boolean;
  unreadCount: number;
  onSourceChange: (source: Source | 'all') => void;
  onUnreadChange: (unread: boolean) => void;
}

const SOURCE_OPTIONS: { value: Source | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
];

export function FilterBar({
  source,
  unread,
  unreadCount,
  onSourceChange,
  onUnreadChange,
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

      <span className="filterbar__count" title="전체 안읽음 수">
        안읽음 {unreadCount}
      </span>
    </div>
  );
}
