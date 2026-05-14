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

-- Dodaj przykładowe produkty lokalne
INSERT INTO inventory (product_name, product_location, product_price, product_count) VALUES
('Oscypki z Tatr', 'Chłodnia 01', 24.99, 45),
('Sernik tradycyjny', 'Chłodnia 02', 18.50, 30),
('Miód pszczeli górski', 'Regał A', 35.00, 20),
('Ciupagi tatrzańskie', 'Regał B', 22.00, 15),
('Kiełbasa Kociewska', 'Chłodnia 02', 16.99, 50),
('Żytniak chleb żytni', 'Regał A', 8.50, 60),
('Twaróg górski', 'Chłodnia 01', 12.99, 25),
('Kiełbasa Kaszubska', 'Chłodnia 01', 5.99, 80),
('Miodownik (piernik)', 'Regał A', 14.99, 35),
('Masło górskie', 'Chłodnia 01', 19.99, 40);