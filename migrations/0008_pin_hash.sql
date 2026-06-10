-- PIN hashing (PBKDF2-SHA256) columns. Existing rows are lazily upgraded on
-- their next successful login: auth.js writes pin_hash/pin_salt and blanks
-- pin_plain. New signups never write a plaintext PIN (pin_plain is stored as
-- an empty string to satisfy the legacy NOT NULL constraint).
ALTER TABLE users ADD COLUMN pin_hash TEXT;
ALTER TABLE users ADD COLUMN pin_salt TEXT;
