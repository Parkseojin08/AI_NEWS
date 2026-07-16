import { Pool } from 'pg';
import type { QueryResult, QueryResultRow } from 'pg';
import config from './config';

// pg Pool 싱글턴. Neon은 sslmode=require 이므로 연결 문자열에 SSL 파라미터 포함 전제.
const pool = new Pool({
  connectionString: config.databaseUrl,
});

// 풀 레벨 에러는 프로세스를 죽이지 않고 로그만 남긴다 (유휴 클라이언트 오류 등).
pool.on('error', (err: Error) => {
  console.error('[db] idle client error:', err.message);
});

/**
 * 파라미터 바인딩 전제 쿼리 헬퍼.
 * 반드시 ($1, $2 ...) 형태의 파라미터화된 쿼리만 사용한다. 문자열 결합 금지.
 * @param text - SQL (플레이스홀더 $1..$n)
 * @param params - 바인딩 파라미터
 */
function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}

export { pool, query };
