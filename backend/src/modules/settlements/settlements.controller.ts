import { Request, Response, NextFunction } from 'express';
import * as service from './settlements.service';

export async function createSettlement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { paidById, paidToId, amount, currency, settlementDate, notes } = req.body as {
      paidById: string;
      paidToId: string;
      amount: number;
      currency?: string;
      settlementDate: string;
      notes?: string;
    };

    const settlement = await service.createSettlement({
      groupId: req.params.id,
      paidById,
      paidToId,
      amount,
      currency: currency ?? 'INR',
      settlementDate: new Date(settlementDate),
      notes,
      createdById: req.user!.userId,
    });

    res.status(201).json(settlement);
  } catch (err) {
    next(err);
  }
}

export async function getGroupSettlements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settlements = await service.getGroupSettlements(req.params.id, req.user!.userId);
    res.status(200).json(settlements);
  } catch (err) {
    next(err);
  }
}
