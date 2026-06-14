import { Router } from 'express';
import * as controller from './balances.controller';
import { requireAuth } from '../../middleware/auth';

// Two separate routers — one mounted under /groups/:id, one under /users
export const groupBalancesRouter = Router({ mergeParams: true });
groupBalancesRouter.use(requireAuth);
groupBalancesRouter.get('/', controller.getGroupBalances);

export const userBalancesRouter = Router();
userBalancesRouter.use(requireAuth);
userBalancesRouter.get('/', controller.getUserBalances);
