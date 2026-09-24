import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { StoredFile, Merchant } from '../models';
import { UPLOAD_ROOT } from '../middleware/upload';
import { ApiError } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import { audit } from '../services/audit.service';

export const uploadLogo = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.auth!;
  if (!req.file) throw ApiError.badRequest('لم يتم إرسال ملف');
  const stored = await StoredFile.create({
    merchantId: auth.merchantId,
    kind: 'logo',
    storedName: req.file.filename,
    originalName: req.file.originalname.slice(0, 160),
    mimeType: req.file.mimetype,
    size: req.file.size,
    isPublic: true, // merchant logo is shown on the public payment page
    uploadedBy: auth.userId,
  });
  await Merchant.updateOne({ _id: auth.merchantId }, { $set: { logoFileId: stored._id } });
  await audit(req, { action: 'merchant.logo_updated', resource: 'file', resourceId: stored._id.toString() });
  res.status(201).json({ fileId: stored._id });
});

/** Serves a file only to viewers allowed to see it. Logos are public; proofs are not. */
export const serveFile = asyncHandler(async (req: Request, res: Response) => {
  const file = await StoredFile.findById(req.params.id);
  if (!file) throw ApiError.notFound('الملف غير موجود');

  if (!file.isPublic) {
    const auth = req.auth;
    if (!auth) throw ApiError.unauthorized();
    const sameMerchant = auth.merchantId && file.merchantId && auth.merchantId.equals(file.merchantId);
    const ownUpload = file.uploadedBy && auth.userId.equals(file.uploadedBy);
    if (!auth.isAdmin && !sameMerchant && !ownUpload) throw ApiError.forbidden('لا تملك صلاحية لهذا الملف');
  }

  const full = path.join(UPLOAD_ROOT, path.basename(file.storedName));
  if (!full.startsWith(UPLOAD_ROOT) || !fs.existsSync(full)) throw ApiError.notFound('الملف غير موجود');

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Cache-Control', file.isPublic ? 'public, max-age=3600' : 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${file._id}${path.extname(file.storedName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(full).pipe(res);
});
