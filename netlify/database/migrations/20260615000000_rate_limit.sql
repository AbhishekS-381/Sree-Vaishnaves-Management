CREATE TABLE IF NOT EXISTS rate_limit (
  key            VARCHAR(255) PRIMARY KEY,
  attempts       INTEGER      NOT NULL DEFAULT 0,
  window_start   BIGINT       NOT NULL,
  blocked_until  BIGINT       NOT NULL DEFAULT 0
);
