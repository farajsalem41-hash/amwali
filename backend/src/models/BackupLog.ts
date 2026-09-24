import mongoose, { Schema, Document } from 'mongoose';

export interface IBackupLog extends Document {
  kind: 'database' | 'files';
  status: 'success' | 'failed' | 'running';
  sizeBytes?: number;
  location?: string;
  encrypted: boolean;
  error?: string;
  startedAt: Date;
  finishedAt?: Date;
}

const backupLogSchema = new Schema<IBackupLog>(
  {
    kind: { type: String, enum: ['database', 'files'], required: true },
    status: { type: String, enum: ['success', 'failed', 'running'], required: true },
    sizeBytes: Number,
    location: String,
    encrypted: { type: Boolean, default: false },
    error: String,
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
  },
  { timestamps: true }
);

export const BackupLog = mongoose.model<IBackupLog>('BackupLog', backupLogSchema);
