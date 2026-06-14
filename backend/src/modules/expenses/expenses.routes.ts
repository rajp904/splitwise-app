import { Router } from 'express';
import { body, param } from 'express-validator';
import * as controller from './expenses.controller';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';

const router = Router({ mergeParams: true }); // mergeParams gives access to :id from parent router

router.use(requireAuth);

router.get('/', controller.getGroupExpenses);

router.post(
  '/',
  [
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('paidById').isUUID().withMessage('Valid paidById is required'),
    body('splitType')
      .isIn(['equal', 'unequal', 'percentage', 'share'])
      .withMessage('Invalid split type'),
    body('expenseDate').isISO8601().withMessage('Valid expenseDate is required'),
    body('splits').isArray({ min: 1 }).withMessage('At least one split participant is required'),
  ],
  validate,
  controller.createExpense
);

router.get('/:expenseId', [param('expenseId').isUUID()], validate, controller.getExpenseById);

router.put('/:expenseId', [param('expenseId').isUUID()], validate, controller.updateExpense);

router.delete('/:expenseId', [param('expenseId').isUUID()], validate, controller.deleteExpense);

export default router;
