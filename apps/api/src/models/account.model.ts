import { Schema, model, type InferSchemaType } from 'mongoose';

/** The adult-owned identity (see GLOSSARY). Created on the first successful code verify. */
const accountSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    onboardingCompletedAt: { type: Date, default: null },
    /** Hash of the Parent PIN (`hashParentPin` in shared), never the PIN. Null until set. */
    parentPinHash: { type: String, default: null },
    /** Wrong Parent PINs in a row, and when the next try is allowed (`pinRetryAfterSeconds`). */
    pinFailures: { type: Number, required: true, default: 0 },
    pinLockedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

export type AccountDoc = InferSchemaType<typeof accountSchema>;
export const Account = model('Account', accountSchema);
