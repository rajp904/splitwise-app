import { Request, Response, NextFunction } from 'express';
import * as importService from './import.service';

export async function uploadCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No CSV file uploaded' });
      return;
    }

    const result = await importService.importCsv(
      req.params.id,
      req.user!.userId,
      req.file.originalname,
      req.file.buffer
    );

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const report = await importService.getImportReport(req.params.sessionId, req.user!.userId);
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
}
