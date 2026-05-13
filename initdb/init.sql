CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL
);

-- insert users
INSERT INTO users VALUES (
  'admin',
  crypt('password', gen_salt('bf')),
  'admin'
);

INSERT INTO users VALUES (
  'magazynier',
  crypt('password', gen_salt('bf')),
  'magazynier'
);

CREATE TABLE inventory (
  product_id SERIAL PRIMARY KEY,
  product_name TEXT NOT NULL,
  product_location TEXT NOT NULL,
  product_price DECIMAL(10, 2) NOT NULL,
  product_count INT NOT NULL
);