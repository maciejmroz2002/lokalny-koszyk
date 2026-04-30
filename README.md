# Lokalny Koszyk 🧺

Webowy system do zarządzania hurtownią produktów regionalnych. Automatyzuje procesy magazynowe, zarządzanie dostawcami i wysyła alerty o niskich stanach towarowych.

## Technologia

- **Backend:** Go
- **Frontend:** HTMX, HTML, CSS, JavaScript
- **Baza danych:** PostgreSQL
- **Konteneryzacja:** Docker, Docker Compose

## Główne Funkcje

- 📦 Monitorowanie stanów magazynowych w czasie rzeczywistym
- 👥 Zarządzanie relacjami z dostawcami (CRM)
- 📨 Automatyczne alerty o brakach towaru
- 🛒 Obsługa zamówień

## Struktura Projektu

```
lokalny-koszyk/
├── backend/                 # Kod aplikacji Go
│   ├── main.go             # Punkt wejścia aplikacji
│   └── go.mod              # Zależności Go
├── frontend/               # Kod frontendu
│   ├── index.html          # Strona główna
│   ├── login.html          # Strona logowania
│   ├── dashboard.html      # Panel zarządzania
│   ├── css/                # Stylizacja
│   └── js/                 # Logika frontendu
├── docs/                   # Dokumentacja i Wiki
│   ├── index.html          # Wiki główna
│   ├── css/                # Style Wiki
│   └── js/                 # Skrypty Wiki
├── initdb/                 # Skrypty inicjalizacji bazy danych
│   └── init.sql            # Schemat bazy danych
└── docker-compose.yml      # Konfiguracja Docker Compose
```

## Wymagania

- Docker i Docker Compose
- Go 1.19+ (dla lokalnego development bez Dockera)
- Node.js (opcjonalnie, do budowania frontendu)

## Instalacja i Uruchomienie

### Przy użyciu Docker Compose (rekomendowane)

1. Sklonuj repozytorium:
```bash
git clone <repo-url>
cd lokalny-koszyk
```

2. Uruchom aplikację:
```bash
docker-compose up --build
```

3. Otwórz w przeglądarce:
```
http://localhost:8080
```

### Lokalne uruchomienie bez Dockera

#### Backend:
```bash
cd backend
go mod download
go run main.go
```

#### Frontend:
Otwórz plik `frontend/index.html` w przeglądarce lub używając lokalnego serwera:
```bash
cd frontend
python -m http.server 8000
```

## Dokumentacja

Pełną dokumentację projektu znajdziesz w [Wiki](./docs/index.html):
- [Plan Projektu](./docs/index.html)
- [Instrukcje Instalacji](./docs/index.html)
- [Architektura Systemu](./docs/index.html)

## Logowanie

Domyślne dane do logowania:
- **Nazwa użytkownika:** `admin`
- **Hasło:** `password`

## Dalszy Rozwój

Aby przyczynić się do projektu:
1. Stwórz feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit zmian (`git commit -m 'Add some AmazingFeature'`)
3. Push branch (`git push origin feature/AmazingFeature`)
4. Otwórz Pull Request
