import { Schema, model, type InferSchemaType } from 'mongoose';

/** The adult-owned identity (see GLOSSARY). Created on the first successful code verify. */
const accountSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    onboardingCompletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type AccountDoc = InferSchemaType<typeof accountSchema>;
export const Account = model('Account', accountSchema);
