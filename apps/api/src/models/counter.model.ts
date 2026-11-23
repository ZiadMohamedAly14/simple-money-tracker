import { Schema, model } from 'mongoose';

/**
 * The server-version counter (ADR-0007). `value` is the last version handed
 * out; `inFlight` lists versions handed out whose writes haven't finished, so
 * a pull can stop below them instead of skipping one that commits late.
 */
const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 },
    inFlight: { type: [{ version: Number, at: Number, _id: false }], default: [] },
  },
  { versionKey: false },
);

export const Counter = model('Counter', counterSchema, 'Counters');

const COUNTER_ID = 'serverVersion';

/**
 * A write still in flight after this long is taken as abandoned (its request
 * crashed), so it can't hold every pull back forever. Real writes take
 * milliseconds.
 */
export const ABANDONED_WRITE_MS = 60_000;

interface InFlight {
  version: number;
  at: number;
}

const live = (inFlight: InFlight[] | undefined, nowMs: number): InFlight[] =>
  (inFlight ?? []).filter((entry) => entry.at > nowMs - ABANDONED_WRITE_MS);

/**
 * Runs `write` with the next server version: atomic, so two writes never
 * share a number, and marked in flight until `write` settles.
 */
export async function writeWithServerVersion<T>(nowMs: number, write: (serverVersion: number) => Promise<T>): Promise<T> {
  const next = { $add: [{ $ifNull: ['$value', 0] }, 1] };
  const counter = await Counter.findOneAndUpdate(
    { _id: COUNTER_ID },
    [
      {
        $set: {
          value: next,
          inFlight: {
            $concatArrays: [
              // Drop abandoned entries while we're here.
              {
                $filter: {
                  input: { $ifNull: ['$inFlight', []] },
                  cond: { $gt: ['$$this.at', nowMs - ABANDONED_WRITE_MS] },
                },
              },
              [{ version: next, at: nowMs }],
            ],
          },
        },
      },
    ],
    { upsert: true, returnDocument: 'after', updatePipeline: true },
  ).lean();
  const version = counter!.value;
  try {
    return await write(version);
  } finally {
    await Counter.updateOne({ _id: COUNTER_ID }, { $pull: { inFlight: { version } } });
  }
}

/**
 * The highest server version below which every write has finished: the
 * furthest a pull may safely move a cursor (ADR-0007).
 */
export async function committedServerVersion(nowMs: number): Promise<number> {
  const counter = await Counter.findById(COUNTER_ID).lean();
  if (!counter) return 0;
  const pending = live(counter.inFlight as InFlight[], nowMs);
  return pending.length === 0 ? counter.value : Math.min(...pending.map((entry) => entry.version)) - 1;
}
