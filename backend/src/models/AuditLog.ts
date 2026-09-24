import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  merchantId?: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  device?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorName: String,
    action: { type: String, required: true, index: true },
    resource: { type: String, required: true },
    resourceId: String,
    metadata: Schema.Types.Mixed,
    ip: String,
    device: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
