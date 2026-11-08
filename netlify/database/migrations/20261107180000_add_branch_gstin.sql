-- Add GSTIN column to branches table
ALTER TABLE branches ADD COLUMN IF NOT EXISTS gstin varchar(20);

