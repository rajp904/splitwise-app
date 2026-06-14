import { Request, Response, NextFunction } from 'express';
import * as balancesService from './balances.service';

export async function getGroupBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const balances = await balancesService.getGroupBalances(req.params.id, req.user!.userId);
    res.status(200).json(balances);
  } catch (err) {
    next(err);
  }
}

export async function getUserBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const balances = await balancesService.getUserBalancesAcrossGroups(req.user!.userId);
    res.status(200).json(balances);
  } catch (err) {
    next(err);
  }
}
