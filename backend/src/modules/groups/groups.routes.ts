import { Router } from 'express';
import { body, param } from 'express-validator';
import * as controller from './groups.controller';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// All group routes require authentication
router.use(requireAuth);

router.get('/', controller.getUserGroups);

router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('Group name is required')],
  validate,
  controller.createGroup
);

router.get('/:id', [param('id').isUUID()], validate, controller.getGroupById);

router.post(
  '/:id/members',
  [
    param('id').isUUID(),
    body('userId').isUUID().withMessage('Valid userId is required'),
    body('joinedAt').isISO8601().withMessage('Valid joinedAt date is required'),
  ],
  validate,
  controller.addMember
);

router.put(
  '/:id/members/:userId',
  [
    param('id').isUUID(),
    param('userId').isUUID(),
    body('leftAt').isISO8601().withMessage('Valid leftAt date is required'),
  ],
  validate,
  controller.removeMember
);

export default router;
