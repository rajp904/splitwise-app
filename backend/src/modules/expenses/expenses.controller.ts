import { Request, Response, NextFunction } from 'express';
import * as expensesService from './expenses.service';
import { SplitType } from '@prisma/client';

export async function createExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { description, amount, currency, paidById, splitType, expenseDate, splits, notes } =
      req.body as {
        description: string;
        amount: number;
        currency: string;
        paidById: string;
        splitType: SplitType;
        expenseDate: string;
        splits: Array<{ userId: string; shareValue?: number }>;
        notes?: string;
      };

    const expense = await expensesService.createExpense({
      groupId: req.params.id,
      description,
      amount,
      currency: currency ?? 'INR',
      paidById,
      splitType,
      expenseDate: new Date(expenseDate),
      splits,
      notes,
      createdById: req.user!.userId,
    });

    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
}

export async function getGroupExpenses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const expenses = await expensesService.getGroupExpenses(req.params.id, req.user!.userId);
    res.status(200).json(expenses);
  } catch (err) {
    next(err);
  }
}

export async function getExpenseById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const expense = await expensesService.getExpenseById(req.params.expenseId, req.user!.userId);
    res.status(200).json(expense);
  } catch (err) {
    next(err);
  }
}

export async function updateExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const expense = await expensesService.updateExpense(
      req.params.expenseId,
      req.body,
      req.user!.userId
    );
    res.status(200).json(expense);
  } catch (err) {
    next(err);
  }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await expensesService.deleteExpense(req.params.expenseId, req.user!.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
