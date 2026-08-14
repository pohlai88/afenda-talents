-- A line may hold several due items on one date (split invoice, partial billing plus
-- top-up). The period label distinguishes them and becomes part of the identity.
-- This strictly relaxes the previous key, so no existing row can conflict.
DROP INDEX "ObligationDueItem_lineId_dueDate_key";

CREATE UNIQUE INDEX "ObligationDueItem_lineId_dueDate_periodLabel_key"
  ON "ObligationDueItem"("lineId", "dueDate", "periodLabel");
