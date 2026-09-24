import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(uri: string = env.MONGODB_URI): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
}

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
}
