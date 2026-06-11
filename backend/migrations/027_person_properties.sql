-- Extend person table with a free-form JSON properties column.
-- Used by identify(userId, {traits}) to store arbitrary user attributes
-- that the targeting condition engine can evaluate against.

ALTER TABLE person ADD COLUMN properties_json TEXT;
