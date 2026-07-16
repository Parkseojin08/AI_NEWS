// RSS 피드 fetch + 파싱 + 정규화 (설계서 §6.1)
// - rss-parser 사용 (이미 설치됨)
// - fetch 실패는 예외로 던져 collector가 소스 단위로 격리 처리하게 한다.

import Parser from 'rss-parser';
import type { Source, NormalizedItem } from '../types';

const parser = new Parser({
  timeout: 20000, // 20s — Render 콜드 스타트/네트워크 지연 대비
  headers: {
    // 일부 피드는 UA 없는 요청을 차단할 수 있어 명시
    'User-Agent': 'ai-news-hub/1.0 (+https://github.com)',
  },
});

// 소스별 피드 URL (설계서 §6.1). source 값은 DB CHECK 제약과 일치해야 한다.
const FEEDS: Record<Source, string> = {
  openai: 'https://openai.com/news/rss.xml',
  anthropic:
    'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml',
};

const DESCRIPTION_MAX_LENGTH = 2000;

/**
 * link의 쿼리스트링(utm 등)과 fragment를 제거해 정규화된 url을 만든다.
 * 이 값이 articles.url UNIQUE 중복 방지 키이므로 필수 (설계서 §6.1).
 * URL 파싱 실패 시 원본 문자열을 그대로 반환한다.
 */
function normalizeUrl(link: string): string {
  const raw = String(link).trim();
  try {
    const u = new URL(raw);
    u.search = ''; // 쿼리스트링 제거
    u.hash = ''; // fragment 제거
    return u.toString();
  } catch {
    // 절대 URL이 아니면 파싱 실패 → 원본 유지
    return raw;
  }
}

/**
 * HTML 태그를 제거하고 공백을 정리한 뒤 최대 길이로 절단한다 (설계서 §6.1).
 */
function stripHtml(html?: string | null): string {
  if (!html) return '';
  const text = String(html)
    .replace(/<[^>]*>/g, ' ') // 태그 제거
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > DESCRIPTION_MAX_LENGTH
    ? text.slice(0, DESCRIPTION_MAX_LENGTH)
    : text;
}

/**
 * pubDate를 Date로 파싱한다. 실패 시 수집 시각(fallback)으로 대체하고 warn 로그.
 */
function parsePublishedAt(
  pubDate: string | undefined,
  source: string,
  url: string,
  fetchedAt: Date
): Date {
  if (pubDate) {
    const d = new Date(pubDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  console.warn(
    `[rss] pubDate 파싱 실패 → 수집 시각으로 대체 (source=${source}, url=${url}, pubDate=${pubDate})`
  );
  return fetchedAt;
}

/**
 * 단일 소스 피드를 fetch/파싱/정규화한다.
 * @throws fetch/파싱 실패 시 예외 (collector가 소스 단위로 잡는다)
 */
async function fetchAndParse(source: Source): Promise<NormalizedItem[]> {
  const feedUrl = FEEDS[source];
  if (!feedUrl) {
    throw new Error(`알 수 없는 소스: ${source}`);
  }

  const feed = await parser.parseURL(feedUrl); // 실패 시 throw
  const fetchedAt = new Date();
  const items = Array.isArray(feed.items) ? feed.items : [];

  const normalized: NormalizedItem[] = [];
  for (const item of items) {
    const title = item.title && String(item.title).trim();
    const link = item.link && String(item.link).trim();

    // title 또는 link 누락 항목은 skip (설계서 §6.1)
    if (!title || !link) {
      console.warn(`[rss] title/link 누락 항목 skip (source=${source})`);
      continue;
    }

    const url = normalizeUrl(link);
    const description = stripHtml(item.contentSnippet || item.content || item.description);
    const publishedAt = parsePublishedAt(item.pubDate, source, url, fetchedAt);

    normalized.push({ source, title, url, description, publishedAt });
  }

  return normalized;
}

export {
  fetchAndParse,
  normalizeUrl, // 테스트/재사용용 export
  stripHtml,
  FEEDS,
};
