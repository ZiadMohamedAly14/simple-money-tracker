import { Schema, model } from 'mongoose';

/**
 * A signed-in device, and the rotation family of its refresh tokens: every
 * refresh token carries this Session's id (`sid`), and only the newest one's
 * hash is stored. A validly signed token for this Session that isn't the
 * newest is a replaced one being reused, so the whole Session is deleted.
 * Revoking (logout, reuse, expiry) means deleting the document.
 */
const sessionSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    /** 'full' = the whole Account; 'kid' = one Kid Profile (ADR-0002). */
    scope: { type: String, enum: ['full', 'kid'], required: true, default: 'full' },
    kidProfileId: { type: String, default: null },
    deviceLabel: { type: String, default: null },
    refreshTokenHash: { type: String, required: true },
    /** How many times the refresh token has been rotated; for diagnostics. */
    rotations: { type: Number, required: true, default: 0 },
    /** Deleted automatically when the refresh token expires. */
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export const Session = model('Session', sessionSchema);
