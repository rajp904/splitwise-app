// Users routes — currently just exchange rate management and user lookup.

import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import prisma from '../../config/prisma';
import { userBalancesRouter } from '../balances/balances.routes';

const router = Router();
router.use(requireAuth);

// GET /users — list all users (for adding to groups)
router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { isGuest: false },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

// GET /users/balances — cross-group balance summary for current user
router.use('/balances', userBalancesRouter);

// ── Exchange Rates ─────────────────────────────────────────────────────────

// GET /users/exchange-rates
router.get('/exchange-rates', async (req, res, next) => {
  try {
    const rates = await prisma.exchangeRate.findMany({
      orderBy: [{ fromCurrency: 'asc' }, { effectiveDate: 'desc' }],
    });
    res.json(rates);
  } catch (err) { next(err); }
});

// POST /users/exchange-rates — set a new rate (any authenticated user can do this)
router.post(
  '/exchange-rates',
  [
    body('fromCurrency').isLength({ min: 3, max: 3 }).withMessage('Currency code must be 3 chars'),
    body('toCurrency').isLength({ min: 3, max: 3 }),
    body('rate').isFloat({ gt: 0 }),
    body('effectiveDate').isISO8601(),
  ],
  validate,
  async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    try {
      const { fromCurrency, toCurrency, rate, effectiveDate } = req.body as {
        fromCurrency: string;
        toCurrency: string;
        rate: number;
        effectiveDate: string;
      };
      const newRate = await prisma.exchangeRate.create({
        data: {
          fromCurrency: fromCurrency.toUpperCase(),
          toCurrency: toCurrency.toUpperCase(),
          rate,
          effectiveDate: new Date(effectiveDate),
          source: 'manual',
        },
      });
      res.status(201).json(newRate);
    } catch (err) { next(err); }
  }
);

export default router;
