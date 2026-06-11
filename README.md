# Lokalny Koszyk 🧺

Nowoczesny webowy system do zarządzania hurtownią produktów regionalnych. Platform automatyzuje procesy magazynowe, zarządzanie dostawcami, obsługę zamówień klientów i zapewnia bezpieczne zarządzanie rolami dostępu.

## Technologia

- **Backend:** Go 1.21 (REST API, JWT Authentication)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Baza danych:** PostgreSQL Alpine
- **Konteneryzacja:** Docker, Docker Compose
- **Serwer:** Nginx (reverse proxy)

## Główne Funkcje

- 🔐 **Autentykacja JWT** - Bezpieczne logowanie z tokenami
- 🛒 **Publiczny Katalog** - Niezalogowani użytkownicy mogą przeglądać dostępne produkty
- 📦 **Zarządzanie Zapasami** - Dodawanie, edytowanie, usuwanie produktów (admin/magazynier)
- 📍 **Lokalizacja Produktów** - Produkty przechowywane w konkretnych lokalizacjach magazynowych
- 🛍️ **Koszyk Zakupowy** - Klienci mogą składać zamówienia
- 📋 **Zarządzanie Zamówieniami** - Workflow: pending → confirmed → shipped → delivered
- 🚚 **Dostawy od Dostawców** - Admin/Magazynier mogą zamawiać od dostawców bezpośrednio
- 👥 **Role-Based Access Control** - Admin, Magazynier, Dostawca, Klient
- 🎯 **Deferred Inventory** - Produkty usuwane z magazynu dopiero po wysłaniu zamówienia
- 📊 **Dashboard** - Panel zarządzania dla każdej roli

## Struktura Projektu

```
lokalny-koszyk/
├── backend/                 # Kod aplikacji Go
│   ├── main.go             # REST API, middleware, handlery
│   ├── go.mod              # Zależności Go
│   └── Dockerfile          # Obraz Docker
├── frontend/               # Kod frontendu
│   ├── index.html          # Strona główna
│   ├── login.html          # Strona logowania
│   ├── catalogue.html      # Katalog produktów
│   ├── dashboard.html      # Panel zarządzania
│   ├── docs.html           # Wiki i dokumentacja
│   ├── css/
│   │   ├── style.css       # Style główne
│   │   └── docs-style.css  # Style Wiki
│   └── js/
│       ├── script.js       # Logika logowania
│       ├── catalogue.js    # Logika katalogów
│       ├── dashboard.js    # Logika dashboardu
│       └── docs-script.js  # Logika Wiki
├── nginx/                  # Konfiguracja proxy
│   └── nginx.conf          # Reguły routingu
├── initdb/                 # Inicjalizacja bazy
│   └── init.sql            # Schemat i dane
└── docker-compose.yml      # Orkiestracja
```

## Wymagania

- Docker i Docker Compose (dla najprostszej instalacji)
- Go 1.19+ (dla lokalnego development)

## Instalacja i Uruchomienie

### Docker Compose (rekomendowane)

```bash
git clone <repo-url>
cd lokalny-koszyk
docker-compose up --build
```

Aplikacja będzie dostępna na: `http://localhost:8080`

### Lokalne uruchomienie

#### Backend:
```bash
cd backend
go mod download
go run main.go
```

#### Frontend:
```bash
cd frontend
python -m http.server 8000
```

## API Endpoints

### Publiczne
- `GET /api/catalogue` - Lista produktów dostępnych (bez cen, bez lokalizacji)
- `GET /api/catalogue/{id}` - Szczegóły produktu
- `POST /api/login` - Logowanie (zwraca JWT token)
- `POST /api/register` - Rejestracja nowego użytkownika

### Chronione (wymagają JWT)

**Zarządzanie Zapasami (admin, magazynier)**
- `GET /api/inventory` - Lista wszystkich zapasów
- `POST /api/inventory` - Dodaj produkt
- `GET /api/inventory/{id}` - Szczegóły zapasu
- `PUT /api/inventory/{id}` - Aktualizuj produkt
- `DELETE /api/inventory/{id}` - Usuń produkt
- `POST /api/inventory/move` - Przesuń produkt między lokalizacjami

**Zamówienia Klientów (wszyscy zalogowani)**
- `POST /api/orders` - Utwórz zamówienie
- `GET /api/orders` - Lista zamówień (klient widzi swoje, admin widzi wszystkie)
- `GET /api/orders/{id}` - Szczegóły zamówienia
- `PATCH /api/orders/{id}/status` - Zmień status: pending → confirmed → shipped → delivered

**Dostawy (admin, magazynier, dostawca)**
- `POST /api/deliveries` - Prześlij dostawę (dostawca)
- `GET /api/deliveries` - Lista dostaw
- `PATCH /api/deliveries/{id}/status` - Zmień status dostawy
- `POST /api/deliveries/supplier-order` - Zamów od dostawcy (admin, magazynier)

**Lokalizacje (wszyscy zalogowani)**
- `GET /api/locations` - Lista lokalizacji
- `POST /api/locations` - Dodaj lokalizację (admin, magazynier)
- `DELETE /api/locations/{id}` - Usuń lokalizację (admin, magazynier)

**Dostawcy (wszyscy zalogowani)**
- `GET /api/users/suppliers` - Lista wszystkich dostawców

## Dokumentacja

Pełną dokumentację projektu znajdziesz w [Wiki](./frontend/docs.html):
- Plan Projektu
- Instrukcje Instalacji
- Architektura Systemu
- Historia zadań

## Logowanie

Domyślne dane do logowania:
- **Nazwa użytkownika:** `admin`
- **Hasło:** `password`

## Funkcje dla Różnych Ról

### Admin
- Pełny dostęp do zarządzania produktami i zapasami
- Widok katalogów
- Panel administracyjny

### Magazynier
- Zarządzanie zapasami
- Widok katalogów

### Inne Role
- Widok publicznego katalogów produktów
3. Push branch (`git push origin feature/AmazingFeature`)
4. Otwórz Pull Request
