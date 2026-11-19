import { Schema, model } from 'mongoose';

/**
 * A signed-in device. Holds only the hash of its current refresh token.
 * Ticket 04 builds rotation, reuse revocation and logout on this.
 */
const sessionSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    /** 'full' = the whole Account; 'kid' = one Kid Profile (ADR-0002). */
    scope: { type: String, enum: ['full', 'kid'], required: true, default: 'full' },
    kidProfileId: { type: String, default: null },
    deviceLabel: { type: String, default: null },
    refreshTokenHash: { type: String, required: true },
    /** Deleted automatically when the refresh token expires. */
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export const Session = model('Session', sessionSchema);
