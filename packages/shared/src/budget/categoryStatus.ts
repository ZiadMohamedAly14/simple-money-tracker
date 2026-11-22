/** How a Category row reads on home: money left, over budget, or Covered (GLOSSARY, Category). */
export type CategoryStatus = 'left' | 'over' | 'covered';

/**
 * A Category within its budget has money left. Other spending above its
 * budget is Covered while Unallocated can absorb the whole overspend, and over
 * once it can't; Unallocated isn't lowered by it, so budgeting that money away
 * brings the warning back. Every other Category is simply over.
 */
export function categoryStatus(row: { isOther: boolean; budget: number; spent: number }, unallocated: number): CategoryStatus {
  const overspend = row.spent - row.budget;
  if (overspend <= 0) return 'left';
  return row.isOther && overspend <= unallocated ? 'covered' : 'over';
}
