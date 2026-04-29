CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL
);

-- insert admin user
INSERT INTO users VALUES (
  'admin',
  crypt('password', gen_salt('bf')),
  'admin'
);