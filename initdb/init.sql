-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users
CREATE TABLE users (
    username      TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL  -- admin | magazynier | supplier | client
);

INSERT INTO users VALUES ('admin',      crypt('password', gen_salt('bf')), 'admin');
INSERT INTO users VALUES ('magazynier', crypt('password', gen_salt('bf')), 'magazynier');
INSERT INTO users VALUES ('dostawca1',  crypt('password', gen_salt('bf')), 'supplier');
INSERT INTO users VALUES ('dostawca2',  crypt('password', gen_salt('bf')), 'supplier');
INSERT INTO users VALUES ('klient1',    crypt('password', gen_salt('bf')), 'client');
INSERT INTO users VALUES ('klient2',    crypt('password', gen_salt('bf')), 'client');

-- Supplier profiles
CREATE TABLE supplier_profiles (
    username     TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    company_name TEXT,
    phone        TEXT,
    email        TEXT
);

INSERT INTO supplier_profiles (username, company_name, phone, email) VALUES
    ('dostawca1', 'Tatrzańskie Smaki Sp. z o.o.', '+48 501 111 222', 'kontakt@tatrzanskiesmaki.pl'),
    ('dostawca2', 'Kaszubskie Specjały',          '+48 502 333 444', 'biuro@kaszubskiespecjaly.pl');

-- Client profiles
-- Created automatically on registration; can be updated by the client.
CREATE TABLE client_profiles (
    username  TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    full_name TEXT,
    email     TEXT,
    phone     TEXT,
    address   TEXT  -- default delivery address
);

INSERT INTO client_profiles (username, full_name, email, phone, address) VALUES
    ('klient1', 'Anna Kowalska',  'anna@example.pl',  '+48 601 000 001', 'ul. Długa 1, 80-001 Gdańsk'),
    ('klient2', 'Marek Nowak',    'marek@example.pl', '+48 601 000 002', 'ul. Krótka 2, 81-001 Gdynia');

-- Inventory
CREATE TABLE inventory (
    product_id       SERIAL PRIMARY KEY,
    product_name     TEXT           NOT NULL,
    product_location TEXT           NOT NULL,
    product_price    DECIMAL(10, 2) NOT NULL,
    product_count    INT            NOT NULL
);

INSERT INTO inventory (product_name, product_location, product_price, product_count) VALUES
    ('Oscypki z Tatr',       'Chłodnia 01', 24.99, 45),
    ('Sernik tradycyjny',    'Chłodnia 02', 18.50, 30),
    ('Miód pszczeli górski', 'Regał A',     35.00, 20),
    ('Ciupagi tatrzańskie',  'Regał B',     22.00, 15),
    ('Kiełbasa Kociewska',   'Chłodnia 02', 16.99, 50),
    ('Żytniak chleb żytni',  'Regał A',      8.50, 60),
    ('Twaróg górski',        'Chłodnia 01', 12.99, 25),
    ('Kiełbasa Kaszubska',   'Chłodnia 01',  5.99, 80),
    ('Miodownik (piernik)',  'Regał A',     14.99, 35),
    ('Masło górskie',        'Chłodnia 01', 19.99, 40);

-- Deliveries
CREATE TABLE deliveries (
    delivery_id       SERIAL PRIMARY KEY,
    supplier_username TEXT           NOT NULL REFERENCES users(username),
    product_name      TEXT           NOT NULL,
    quantity          INT            NOT NULL CHECK (quantity > 0),
    proposed_price    DECIMAL(10, 2) NOT NULL CHECK (proposed_price > 0),
    status            TEXT           NOT NULL DEFAULT 'pending',
                      -- pending | accepted | rejected | completed
    notes             TEXT,
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

INSERT INTO deliveries (supplier_username, product_name, quantity, proposed_price, status) VALUES
    ('dostawca1', 'Oscypki z Tatr',       20, 23.50, 'pending'),
    ('dostawca1', 'Twaróg górski',        15, 11.99, 'accepted'),
    ('dostawca2', 'Kiełbasa Kaszubska',   40,  5.50, 'completed'),
    ('dostawca2', 'Miód pszczeli górski', 10, 34.00, 'rejected');

-- Orders
-- Stock is decremented when an order is placed and restored if cancelled.
-- Status lifecycle: pending -> confirmed -> shipped -> delivered
--                            \ cancelled  (from pending or confirmed)
CREATE TABLE orders (
    order_id         SERIAL PRIMARY KEY,
    client_username  TEXT           NOT NULL REFERENCES users(username),
    status           TEXT           NOT NULL DEFAULT 'pending',
    delivery_address TEXT           NOT NULL DEFAULT '',
    notes            TEXT,
    total_price      DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id      INT            NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id    INT            NOT NULL REFERENCES inventory(product_id),
    quantity      INT            NOT NULL CHECK (quantity > 0),
    unit_price    DECIMAL(10, 2) NOT NULL  -- price snapshot at time of order
);

-- Example orders (manually consistent with inventory stock above)
INSERT INTO orders (client_username, status, delivery_address, notes, total_price) VALUES
    ('klient1', 'pending',   'ul. Długa 1, 80-001 Gdańsk',  NULL,               49.98),  -- 2x Oscypki
    ('klient1', 'confirmed', 'ul. Długa 1, 80-001 Gdańsk', 'Proszę zapakować', 35.00), -- 1x Miód
    ('klient2', 'shipped',   'ul. Krótka 2, 81-001 Gdynia', NULL,              25.98);  -- 2x Twaróg

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 1, 2, 24.99),  -- 2x Oscypki z Tatr
    (2, 3, 1, 35.00),  -- 1x Miód pszczeli górski
    (3, 7, 2, 12.99);  -- 2x Twaróg górski
