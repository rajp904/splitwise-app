import { Router } from 'express';
import { body } from 'express-validator';
import * as controller from './settlements.controller';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', controller.getGroupSettlements);

router.post(
  '/',
  [
    body('paidById').isUUID(),
    body('paidToId').isUUID(),
    body('amount').isFloat({ gt: 0 }),
    body('settlementDate').isISO8601(),
  ],
  validate,
  controller.createSettlement
);

export default router;
