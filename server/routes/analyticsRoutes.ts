import express from 'express';
import { requireAuth } from '../auth/sessionAuth';
import { getMemberLocationSummary } from '../services/memberLocationSummaryService';

export function registerAnalyticsRoutes(app: express.Express) {
  const router = express.Router();

  router.get('/member-location-summary', requireAuth, async (_req, res) => {
    try {
      const summary = await getMemberLocationSummary();
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json(summary);
    } catch (err: any) {
      console.error('[Analytics] Failed to get member location summary:', err);
      res.status(500).json({ error: 'Failed to generate member location summary' });
    }
  });

  app.use('/api/analytics', router);
}
