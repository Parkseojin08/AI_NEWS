// POST /api/collect (설계서 §6.3)
// - cronAuth 미들웨어로 X-Cron-Secret 검증 후 수집 실행
// - 응답: { results: [{source, fetched, new}], summarized }

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cronAuth from '../middlewares/cronAuth';
import { runCollect } from '../services/collector';

const router = express.Router();

router.post('/collect', cronAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runCollect();
    res.status(200).json(result);
  } catch (err) {
    // 예기치 못한 오류는 공통 에러 핸들러로 위임
    next(err);
  }
});

export default router;
