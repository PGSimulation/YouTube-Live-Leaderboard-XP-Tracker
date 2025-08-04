# YouTube-Live-Leaderboard-XP-Tracker

**Śledź punkty XP na żywo z leaderboardu YouTube Live i analizuj je w interaktywnym dashboardzie!**

## Założenia projektu

**YouTube Live Leaderboard XP Tracker** to skrypt użytkownika (userscript) zaprojektowany do automatycznego zbierania i analizowania danych punktów XP z leaderboardu na czatach na żywo YouTube. Projekt powstał, aby ułatwić streamerom i widzom monitorowanie aktywności fanów w czasie rzeczywistym oraz generowanie szczegółowych raportów w formie wykresów i tabel.

### Główne cele projektu:
1. **Automatyzacja zbierania danych**:
   - Automatyczne otwieranie panelu leaderboardu za pomocą zapisanego makra kliknięć lub domyślnych selektorów.
   - Zbieranie danych XP z leaderboardu co 60 sekund.
   - Trwały zapis danych w `localStorage` przeglądarki.

2. **Trwałość makra**:
   - Zapis makra kliknięć w `localStorage` pod kluczem `yt_xp_tracker_macro_v2`, które pozostaje niezmienione między sesjami, dopóki użytkownik nie zapisze nowego.
   - Możliwość nagrywania nowego makra i odczytywania istniejącego poprzez menu skryptu.

3. **Interaktywny dashboard**:
   - Generowanie wykresów liniowych (XP w czasie) i kołowych (udział w największych skokach XP).
   - Filtrowanie użytkowników, kontrola skali osi Y (liniowa/logarytmiczna) i eksport do PNG/CSV.
   - Zapis dashboardu jako plik HTML z unikalną nazwą `xp_tracker_<videoId>.html`.

4. **Poprawność metadanych**:
   - Automatyczne pobieranie tytułów streamów z metadanych strony `/watch`.
   - Wyświetlanie tytułów w liście rozwijanej dashboardu zamiast surowych `videoId`.

5. **Niezawodność i odporność na błędy**:
   - Obsługa błędów parsowania danych w `localStorage` z automatycznym czyszczeniem uszkodzonych kluczy.
   - Domyślne selektory do otwierania leaderboardu, jeśli makro nie działa.
   - Logowanie działań w konsoli dla łatwego debugowania.

## Opis skryptu

**YouTube Live Leaderboard XP Tracker** to skrypt działający w przeglądarce za pomocą menedżera skryptów użytkownika, np. Tampermonkey. Działa na stronach YouTube (`/watch` i `/live_chat`) i wykonuje następujące funkcje:

- **Na stronie `/watch`**:
  - Pobiera metadane streamu (tytuł, URL, `videoId`) i zapisuje je w `localStorage`.
  - Dodaje opcję ręcznego zapisu metadanych w menu skryptu.
  - Umożliwia otwarcie czatu w trybie pop-out.

- **Na stronie `/live_chat`**:
  - Automatycznie otwiera panel leaderboardu za pomocą zapisanego makra lub domyślnych selektorów (co 60 sekund, jeśli panel nie jest otwarty).
  - Zbiera dane XP (nazwa użytkownika, punkty) i zapisuje je z sygnaturą czasową w `localStorage`.
  - Odświeża stronę co 60 sekund, aby zapewnić ciągłość działania.

- **Dashboard**:
  - Dostępny przez opcję „Otwórz Przeglądarkę Danych” lub zapisany jako plik HTML.
  - Wyświetla listę zapisanych streamów (z tytułami lub `Stream (<videoId>) (ID: <videoId>)`).
  - Generuje wykresy liniowy (postęp XP w czasie) i kołowy (udział w skokach XP).
  - Umożliwia filtrowanie użytkowników, zmianę skali osi Y i eksport do PNG/CSV.
  - Aktualizuje dane co 60 sekund w czasie rzeczywistym.

- **Makro kliknięć**:
  - Zapisuje sekwencję kliknięć do otwierania leaderboardu w `localStorage` (trwałe między sesjami).
  - Opcje w menu: „Nagraj NOWE Makro Kliknięcia” (nadpisuje stare makro) i „Pokaż Zapisane Makro” (wyświetla w konsoli).

- **Eksport i zarządzanie danymi**:
  - Zapis dashboardu jako plik HTML (`xp_tracker_<videoId>.html`).
  - Opcje czyszczenia danych bieżącego streamu lub wszystkich streamów.
  - Eksport rankingów do CSV i wykresów do PNG.

## Wymagania
- Przeglądarka internetowa (np. Chrome, Firefox).
- Zainstalowany menedżer skryptów użytkownika, np. [Tampermonkey](https://www.tampermonkey.net/).
- Dostęp do strony YouTube (`https://*.youtube.com/*`).
- Odblokowane pop-upy dla `youtube.com` (dla dashboardu).

## Instalacja
1. Zainstaluj [Tampermonkey](https://www.tampermonkey.net/) w swojej przeglądarce.
2. Pobierz kod skryptu z pliku `youtube-live-xp-tracker.user.js` z [najnowszego wydania](https://github.com/[TwojaNazwaUzytkownika]/youtube-live-xp-tracker/releases) lub skopiuj go z repozytorium.
3. Otwórz Tampermonkey w przeglądarce, kliknij „Create a new script” i wklej kod skryptu.
4. Zapisz skrypt i upewnij się, że jest włączony.
5. Odwiedź stronę YouTube z aktywnym streamem (`/watch?v=<videoId>`) lub czatem (`/live_chat?v=<videoId>`).

## Użytkowanie
1. **Zbieranie danych**:
   - Otwórz stronę streamu (`/watch?v=<videoId>`), aby zapisać metadane (tytuł, URL).
   - Przejdź do czatu w trybie pop-out (użyj opcji „Otwórz Pop-out Czat & Tracker” z menu skryptu).
   - Jeśli panel leaderboardu nie otwiera się automatycznie:
     - Wybierz „Nagraj NOWE Makro Kliknięcia” z menu skryptu.
     - Kliknij raz przycisk otwierający leaderboard (np. „Top Fans”).
     - Potwierdź zapis makra w alercie.
   - Sprawdź konsolę przeglądarki (F12) dla logów:
     ```
     [YT XP Tracker] Zebrano X wpisów z leaderboardu.
     [YT XP Tracker] Zapisano dane XP dla klucza yt_xp_tracker_<videoId>: ...
     ```

2. **Wyświetlanie zapisanych makr**:
   - Użyj opcji „Pokaż Zapisane Makro” z menu skryptu.
   - Sprawdź konsolę (F12) dla szczegółów makra:
     ```
     --- ZAPISANE MAKRO --- [{selector: "...", tag: "...", text: "..."}, ...]
     ```

3. **Przeglądanie danych**:
   - Wybierz „Otwórz Przeglądarkę Danych” z menu skryptu.
   - Wybierz stream z listy rozwijanej (tytuły lub `Stream (<videoId>) (ID: <videoId>)`).
   - Analizuj wykresy, filtruj użytkowników, dostosuj skalę osi Y lub pobierz dane (PNG/CSV).

4. **Zapis dashboardu**:
   - Wybierz „Pobierz Dashboard jako HTML” z menu skryptu.
   - Zapisz plik `xp_tracker_<videoId>.html` i otwórz go w przeglądarce.

5. **Czyszczenie danych**:
   - Użyj „Wyczyść dane bieżącego streama” lub „Wyczyść wszystkie dane streamów” z menu skryptu, aby usunąć zapisane dane.

## Rozwiązywanie problemów
- **Makro nie otwiera panelu leaderboardu**:
  - Sprawdź konsolę (F12):
    ```
    [YT XP Tracker] Nie znaleziono elementu dla selektora: ...
    [YT XP Tracker] Próba kliknięcia domyślnego selektora: ...
    ```
  - Użyj „Pokaż Zapisane Makro”, aby zweryfikować zapisane dane.
  - Nagraj nowe makro za pomocą „Nagraj NOWE Makro Kliknięcia”.

- **Tytuł streamu to `Stream (<videoId>)`**:
  - Sprawdź konsolę na stronie `/watch`:
    ```
    [YT XP Tracker] Nie znaleziono elementu tytułu (próba 3/3).
    ```
  - Użyj opcji „Ręcznie zapisz metadane streamu” z menu skryptu.
  - Zgłoś problem w [sekcji Issues](https://github.com/[TwojaNazwaUzytkownika]/youtube-live-xp-tracker/issues), podając selektor CSS tytułu wideo (prawy klik → Inspect).

- **Dashboard nie pokazuje streamu**:
  - Sprawdź `localStorage` w konsoli:
    ```javascript
    Object.keys(localStorage).filter(k => /^yt_xp_tracker_/.test(k)).forEach(k => console.log(k, JSON.parse(localStorage.getItem(k))));
    ```
  - Jeśli klucz istnieje, ale stream nie jest widoczny, sprawdź konsolę dashboardu:
    ```
    [YT XP Tracker] Błąd parsowania danych dla klucza yt_xp_tracker_<videoId>: ...
    ```
  - Użyj „Wyczyść wszystkie dane streamów” i odwiedź ponownie stronę `/watch`.

- **Dashboard nie otwiera się**:
  - Upewnij się, że pop-upy są odblokowane dla `youtube.com`.
  - Spróbuj opcji „Pobierz Dashboard jako HTML” i otwórz plik lokalnie.

## Przykład logów konsoli
- **Zapis makra**:
