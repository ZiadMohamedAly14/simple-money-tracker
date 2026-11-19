import mongoose from 'mongoose';

/** Opens the single Mongoose connection used by every model. */
export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
