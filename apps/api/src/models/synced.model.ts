import { Schema, model, type SchemaDefinition } from 'mongoose';
import type { SyncEntity } from '@money-tracker/shared';

/**
 * A synced record (spec "Data model"): a device-made UUID `_id` (ADR-0006), the
 * owning Account, the device's edit time, a deletion marker and the server
 * version that sync cursors count (ADR-0007). `updatedAt` is the device's clock,
 * so Mongoose timestamps are off.
 */
function syncedSchema(fields: SchemaDefinition) {
  const schema = new Schema(
    {
      _id: { type: String, required: true },
      accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
      updatedAt: { type: Number, required: true },
      deletedAt: { type: Number, default: null },
      serverVersion: { type: Number, required: true },
      ...fields,
    },
    { versionKey: false, timestamps: false },
  );
  // Pulls read "this Account's records after the cursor", in cursor order.
  schema.index({ accountId: 1, serverVersion: 1 });
  return schema;
}

export const AccountSettings = model(
  'AccountSettings',
  syncedSchema({
    currency: { type: String, required: true },
    numberingSystem: { type: String, enum: ['western', 'arabic-indic'], required: true },
  }),
);

export const Category = model(
  'Category',
  syncedSchema({
    name: { type: String, required: true },
    order: { type: Number, required: true },
    isOther: { type: Boolean, required: true, default: false },
    archivedAt: { type: Number, default: null },
  }),
);

export const Transaction = model(
  'Transaction',
  syncedSchema({
    kind: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true },
    categoryId: { type: String, default: null },
    date: { type: String, required: true },
    note: { type: String, default: null },
  }),
);

export const MonthPlan = model(
  'MonthPlan',
  syncedSchema({
    month: { type: String, required: true },
    expectedIncome: { type: Number, required: true },
  }),
);

export const CategoryBudget = model(
  'CategoryBudget',
  syncedSchema({
    month: { type: String, required: true },
    categoryId: { type: String, required: true },
    amount: { type: Number, required: true },
  }),
);

/** The collection behind each synced entity. Add new synced entities here and to `SYNC_ENTITIES`. */
export const SYNCED_MODELS = {
  accountSettings: AccountSettings,
  category: Category,
  monthPlan: MonthPlan,
  categoryBudget: CategoryBudget,
  transaction: Transaction,
} satisfies Record<SyncEntity, unknown>;
