// 수집 상태 라우트 (설계서 §6.3)
// - GET /api/status : 소스별 최신 collect_log 1건씩
//
// DISTINCT ON (source)로 소스별 최신 1행을 뽑는다.
// ORDER BY source, executed_at DESC → 각 source 그룹의 첫 행이 최신 실행.

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { query } from '../db';

const router = express.Router();

interface StatusRow {
  source: string;
  executed_at: Date;
  status: 'ok' | 'error';
  new_count: number;
  error_message: string | null;
}

interface StatusEntry {
  source: string;
  executedAt: Date;
  status: 'ok' | 'error';
  newCount: number;
  errorMessage?: string | null;
}

// GET /api/status
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<StatusRow>(
      `SELECT DISTINCT ON (source)
              source, executed_at, status, new_count, error_message
         FROM collect_log
        ORDER BY source, executed_at DESC`
    );

    // camelCase 매핑 (설계서 §6.3).
    // newCount는 항상 포함. errorMessage는 status='error'일 때만 의미가 있어 그때만 포함.
    const lastCollect = result.rows.map((r) => {
      const entry: StatusEntry = {
        source: r.source,
        executedAt: r.executed_at,
        status: r.status,
        newCount: r.new_count,
      };
      if (r.status === 'error') {
        entry.errorMessage = r.error_message;
      }
      return entry;
    });

    res.status(200).json({ lastCollect });
  } catch (err) {
    next(err);
  }
});

export default router;
