let allPages = {};

document.addEventListener('DOMContentLoaded', function() {
    const pageContent = document.getElementById('page-content');
    const pageTitle = document.getElementById('page-title');
    const breadcrumb = document.getElementById('breadcrumb');
    const menuLinks = document.querySelectorAll('.menu-link');
    const searchInput = document.getElementById('search-input');
    const menuToggle = document.getElementById('menu-toggle');
    const homeLink = document.getElementById('home-link');
    const sidebar = document.getElementById('sidebar');

    // Menu toggle dla mobile
    let isMobileMenuOpen = false;
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            isMobileMenuOpen = !isMobileMenuOpen;
            sidebar.classList.toggle('mobile-open');
            menuToggle.innerHTML = isMobileMenuOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        });
    }

    // Home link - navigate to landing page
    if (homeLink) {
        homeLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '../index.html';
        });
    }


    // Zamknij menu po kliknięciu na link
    menuLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                isMobileMenuOpen = false;
                sidebar.classList.remove('mobile-open');
                if (menuToggle) menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
            }
        });
    });

    // Zamknij menu na kliknięciu poza nim
    document.addEventListener('click', function(event) {
        if (window.innerWidth <= 768 && isMobileMenuOpen) {
            if (!sidebar.contains(event.target) && !menuToggle.contains(event.target)) {
                isMobileMenuOpen = false;
                sidebar.classList.remove('mobile-open');
                if (menuToggle) menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
            }
        }
    });

    // Załaduj wszystkie strony do pamięci
    loadAllPages();

    // Wygeneruj spis treści dla strony głównej
    generateTableOfContents();

    // Event listenery dla menu
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            displayPage(page);
            setActive(this);
        });
    });

    // Event listener dla wyszukiwania
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function(e) {
            const searchTerm = e.target.value.toLowerCase();
            filterAndSearch(searchTerm);
        }, 300));
    }

    function loadAllPages() {
        const pages = ['PlanProjektu', 'WizjaSystemu'];
        pages.forEach(page => {
            fetch(`content/${page}.txt`)
                .then(response => response.text())
                .then(data => {
                    allPages[page] = data;
                })
                .catch(error => console.error(`Błąd ładowania ${page}:`, error));
        });
        
        // Statyczne strony
        allPages['OProjekcie'] = null;  // Special page
        allPages['Instrukcja'] = null;  // Special page
        allPages['Zadania'] = null;  // Special page
    }

    function displayPage(page) {
        const pageTitle = document.getElementById('page-title');
        const breadcrumb = document.getElementById('breadcrumb');

        pageTitle.textContent = formatPageName(page);
        
        breadcrumb.innerHTML = `<a onclick="location.reload()">Home</a> / <strong>${formatPageName(page)}</strong>`;

        if (page === 'OProjekcie') {
            pageContent.innerHTML = '<p><em>Tu będzie opis czym jest Lokalny Koszyk</em></p>';
        } else if (page === 'Instrukcja') {
            pageContent.innerHTML = `
                <div class="instruction-content">
                    <h2>Instrukcja Instalacji i Uruchomienia</h2>
                    
                    <h3>Szybki Start</h3>
                    <p>Aby szybko uruchomić aplikację, wystarczy:</p>
                    <pre><code>git clone &lt;repo-url&gt;
cd lokalny-koszyk
docker-compose up --build</code></pre>
                    <p>Aplikacja będzie dostępna na <strong>http://localhost:8080</strong></p>
                    
                    <h3>Wymagania Systemowe</h3>
                    <ul>
                        <li><strong>Docker i Docker Compose</strong> - dla uruchamiania kontenerów aplikacji (zalecane)</li>
                        <li><strong>Go 1.19+</strong> - dla lokalnego development bez Dockera</li>
                        <li><strong>PostgreSQL</strong> - baza danych (w Dockerze lub lokalnie)</li>
                        <li><strong>Git</strong> - do klonowania repozytorium</li>
                        <li><strong>Przeglądarka internetowa</strong> - Chrome, Firefox, Safari lub Edge</li>
                    </ul>
                    
                    <h3>Instalacja i Uruchomienie</h3>
                    
                    <h4>Metoda 1: Docker Compose (Rekomendowane)</h4>
                    <ol>
                        <li>Sklonuj repozytorium:
                            <pre><code>git clone &lt;repo-url&gt;
cd lokalny-koszyk</code></pre>
                        </li>
                        <li>Uruchom aplikację:
                            <pre><code>docker-compose up --build</code></pre>
                        </li>
                        <li>Czekaj na komunikat "ready for connections" z bazy danych</li>
                        <li>Otwórz w przeglądarce:
                            <pre><code>http://localhost:8080</code></pre>
                        </li>
                    </ol>
                    
                    <h4>Metoda 2: Lokalne Uruchomienie bez Dockera</h4>
                    
                    <strong>Backend (Go):</strong>
                    <ol>
                        <li>Zainstaluj PostgreSQL lokalnie</li>
                        <li>Przejdź do folderu backend:
                            <pre><code>cd backend</code></pre>
                        </li>
                        <li>Pobierz zależności:
                            <pre><code>go mod download</code></pre>
                        </li>
                        <li>Uruchom aplikację:
                            <pre><code>go run main.go</code></pre>
                        </li>
                    </ol>
                    
                    <strong>Frontend:</strong>
                    <ol>
                        <li>Przejdź do folderu frontend:
                            <pre><code>cd frontend</code></pre>
                        </li>
                        <li>Uruchom serwer HTTP:
                            <pre><code>python -m http.server 8000</code></pre>
                        </li>
                        <li>Otwórz w przeglądarce: <strong>http://localhost:8000</strong></li>
                    </ol>
                    
                    <h3>Dane do Logowania</h3>
                    <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Rola</strong></td>
                            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Nazwa użytkownika</strong></td>
                            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Hasło</strong></td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;">Administrator</td>
                            <td style="padding: 10px; border: 1px solid #ddd;"><code>admin</code></td>
                            <td style="padding: 10px; border: 1px solid #ddd;"><code>password</code></td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;">Magazynier</td>
                            <td style="padding: 10px; border: 1px solid #ddd;"><code>magazynier</code></td>
                            <td style="padding: 10px; border: 1px solid #ddd;"><code>password</code></td>
                        </tr>
                    </table>
                    
                    <h3>Funkcje Aplikacji</h3>
                    <ul>
                        <li><strong>Katalog Publiczny</strong> - Przeglądanie listy dostępnych produktów lokalnych</li>
                        <li><strong>Zarządzanie Zapasami</strong> - Dodawanie, edytowanie i usuwanie produktów (tylko dla admin/magazynier)</li>
                        <li><strong>Uwierzytelnianie JWT</strong> - Bezpieczne logowanie z tokenami JWT</li>
                        <li><strong>Role-based Access Control</strong> - Różne uprawnienia dla różnych ról użytkowników</li>
                    </ul>
                    
                    <h3>Rozwiązywanie Problemów</h3>
                    <ul>
                        <li><strong>Port 8080 zajęty:</strong> Zmień port w docker-compose.yml (zmiana wartości <code>ports: "8080:80"</code>)</li>
                        <li><strong>Błędy bazy danych:</strong> Sprawdź plik <code>initdb/init.sql</code> i upewnij się, że PostgreSQL jest uruchomiony</li>
                        <li><strong>CSS/JS nie ładuje się:</strong> Wyczyść cache przeglądarki (Ctrl+Shift+Delete lub Cmd+Shift+Delete)</li>
                        <li><strong>Błędy CORS:</strong> Upewnij się, że backend i frontend używają prawidłowych portów</li>
                        <li><strong>Nie mogę się zalogować:</strong> Upewnij się, że baza danych została zainicjalizowana z domyślnymi użytkownikami</li>
                        <li><strong>Błędy Docker:</strong> Spróbuj: <code>docker-compose down && docker-compose up --build</code></li>
                    </ul>
                    
                    <h3>Struktura Projektu</h3>
                    <ul>
                        <li><code>backend/</code> - REST API w Go</li>
                        <li><code>frontend/</code> - HTML, CSS, JavaScript</li>
                        <li><code>nginx/</code> - Konfiguracja reverse proxy</li>
                        <li><code>initdb/</code> - Skrypty inicjalizacji bazy danych</li>
                        <li><code>docker-compose.yml</code> - Konfiguracja kontenerów</li>
                    </ul>
                    
                    <h3>Pierwsze Kroki Po Uruchomieniu</h3>
                    <ol>
                        <li>Zaloguj się na konto <strong>admin</strong> (hasło: password)</li>
                        <li>Przejdź do sekcji "Zarządzanie Zapasami"</li>
                        <li>Dodaj kilka produktów (oscypki, ciupagi, ser, miód itp.)</li>
                        <li>Przeglądaj katalog publicznie dostępnych produktów</li>
                        <li>Zarządzaj zapasami i cenami</li>
                    </ol>
                </div>
            `;
        } else if (page === 'Zadania') {
            pageContent.innerHTML = `
                <div class="task-post">
                    <div class="post-header">
                        <h3 class="post-date">30 kwietnia 2026</h3>
                    </div>
                    <div class="post-content">
                        <h4>Dokumentacja</h4>
                        <ul>
                            <li>Aktualizacja dokumentacji technicznej</li>
                        </ul>

                        <h4>Programowanie</h4>
                        <ul>
                            <li>Modul katalog produktów i zarządzania produktami</li>
                        </ul>
                    </div>
                </div>

                <div class="task-post">
                    <div class="post-header">
                        <h3 class="post-date">20 kwietnia 2026</h3>
                    </div>
                    <div class="post-content">
                        <h4>Dokumentacja</h4>
                        <ul>
                            <li>Poprawienie priorytetów żeby były spójne między dwoma plikami</li>
                            <li>Pełna wersja architektury systemu</li>
                            <li>Korekta w iteracjach</li>
                        </ul>

                        <h4>Programowanie</h4>
                        <ul>
                            <li>Przygotowanie struktury</li>
                            <li>Działający panel logowania</li>
                        </ul>
                    </div>
                </div>
                
                <div class="task-post">
                    <div class="post-header">
                        <h3 class="post-date">30 marca 2026</h3>
                    </div>
                    <div class="post-content">
                        <h4>Do poprawy w analizie</h4>
                        <ul>
                            <li>Sprawdzenie spójności dokumentów</li>
                            <li>Poprawa Interesariusze i Użytkownicy są różni</li>
                            <li>1 persona dla każdego użytkownika</li>
                            <li>Dodać więcej interesariuszy nie bezpośrednich (np. turyści)</li>
                            <li>Customer Journey: więcej przypadków</li>
                            <li>Zrzuty ekranu podobnych systemów</li>
                        </ul>

                        <h4>Analiza i Wizja</h4>
                        <ul>
                            <li>Analiza i wizja jako jeden dokument, a plan w oddzielnym</li>
                            <li>Poprawa analizy</li>
                            <li>Przedstawienie wizji i analizy w nowym wydaniu (dowolny format)</li>
                        </ul>
                    </div>
                </div>
            `;
        } else if (allPages[page]) {
            const formatted = formatContent(allPages[page]);
            pageContent.innerHTML = formatted;
        } else {
            pageContent.innerHTML = '<p>Ładowanie...</p>';
        }
        
        // Zawsze generuj spis treści dla każdej strony
        generateTableOfContents();
    }

    function formatContent(text) {
        // Podstawowe formatowanie tekstu
        let html = escapeHtml(text);
        
        // Nagłówki (linie zaczynające się od #)
        html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
        
        // Pogrubienie (**text**)
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Kursywa (*text*)
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Listy
        html = html.replace(/^- (.*?)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>');
        html = html.replace(/<\/ul>\n<ul>/g, '');
        
        // Paragrafy
        html = '<p>' + html.replace(/\n\n/g, '</p><p>') + '</p>';
        html = html.replace(/<p>\s*<\/p>/g, '');
        html = html.replace(/<p>(<h[1-3])/g, '$1');
        html = html.replace(/(<\/h[1-3]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<ul>)/g, '$1');
        html = html.replace(/(<\/ul>)<\/p>/g, '$1');
        
        return html;
    }

    function filterAndSearch(term) {
        if (term === '') {
            // Pokazuj wszystkie linki menu
            menuLinks.forEach(link => link.classList.remove('hidden'));
            pageContent.innerHTML = '<div class="welcome"><h3>Witaj w dokumentacji!</h3><p>Wpisz coś w wyszukiwarkę, aby znaleźć dokumentację.</p></div>';
            return;
        }

        let results = [];
        let hasResults = false;

        // Szukaj w treści stron
        menuLinks.forEach(link => {
            const page = link.getAttribute('data-page');
            const pageContent = allPages[page];

            if (pageContent && pageContent.toLowerCase().includes(term)) {
                link.classList.remove('hidden');
                hasResults = true;
                // Wyodrębniej fragment dopasowania
                const index = pageContent.toLowerCase().indexOf(term);
                const snippet = pageContent.substring(Math.max(0, index - 50), Math.min(pageContent.length, index + 100));
                results.push({ page, snippet });
            } else {
                link.classList.add('hidden');
            }
        });

        // Wyświetl wyniki
        if (hasResults) {
            let resultsHtml = `<h3>Wyniki wyszukiwania dla: "${escapeHtml(term)}"</h3>`;
            resultsHtml += `<p>Znaleziono ${results.length} dopasowanie(ń).</p>`;
            resultsHtml += '<div class="search-results">';
            
            results.forEach(result => {
                resultsHtml += `<div class="result-item">`;
                resultsHtml += `<h4><a href="#" onclick="document.querySelector('[data-page=\"${result.page}\"]').click(); return false;">${formatPageName(result.page)}</a></h4>`;
                resultsHtml += `<p>...${escapeHtml(result.snippet).substring(0, 150)}...</p>`;
                resultsHtml += `</div>`;
            });
            resultsHtml += '</div>';
            pageContent.innerHTML = resultsHtml;
        } else {
            pageContent.innerHTML = '<p>Brak wyników dla: "' + escapeHtml(term) + '"</p>';
        }
    }

    function setActive(element) {
        menuLinks.forEach(link => link.classList.remove('active'));
        element.classList.add('active');
    }

    function formatPageName(page) {
        return page.replace(/([A-Z])/g, ' $1').trim();
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function generateTableOfContents() {
        const toc = document.getElementById('table-of-contents');
        const headings = pageContent.querySelectorAll('h1, h2, h3');
        
        if (headings.length === 0) {
            toc.innerHTML = '<p class="toc-empty">Brak nagłówków na tej stronie</p>';
            return;
        }
        
        let tocHtml = '<ul class="toc-list">';
        let currentLevel = 0;
        
        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.substring(1));
            const text = heading.textContent;
            const id = `heading-${index}`;
            heading.id = id;
            
            // Dostosuj poziom zagnieżdżenia
            if (level > currentLevel) {
                for (let i = currentLevel; i < level; i++) {
                    tocHtml += '<ul class="toc-sublist">';
                }
            } else if (level < currentLevel) {
                for (let i = level; i < currentLevel; i++) {
                    tocHtml += '</ul>';
                }
            }
            
            tocHtml += `<li><a href="#${id}" class="toc-link">${escapeHtml(text)}</a></li>`;
            currentLevel = level;
        });
        
        // Zamknij pozostałe listy
        for (let i = 1; i < currentLevel; i++) {
            tocHtml += '</ul>';
        }
        tocHtml += '</ul>';
        
        toc.innerHTML = tocHtml;
        
        // Dodaj event listenery do linków spisu treści
        toc.querySelectorAll('.toc-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }
});
