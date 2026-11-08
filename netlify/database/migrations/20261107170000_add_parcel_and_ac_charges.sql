-- Migration: Add parcel charges percentage, AC charges percentage, and AC table flag
ALTER TABLE pos_tables 
ADD COLUMN IF NOT EXISTS is_ac boolean NOT NULL DEFAULT false;

ALTER TABLE config 
ADD COLUMN IF NOT EXISTS pos_default_parcel_percent integer NOT NULL DEFAULT 0;

ALTER TABLE config 
ADD COLUMN IF NOT EXISTS pos_default_ac_percent integer NOT NULL DEFAULT 0;

ALTER TABLE config 
ADD COLUMN IF NOT EXISTS pos_pricing_mode varchar(20) NOT NULL DEFAULT 'percentage';

ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS ac_price integer;

ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS parcel_price integer;
