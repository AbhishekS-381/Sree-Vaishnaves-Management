-- Run ONLY after dual-write validation passes and 48h stable operation
-- This removes the legacy json_store table once full cutover to RDBMS is confirmed.
DROP TABLE IF EXISTS json_store;

