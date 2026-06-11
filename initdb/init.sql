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

    ('dostawca2', 'Kaszubskie Specjały',           '+48 502 333 444', 'biuro@kaszubskiespecjaly.pl');



-- Client profiles

CREATE TABLE client_profiles (

    username  TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,

    full_name TEXT,

    email     TEXT,

    phone     TEXT,

    address   TEXT

);



INSERT INTO client_profiles (username, full_name, email, phone, address) VALUES

    ('klient1', 'Anna Kowalska', 'anna@example.pl',  '+48 601 000 001', 'ul. Długa 1, 80-001 Gdańsk'),

    ('klient2', 'Marek Nowak',   'marek@example.pl', '+48 601 000 002', 'ul. Krótka 2, 81-001 Gdynia');



-- Locations (warehouse shelves/sections)

CREATE TABLE locations (

    location_id SERIAL PRIMARY KEY,

    name        TEXT NOT NULL UNIQUE,

    x           INT  NOT NULL DEFAULT 0,

    y           INT  NOT NULL DEFAULT 0,

    width       INT  NOT NULL DEFAULT 100,

    height      INT  NOT NULL DEFAULT 100,

    is_mapped   BOOLEAN NOT NULL DEFAULT false

);



-- Warehouse map (JSON layout)

CREATE TABLE warehouse_maps (

    map_id      SERIAL PRIMARY KEY,

    map_data    JSONB       NOT NULL,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



-- Product Categories

CREATE TABLE categories (

    category_id SERIAL PRIMARY KEY,

    name        TEXT NOT NULL UNIQUE,

    description TEXT

);



-- Inventory

CREATE TABLE inventory (

    product_id       SERIAL PRIMARY KEY,

    product_name     TEXT           NOT NULL,

    product_location TEXT           NOT NULL,

    product_price    DECIMAL(10, 2) NOT NULL,

    product_count    INT            NOT NULL DEFAULT 0,

    category         TEXT           NOT NULL DEFAULT 'Inne'

);



-- Example categories

INSERT INTO categories (name, description) VALUES

    ('Mleczarstwo', 'Produkty mleczne, sery, maślanki'),

    ('Miody', 'Naturalne miody i produkty pszczele'),

    ('Piekarstwo', 'Chleby, bułki, wypieki'),

    ('Warzywa', 'Świeże warzywa i owoce'),

    ('Inne', 'Pozostałe produkty');



INSERT INTO inventory (product_name, product_location, product_price, product_count, category) VALUES

    ('Oscypki z Tatr',       'Chłodnia 01', 24.99, 45, 'Mleczarstwo'),

    ('Sernik tradycyjny',    'Chłodnia 02', 18.50, 30, 'Mleczarstwo'),

    ('Miód pszczeli górski', 'Regał A',     35.00, 20, 'Miody'),

    ('Ciupagi tatrzańskie',  'Regał B',     22.00, 15, 'Piekarstwo'),

    ('Kiełbasa Kociewska',   'Chłodnia 02', 16.99, 50, 'Mięsa'),

    ('Żytniak chleb żytni',  'Regał A',      8.50, 60, 'Piekarstwo'),

    ('Twaróg górski',        'Chłodnia 01', 12.99, 25, 'Mleczarstwo'),

    ('Kiełbasa Kaszubska',   'Chłodnia 01',  5.99, 80, 'Mięsa'),

    ('Miodownik (piernik)',  'Regał A',     14.99, 35, 'Piekarstwo'),

    ('Masło górskie',        'Chłodnia 01', 19.99, 40, 'Mleczarstwo');



-- Deliveries

CREATE TABLE deliveries (

    delivery_id       SERIAL PRIMARY KEY,

    supplier_username TEXT           NOT NULL REFERENCES users(username),

    product_name      TEXT           NOT NULL,

    quantity          INT            NOT NULL CHECK (quantity > 0),

    proposed_price    DECIMAL(10, 2) NOT NULL CHECK (proposed_price > 0),

    status            TEXT           NOT NULL DEFAULT 'pending',

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

CREATE TABLE orders (

    order_id         SERIAL PRIMARY KEY,

    client_username  TEXT           NOT NULL REFERENCES users(username),

    status           TEXT           NOT NULL DEFAULT 'pending',

    delivery_address TEXT           NOT NULL DEFAULT '',

    notes            TEXT,

    total_price      DECIMAL(10, 2) NOT NULL DEFAULT 0,

    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    inventory_deducted BOOLEAN      NOT NULL DEFAULT false

);



CREATE TABLE order_items (

    order_item_id SERIAL PRIMARY KEY,

    order_id      INT            NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,

    product_id    INT            NOT NULL REFERENCES inventory(product_id),

    quantity      INT            NOT NULL CHECK (quantity > 0),

    unit_price    DECIMAL(10, 2) NOT NULL

);



INSERT INTO orders (client_username, status, delivery_address, notes, total_price) VALUES

    ('klient1', 'pending',   'ul. Długa 1, 80-001 Gdańsk',  NULL,               49.98),

    ('klient1', 'confirmed', 'ul. Długa 1, 80-001 Gdańsk', 'Proszę zapakować', 35.00),

    ('klient2', 'shipped',   'ul. Krótka 2, 81-001 Gdynia', NULL,              25.98);



INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES

    (1, 1, 2, 24.99),

    (2, 3, 1, 35.00),

    (3, 7, 2, 12.99);



-- Example locations

INSERT INTO locations (name, x, y, width, height) VALUES

    ('Chłodnia 01', 10,  10,  120, 150),

    ('Chłodnia 02', 150, 10,  120, 150),

    ('Regał A',     10,  170, 120, 120),

    ('Regał B',     150, 170, 120, 120);



-- Example warehouse map

INSERT INTO warehouse_maps (map_data) VALUES (

  jsonb_build_object(

    'width', 400,

    'height', 400,

    'locations', jsonb_build_array(

      jsonb_build_object('name', 'Chłodnia 01', 'x', 10,  'y', 10,  'width', 120, 'height', 150),

      jsonb_build_object('name', 'Chłodnia 02', 'x', 150, 'y', 10,  'width', 120, 'height', 150),

      jsonb_build_object('name', 'Regał A',     'x', 10,  'y', 170, 'width', 120, 'height', 120),

      jsonb_build_object('name', 'Regał B',     'x', 150, 'y', 170, 'width', 120, 'height', 120)

    )

  )

);



