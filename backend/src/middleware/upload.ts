import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { randomToken } from '../utils/tokens';
import { ApiError } from '../utils/errors';

export const UPLOAD_ROOT = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.resolve(process.cwd(), env.UPLOAD_DIR);

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const ALLOWED = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['application/pdf', '.pdf'],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    // Never trust the client filename — generate a safe random name.
    const ext = ALLOWED.get(file.mimetype) || '.bin';
    cb(null, `${Date.now()}-${randomToken(24)}${ext}`);
  },
});

export const uploader = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(ApiError.badRequest('نوع الملف غير مدعوم. المسموح: JPG, PNG, WEBP, PDF'));
    }
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    if (ext && !allowedExts.includes(ext)) {
      return cb(ApiError.badRequest('امتداد الملف غير مدعوم'));
    }
    cb(null, true);
  },
});

export const uploadSingleImage = uploader.single('file');
