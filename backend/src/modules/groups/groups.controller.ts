import { Request, Response, NextFunction } from 'express';
import * as groupsService from './groups.service';

export async function createGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description } = req.body as { name: string; description?: string };
    const group = await groupsService.createGroup(name, description, req.user!.userId);
    res.status(201).json(group);
  } catch (err) { next(err); }
}

export async function getUserGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const groups = await groupsService.getUserGroups(req.user!.userId);
    res.status(200).json(groups);
  } catch (err) { next(err); }
}

export async function getGroupById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const group = await groupsService.getGroupById(req.params.id, req.user!.userId);
    res.status(200).json(group);
  } catch (err) { next(err); }
}

export async function addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, joinedAt } = req.body as { userId: string; joinedAt: string };
    const membership = await groupsService.addMember(
      req.params.id,
      userId,
      new Date(joinedAt)
    );
    res.status(201).json(membership);
  } catch (err) { next(err); }
}

export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { leftAt } = req.body as { leftAt: string };
    const membership = await groupsService.removeMember(
      req.params.id,
      req.params.userId,
      new Date(leftAt)
    );
    res.status(200).json(membership);
  } catch (err) { next(err); }
}
