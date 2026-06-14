import { Router } from 'express';
import multer from 'multer';
import * as controller from './import.controller';
import { requireAuth } from '../../middleware/auth';

// Use memory storage so we get the file as a Buffer (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.endsWith('.csv') && file.mimetype !== 'text/csv') {
      cb(new Error('Only CSV files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const router = Router({ mergeParams: true });
router.use(requireAuth);

// POST /groups/:id/import — upload and process CSV
router.post('/', upload.single('file'), controller.uploadCsv);

// GET /groups/:id/import/:sessionId — fetch import report
router.get('/:sessionId', controller.getReport);

export default router;
