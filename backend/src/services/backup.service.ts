import fs from 'fs';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import mongoose from 'mongoose';
import { BackupLog } from '../models';

const BACKUP_DIR = path.resolve(__dirname, '../../backups');

/**
 * Logical backup: dumps every collection to a gzipped JSON file.
 * Works without mongodump being installed and is restorable via restoreBackup().
 */
export async function runDatabaseBackup(): Promise<{ location: string; sizeBytes: number }> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const log = await BackupLog.create({ kind: 'database', status: 'running', startedAt: new Date() });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(BACKUP_DIR, `amwali-db-${stamp}.json.gz`);
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('database connection is not ready');
    const collections = await db.listCollections().toArray();
    const dump: Record<string, unknown[]> = {};
    for (const info of collections) {
      dump[info.name] = await db.collection(info.name).find({}).toArray();
    }
    const gzip = createGzip();
    const out = fs.createWriteStream(target);
    gzip.end(JSON.stringify({ createdAt: new Date().toISOString(), collections: dump }));
    await pipeline(gzip, out);
    const sizeBytes = fs.statSync(target).size;
    log.status = 'success';
    log.location = target;
    log.sizeBytes = sizeBytes;
    log.finishedAt = new Date();
    await log.save();
    return { location: target, sizeBytes };
  } catch (err) {
    log.status = 'failed';
    log.error = err instanceof Error ? err.message : String(err);
    log.finishedAt = new Date();
    await log.save();
    throw err;
  }
}

export function listLocalBackups(): { file: string; sizeBytes: number; createdAt: Date }[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json.gz'))
    .map((f) => {
      const s = fs.statSync(path.join(BACKUP_DIR, f));
      return { file: f, sizeBytes: s.size, createdAt: s.mtime };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
