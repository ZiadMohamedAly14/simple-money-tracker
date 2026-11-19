import { Schema, model } from 'mongoose';

/** Named counters that only go up. `serverVersion` stamps every synced write (ADR-0007). */
const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const Counter = model('Counter', counterSchema);

/** The next server version: atomic, so two writes never share a number. */
export async function nextServerVersion(): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'serverVersion' },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  return counter!.value;
}
