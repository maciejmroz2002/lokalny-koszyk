# Lokalny Koszyk 🧺

Webowy system do zarządzania hurtownią produktów regionalnych. Automatyzuje procesy magazynowe, zarządzanie dostawcami i wysyła alerty o niskich stanach towarowych.

## Technologia

- **Backend:** Go (REST API, JWT Authentication)
- **Frontend:** HTML, CSS, JavaScript
- **Baza danych:** PostgreSQL
- **Konteneryzacja:** Docker, Docker Compose
- **Serwer:** Nginx (reverse proxy)

## Główne Funkcje

- 🔐 Autentykacja JWT z rolami użytkowników (admin, magazynier)
- 📦 Monitorowanie stanów magazynowych w czasie rzeczywistym
- 🛍️ Publiczny katalog produktów
- 📋 Zarządzanie produktami i zapasami (dla uprawnień użytkowników)
- 👥 Obsługa wielu ról użytkowników
- 📊 Panel administratora z dashboardem

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
- `GET /api/catalogue` - Lista produktów
- `GET /api/catalogue/{id}` - Szczegóły produktu
- `POST /api/login` - Logowanie (zwraca JWT token)

### Chronione (wymagają JWT)
- `GET /api/inventory` - Lista zapasów (admin, magazynier)
- `POST /api/inventory` - Dodaj produkt (admin, magazynier)
- `GET /api/inventory/{id}` - Szczegóły zapasu (admin, magazynier)
- `PUT /api/inventory/{id}` - Aktualizuj produkt (admin, magazynier)
- `DELETE /api/inventory/{id}` - Usuń produkt (admin, magazynier)

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
