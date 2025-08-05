// ==UserScript==
// @name         YouTube Live Leaderboard XP Tracker
// @namespace    https://openai.com/
// @version      12.16
// @description  NAPRAWIONA WERSJA: Poprawia kodowanie polskich znaków, ogranicza otwieranie dashboardu do jednej strony, zastępuje prompt usuwania streamów estetycznym oknem dialogowym, zachowuje autoclick, auto-odświeżanie dashboardu, autorefresh czatu co 3s, odświeżanie strony co 2 minuty.
// @match        *://*.youtube.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    const MACRO_STORAGE_KEY = 'yt_xp_tracker_macro_v2';

    // --- Router ---
    if (window.location.pathname.includes('/watch')) handleWatchPage();
    else if (window.location.pathname.includes('/live_chat')) handleLiveChatPage();

    // --- Logika dla /watch ---
    function handleWatchPage() {
        const videoId = new URLSearchParams(window.location.search).get('v');
        if (!videoId) {
            console.warn('[YT XP Tracker] Brak ID wideo w URL.');
            return;
        }
        console.log(`[YT XP Tracker] v12.16 Wykryto stronę /watch dla videoId: ${videoId}`);

        let attempts = 0;
        const maxAttempts = 3;
        const tryGetTitle = () => {
            attempts++;
            const titleElement = document.querySelector('h1.ytd-watch-metadata #title, h1.title.ytd-video-primary-info-renderer, yt-formatted-string[slot="title"], .title.ytd-video-primary-info-renderer');
            if (titleElement) {
                const title = titleElement.textContent.trim() || `Stream (${videoId})`;
                console.log(`[YT XP Tracker] Znaleziono tytuł: ${title}`);
                saveStreamMetadata({ videoId, title, url: window.location.href });
                return true;
            } else {
                console.warn(`[YT XP Tracker] Nie znaleziono elementu tytułu (próba ${attempts}/${maxAttempts}).`);
                if (attempts >= maxAttempts) {
                    console.warn(`[YT XP Tracker] Osiągnięto maksymalną liczbę prób. Zapisuję domyślne metadane dla ${videoId}.`);
                    saveStreamMetadata({ videoId, title: `Stream (${videoId})`, url: window.location.href });
                    return true;
                }
                return false;
            }
        };

        const observer = new MutationObserver(() => {
            if (tryGetTitle()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            if (!localStorage.getItem(`yt_xp_tracker_${videoId}`)) {
                console.warn(`[YT XP Tracker] Tytuł nie znaleziony po 15s, zapisuję domyślne metadane dla ${videoId}`);
                saveStreamMetadata({ videoId, title: `Stream (${videoId})`, url: window.location.href });
                observer.disconnect();
            }
        }, 15000); // 15 sekund timeout

        GM_registerMenuCommand("➡️ Otwórz Pop-out Czat & Tracker", () => GM_openInTab(`https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`, { active: true }));
        GM_registerMenuCommand("📝 Ręcznie zapisz metadane streamu", () => {
            const titleElement = document.querySelector('h1.ytd-watch-metadata #title, h1.title.ytd-video-primary-info-renderer, yt-formatted-string[slot="title"], .title.ytd-video-primary-info-renderer');
            const title = titleElement ? titleElement.textContent.trim() : `Stream (${videoId})`;
            saveStreamMetadata({ videoId, title, url: window.location.href });
            alert(`Metadane dla streamu ${videoId} zostały zapisane.`);
        });
    }

    // --- Logika dla /live_chat ---
    function handleLiveChatPage() {
        const videoId = new URLSearchParams(location.search).get("v");
        if (!videoId) {
            console.warn('[YT XP Tracker] Brak ID wideo w URL czatu.');
            return;
        }
        const STORAGE_KEY = `yt_xp_tracker_${videoId}`;
        let isReplayInProgress = false;

        console.log(`[YT XP Tracker] Aktywny dla czatu: ${videoId}.`);
        ensureMetadataExists(videoId);
        isReplayInProgress = true;
        replayMacro().finally(() => { isReplayInProgress = false; });

        setInterval(() => {
            const iframe = document.querySelector('iframe.style-scope.ytd-live-chat-frame');
            const frameDoc = iframe ? iframe.contentDocument : document;
            if (isPanelOpen(frameDoc)) {
                isReplayInProgress = false;
                const data = getLeaderboardData(frameDoc);
                if (data.length > 0) {
                    console.log(`[YT XP Tracker] Zebrano dane leaderboardu: ${data.length} wpisów.`);
                    saveXpData(STORAGE_KEY, data);
                }
            } else if (!isReplayInProgress) {
                isReplayInProgress = true;
                replayMacro().finally(() => { isReplayInProgress = false; });
            }
        }, 3000); // Zbieranie danych co 3 sekundy

        // Odświeżanie strony co 2 minuty
        console.log(`[YT XP Tracker] Zaplanowano odświeżanie strony dla videoId: ${videoId} co 2 minuty.`);
        setTimeout(() => {
            console.log(`[YT XP Tracker] Odświeżam stronę dla videoId: ${videoId}`);
            window.location.reload();
        }, 2 * 60 * 1000); // 2 minuty
    }

    // --- System Nagrywania i Odtwarzania Makr ---
    function getCssSelector(el) {
        if (!(el instanceof Element)) return;
        let path = [];
        while (el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
                selector += '#' + el.id;
                path.unshift(selector);
                break;
            } else {
                let sib = el, nth = 1;
                while (sib = sib.previousElementSibling) {
                    if (sib.nodeName.toLowerCase() == selector) nth++;
                }
                if (nth != 1) selector += ":nth-of-type("+nth+")";
            }
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(" > ");
    }

    function startMacroRecording() {
        alert("TRYB NAGRYWANIA: Kliknij DOKŁADNIE RAZ przycisk otwierający leaderboard (np. 'Top Fans').");
        localStorage.removeItem(MACRO_STORAGE_KEY);
        const banner = document.createElement('div');
        banner.id = 'recording-banner';
        banner.textContent = '🔴 NAGRYWANIE AKTYWNE...';
        GM_addStyle('#recording-banner { position: fixed; bottom: 0; left: 0; width: 100%; background: red; color: white; text-align: center; font-size: 1.5em; z-index: 9999; padding: 10px; }');
        document.body.appendChild(banner);
        const iframe = document.querySelector('iframe.style-scope.ytd-live-chat-frame');
        const docToListen = iframe ? iframe.contentDocument : document;
        const clickListener = (event) => {
            event.preventDefault();
            event.stopPropagation();
            let target = event.target;
            const recordedHierarchy = [];
            for (let i = 0; i < 8; i++) {
                if (!target) break;
                recordedHierarchy.push({ selector: getCssSelector(target), tag: target.tagName, text: (target.textContent || "").trim().substring(0, 50) });
                target = target.parentElement;
            }
            localStorage.setItem(MACRO_STORAGE_KEY, JSON.stringify(recordedHierarchy));
            alert(`✅ Makro nagrane! Odśwież stronę, aby rozpocząć automatyzację.`);
            console.log("--- ZAPISANE MAKRO ---", JSON.parse(JSON.stringify(recordedHierarchy)));
            banner.remove();
            docToListen.body.removeEventListener('click', clickListener, true);
        };
        docToListen.body.addEventListener('click', clickListener, true);
    }

    async function replayMacro() {
        const macroJson = localStorage.getItem(MACRO_STORAGE_KEY);
        const defaultSelectors = [
            '#viewer-leaderboard-entry-point button',
            'button[aria-label*="leaderboard" i]',
            'button[aria-label*="top fans" i]',
            'yt-icon-button[aria-label*="top fans" i]',
            'yt-icon-button[aria-label*="Top Fans" i]',
            'button.yt-icon-button',
            'yt-icon-button',
            'button[role="button"]',
            'div#menu-container button'
        ];

        if (!macroJson) {
            console.warn('[YT XP Tracker] Brak nagranego makra. Próbuję domyślnych selektorów...');
            return tryDefaultSelectors();
        }

        console.log('[YT XP Tracker] Uruchamiam odtwarzanie nagranego makra...');
        let hierarchy;
        try {
            hierarchy = JSON.parse(macroJson);
        } catch (error) {
            console.error('[YT XP Tracker] Błąd parsowania makra:', error, 'Dane:', macroJson);
            console.warn('[YT XP Tracker] Makro uszkodzone. Próbuję domyślnych selektorów...');
            return tryDefaultSelectors();
        }

        const getIframeDoc = () => new Promise(resolve => {
            let retries = 150, interval = setInterval(() => {
                const iframe = document.querySelector('iframe.style-scope.ytd-live-chat-frame');
                if ((iframe && iframe.contentDocument) || retries-- <= 0) {
                    clearInterval(interval);
                    resolve(iframe ? iframe.contentDocument : document);
                }
            }, 200);
        });

        const frameDoc = await getIframeDoc();
        const docContext = frameDoc || document;

        for (let i = 0; i < hierarchy.length; i++) {
            const target = hierarchy[i];
            console.log(`[YT XP Tracker] Próba kliknięcia Poziom ${i}: <${target.tag}> Selector: ${target.selector}`);
            const element = docContext.querySelector(target.selector);
            if (element) {
                console.log(`[YT XP Tracker] Znaleziono element: ${target.selector}`);
                element.click();
                await new Promise(r => setTimeout(r, 4000));
                if (isPanelOpen(docContext)) {
                    console.log("[YT XP Tracker] SUKCES! Panel leaderboardu jest teraz widoczny.");
                    return;
                }
            } else {
                console.warn(`[YT XP Tracker] Nie znaleziono elementu dla selektora: ${target.selector}`);
            }
        }
        console.error("[YT XP Tracker] Nie udało się otworzyć panelu po przetestowaniu makra. Próbuję domyślnych selektorów...");
        return tryDefaultSelectors();

        async function tryDefaultSelectors() {
            for (const selector of defaultSelectors) {
                const element = docContext.querySelector(selector);
                if (element) {
                    console.log(`[YT XP Tracker] Próba kliknięcia domyślnego selektora: ${selector}`);
                    element.click();
                    await new Promise(r => setTimeout(r, 4000));
                    if (isPanelOpen(docContext)) {
                        console.log("[YT XP Tracker] SUKCES! Panel leaderboardu otwarty domyślnym selektorem.");
                        return;
                    }
                }
            }
            console.error("[YT XP Tracker] Nie udało się otworzyć panelu domyślnymi selektorami. Nagraj nowe makro.");
        }
    }

    const isPanelOpen = (doc) => doc && doc.querySelector("ytd-engagement-panel-section-list-renderer[visibility='ENGAGEMENT_PANEL_VISIBILITY_EXPANDED']");

    function showRecordedMacro() {
        const macro = localStorage.getItem(MACRO_STORAGE_KEY);
        if (macro) {
            console.log("--- ZAPISANE MAKRO ---", JSON.parse(macro));
            alert("Zapisane makro zostało wyświetlone w konsoli deweloperskiej (F12).");
        } else {
            alert("Brak zapisanego makra.");
        }
    }

    // --- Nowa funkcja: Estetyczne usuwanie danych streamów ---
    GM_registerMenuCommand("🗑️ Usuń dane streamów", () => {
        const streamKeys = Object.keys(localStorage).filter(k => /^yt_xp_tracker_[\w-]{11}$/.test(k));
        const streams = streamKeys.map(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                return {
                    key,
                    videoId: data.videoId,
                    title: data.title && data.title !== `Stream (${data.videoId})` ? data.title : `${data.title} (ID: ${data.videoId})`
                };
            } catch (error) {
                console.error(`[YT XP Tracker] Błąd parsowania danych dla klucza ${key}:`, error);
                return null;
            }
        }).filter(s => s).sort((a, b) => a.title.localeCompare(b.title));

        if (streams.length === 0) {
            alert("Brak zapisanych streamów do usunięcia.");
            return;
        }

        // Tworzenie okna dialogowego
        const dialog = document.createElement('div');
        dialog.id = 'stream-delete-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h2>Usuń dane streamów</h2>
                <p>Wybierz stream do usunięcia:</p>
                <ul class="stream-list">
                    ${streams.map(s => `
                        <li>
                            <span>${s.title}</span>
                            <button onclick="confirmDelete('${s.key}', '${s.title.replace(/'/g, "\\'")}')">Usuń</button>
                        </li>
                    `).join('')}
                </ul>
                <button onclick="document.getElementById('stream-delete-dialog').remove()">Zamknij</button>
            </div>
        `;
        document.body.appendChild(dialog);

        // Stylizacja okna dialogowego
        GM_addStyle(`
            #stream-delete-dialog {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #222;
                color: #eee;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                z-index: 10000;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                font-family: 'Segoe UI', sans-serif;
            }
            #stream-delete-dialog .dialog-content {
                padding: 20px;
            }
            #stream-delete-dialog h2 {
                margin: 0 0 10px;
                font-weight: 300;
                border-bottom: 1px solid #444;
                padding-bottom: 10px;
            }
            #stream-delete-dialog .stream-list {
                list-style: none;
                padding: 0;
                margin: 0 0 20px;
                max-height: 50vh;
                overflow-y: auto;
            }
            #stream-delete-dialog .stream-list li {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                border-bottom: 1px solid #444;
            }
            #stream-delete-dialog .stream-list li span {
                flex-grow: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-right: 10px;
            }
            #stream-delete-dialog button {
                background: #4a4a4a;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 5px;
                cursor: pointer;
                transition: background 0.2s;
            }
            #stream-delete-dialog button:hover {
                background: #666;
            }
        `);

        // Funkcja potwierdzania usunięcia
        window.confirmDelete = (key, title) => {
            const confirmDialog = document.createElement('div');
            confirmDialog.id = 'confirm-delete-dialog';
            confirmDialog.innerHTML = `
                <div class="dialog-content">
                    <h2>Potwierdź usunięcie</h2>
                    <p>Czy na pewno usunąć dane dla streama: ${title}?</p>
                    <button onclick="deleteStream('${key}'); document.getElementById('confirm-delete-dialog').remove(); document.getElementById('stream-delete-dialog').remove()">Usuń</button>
                    <button onclick="document.getElementById('confirm-delete-dialog').remove()">Anuluj</button>
                </div>
            `;
            document.body.appendChild(confirmDialog);
        };

        // Funkcja usuwania streamu
        window.deleteStream = (key) => {
            localStorage.removeItem(key);
            alert(`Dane dla streama zostały usunięte.`);
            console.log(`[YT XP Tracker] Usunięto dane dla klucza: ${key}`);
        };
    });

    // --- Globalne komendy menu ---
    GM_registerMenuCommand("🗂️ Otwórz Przeglądarkę Danych", () => {
        try {
            openDashboardViewer();
        } catch (error) {
            console.error("[YT XP Tracker] Błąd podczas otwierania przeglądarki danych:", error);
            alert("Wystąpił błąd podczas otwierania przeglądarki danych. Sprawdź konsolę (F12).");
        }
    });

    GM_registerMenuCommand("📥 Pobierz Dashboard jako HTML", () => {
        try {
            downloadDashboardAsHtml();
        } catch (error) {
            console.error("[YT XP Tracker] Błąd podczas pobierania dashboardu jako HTML:", error);
            alert("Wystąpił błąd podczas pobierania dashboardu. Sprawdź konsolę (F12).");
        }
    });

    GM_registerMenuCommand("🧹 Wyczyść dane bieżącego streama", () => {
        const videoId = new URLSearchParams(window.location.search).get('v');
        if (!videoId) { alert("Nie można zidentyfikować ID streama."); return; }
        const key = `yt_xp_tracker_${videoId}`;
        if (confirm(`Na pewno usunąć wszystkie dane XP dla streama: ${videoId}?`)) {
            localStorage.removeItem(key);
            alert("Dane wyczyszczone.");
        }
    });

    GM_registerMenuCommand("🧹 Wyczyść wszystkie dane streamów", () => {
        if (confirm("Na pewno usunąć WSZYSTKIE dane streamów? Tej operacji nie można cofnąć.")) {
            Object.keys(localStorage).filter(k => /^yt_xp_tracker_/.test(k)).forEach(k => localStorage.removeItem(k));
            alert("Wszystkie dane streamów zostały wyczyszczone.");
        }
    });

    // --- Logika metadanych i zapisu ---
    async function ensureMetadataExists(videoId) {
        const key = `yt_xp_tracker_${videoId}`;
        let data = {};
        try {
            const storedData = localStorage.getItem(key);
            if (storedData) {
                data = JSON.parse(storedData);
                console.log(`[YT XP Tracker] Wczytano istniejące metadane dla klucza ${key}:`, data);
                if (data.videoId && data.title && data.title !== `Stream (${videoId})`) return; // Metadane poprawne
            }
        } catch (error) {
            console.error(`[YT XP Tracker] Błąd parsowania danych dla klucza ${key}:`, error, `Dane:`, localStorage.getItem(key));
            console.warn(`[YT XP Tracker] Usuwam uszkodzony klucz ${key}.`);
            localStorage.removeItem(key);
            data = {};
        }
        console.log(`[YT XP Tracker] Brak poprawnych metadanych dla ${videoId}, zapisuję domyślne.`);
        saveStreamMetadata({ videoId, title: `Stream (${videoId})`, url: `https://www.youtube.com/watch?v=${videoId}` });
    }

    function saveStreamMetadata({ videoId, title, url }) {
        const key = `yt_xp_tracker_${videoId}`;
        let data = { videoId, title, url, history: [] };
        try {
            const storedData = localStorage.getItem(key);
            if (storedData) {
                data = JSON.parse(storedData);
                data.videoId = videoId;
                data.title = title || data.title || `Stream (${videoId})`;
                data.url = url || data.url || `https://www.youtube.com/watch?v=${videoId}`;
                if (!data.history) data.history = [];
                console.log(`[YT XP Tracker] Aktualizuję istniejące metadane dla klucza ${key}:`, data);
            }
        } catch (error) {
            console.error(`[YT XP Tracker] Błąd parsowania danych przy zapisie metadanych dla klucza ${key}:`, error, `Dane:`, localStorage.getItem(key));
            console.warn(`[YT XP Tracker] Usuwam uszkodzony klucz ${key} i zapisuję nowe metadane.`);
            localStorage.removeItem(key);
        }
        try {
            localStorage.setItem(key, JSON.stringify(data));
            console.log(`[YT XP Tracker] Zapisano metadane dla klucza ${key}:`, data);
        } catch (error) {
            console.error(`[YT XP Tracker] Błąd zapisu metadanych dla klucza ${key}:`, error);
        }
    }

    function saveXpData(storageKey, newXpData) {
        const now = new Date().toISOString();
        let data = {};
        try {
            const storedData = localStorage.getItem(storageKey);
            if (storedData) data = JSON.parse(storedData);
        } catch (error) {
            console.error(`[YT XP Tracker] Błąd parsowania danych przy zapisie XP dla klucza ${storageKey}:`, error, `Dane:`, localStorage.getItem(storageKey));
            console.warn(`[YT XP Tracker] Usuwam uszkodzony klucz ${storageKey}.`);
            localStorage.removeItem(storageKey);
        }
        if (!data.history) data.history = [];
        const lastEntryData = data.history.length > 0 ? JSON.stringify(data.history[data.history.length - 1].data) : null;
        if (JSON.stringify(newXpData) === lastEntryData) {
            console.log(`[YT XP Tracker] Dane XP dla ${storageKey} nie zmieniły się, pomijam zapis.`);
            return;
        }
        data.history.push({ timestamp: now, data: newXpData });
        try {
            localStorage.setItem(storageKey, JSON.stringify(data));
            console.log(`[YT XP Tracker] Zapisano dane XP dla klucza ${storageKey}:`, data.history[data.history.length - 1]);
        } catch (error) {
            console.error(`[YT XP Tracker] Błąd zapisu danych XP dla klucza ${storageKey}:`, error);
        }
    }

    function getLeaderboardData(doc = document) {
        const items = Array.from(doc.querySelectorAll('ytvl-live-leaderboard-item-view-model')).map(item => {
            const nameEl = item.querySelector('.ytvlLiveLeaderboardItemChannelContentViewModelChannelName');
            const xpEl = item.querySelector('.ytvlLiveLeaderboardItemViewModelPoints');
            return { name: nameEl ? nameEl.textContent.trim() : 'Brak', xp: xpEl ? parseInt(xpEl.textContent.trim().replace(/\D/g, '')) : 0 };
        }).filter(d => d.name !== 'Brak');
        console.log(`[YT XP Tracker] Zebrano ${items.length} wpisów z leaderboardu.`);
        return items;
    }

    // --- Przeglądarka Danych (Blob i HTML) ---
    function openDashboardViewer() {
        const streamKeys = Object.keys(localStorage).filter(k => /^yt_xp_tracker_[\w-]{11}$/.test(k));
        console.log("[YT XP Tracker] Znalezione klucze streamów:", streamKeys);
        const streams = [];
        for (const key of streamKeys) {
            try {
                const storedData = localStorage.getItem(key);
                if (!storedData) {
                    console.warn(`[YT XP Tracker] Klucz ${key} jest pusty.`);
                    continue;
                }
                const data = JSON.parse(storedData);
                if (!data.videoId) {
                    console.warn(`[YT XP Tracker] Brak videoId w danych dla klucza ${key}:`, data);
                    continue;
                }
                const title = data.title && data.title !== `Stream (${data.videoId})` ? data.title : `${data.title} (ID: ${data.videoId})`;
                streams.push({ key, title, videoId: data.videoId });
            } catch (error) {
                console.error(`[YT XP Tracker] Błąd parsowania danych dla klucza ${key}:`, error, `Dane:`, localStorage.getItem(key));
                console.warn(`[YT XP Tracker] Usuwam uszkodzony klucz ${key}.`);
                localStorage.removeItem(key);
            }
        }
        streams.sort((a, b) => a.title.localeCompare(b.title));
        console.log("[YT XP Tracker] Przetworzone streamy:", streams);

        if (streams.length === 0) {
            const blob = new Blob([String.raw`<h1>Brak danych streamów</h1><p>Nie znaleziono żadnych zapisanych danych streamów w localStorage. Upewnij się, że skrypt zebrał dane podczas działania czatu.</p>`], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const win = window.open(url);
            if (!win) {
                console.warn("[YT XP Tracker] Nie udało się otworzyć karty. Upewnij się, że pop-upy nie są blokowane.");
                alert("Nie udało się otworzyć dashboardu. Spróbuj pobrać plik HTML z opcji 'Pobierz Dashboard jako HTML'.");
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            return;
        }

        const viewerHTML = String.raw`
            <!DOCTYPE html><html lang="pl">
            <head>
                <meta charset="UTF-8">
                <title>Przeglądarka Danych XP</title>
                <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; background: #181818; color: #eee; margin: 0; display: flex; flex-direction: column; height: 100vh; }
                    header { background: #2a2a2a; padding: 1em 2em; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 1em; z-index: 10; }
                    #dashboardContent { flex-grow: 1; padding: 2em; overflow-y: auto; }
                    .placeholder { text-align: center; color: #777; font-size: 1.5em; margin-top: 10vh; }
                    h1, h2, h3 { font-weight: 300; border-bottom: 1px solid #444; padding-bottom: 10px; margin-top: 40px; }
                    h1 small { font-size: 0.5em; color: #999; margin-left: 1em; }
                    .main-container { display: flex; flex-direction: column; gap: 2em; }
                    .chart-wrapper { background: #222; padding: 1.5em; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
                    .controls { margin-bottom: 1em; padding: 1em; background: #2a2a2a; border-radius: 6px; }
                    .user-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; max-height: 200px; overflow-y: auto; }
                    .user-list label { display: flex; align-items: center; gap: 6px; font-size: 14px; white-space: nowrap; cursor: pointer; overflow: hidden; }
                    .color-swatch { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
                    .scale-controls { display: flex; align-items: center; gap: 10px; margin-top: 1em; flex-wrap: wrap; }
                    table { width: 100%; border-collapse: collapse; font-size: 14px; }
                    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #444; }
                    .canvas-container { position: relative; height: 60vh; width: 100%; }
                    .analysis-section { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 2em; margin-top: 2em; }
                    button { background: #4a4a4a; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; transition: background 0.2s; margin-top: 1em; }
                    button:hover { background: #666; }
                    .info-message { background: #333; padding: 1em; margin-bottom: 1em; border-radius: 6px; font-size: 14px; }
                </style>
            </head>
            <body>
                <header>
                    <label for="streamSelector">Wybierz zapisany stream:</label>
                    <select id="streamSelector">
                        <option value="">-- Wybierz --</option>
                        ${streams.map(s => `<option value="${s.key}">${s.title}</option>`).join('')}
                    </select>
                </header>
                <main id="dashboardContent">
                    <div class="info-message">Uwaga: Dashboard jest wyświetlany pod tymczasowym adresem URL. Aby zapisać dashboard, użyj opcji „Pobierz Dashboard jako HTML” w skrypcie.</div>
                    <div class="placeholder">Wybierz stream z listy powyżej...</div>
                </main>
                <script>
                    try {
                        document.getElementById('streamSelector').addEventListener('change', (event) => {
                            const selectedKey = event.target.value;
                            if (selectedKey) {
                                let streamData;
                                try {
                                    streamData = JSON.parse(localStorage.getItem(selectedKey));
                                    console.log("[Dashboard] Wczytano dane dla klucza:", selectedKey, streamData);
                                } catch (error) {
                                    console.error("[Dashboard] Błąd parsowania danych dla klucza:", selectedKey, error, "Dane:", localStorage.getItem(selectedKey));
                                    document.getElementById('dashboardContent').innerHTML = '<div class="placeholder">Błąd wczytywania danych streamu. Sprawdź konsolę (F12).</div>';
                                    return;
                                }
                                renderDashboard(streamData, selectedKey);
                            } else {
                                document.getElementById('dashboardContent').innerHTML = '<div class="info-message">Uwaga: Dashboard jest wyświetlany pod tymczasowym adresem URL. Aby zapisać dashboard, użyj opcji „Pobierz Dashboard jako HTML” w skrypcie.</div><div class="placeholder">Wybierz stream z listy...</div>';
                            }
                        });

                        function renderDashboard(streamData, streamKey) {
                            const { title, history } = streamData;
                            if (!history || history.length === 0) {
                                document.getElementById('dashboardContent').innerHTML = \`
                                    <div class="info-message">Uwaga: Dashboard jest wyświetlany pod tymczasowym adresem URL. Aby zapisać dashboard, użyj opcji „Pobierz Dashboard jako HTML” w skrypcie.</div>
                                    <div class="placeholder">Brak danych XP dla streamu: \${title}</div>
                                \`;
                                return;
                            }

                            const colorMap = new Map();
                            let lineChart, pieChart;
                            let topUsers = [];

                            const _aggregateChangesPerUser = (h) => {
                                if (!h || h.length === 0) return [];
                                const users = new Map();
                                h.forEach(e => e.data.forEach(({ name, xp }) => {
                                    if (!users.has(name)) users.set(name, []);
                                    users.get(name).push({ timestamp: e.timestamp, xp });
                                }));
                                return Array.from(users.entries()).map(([name, entries]) => {
                                    entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                                    const first = entries[0];
                                    const last = entries[entries.length - 1];
                                    let maxJump = 0;
                                    if (entries.length > 1) {
                                        for (let i = 1; i < entries.length; i++) {
                                            const jump = entries[i].xp - entries[i - 1].xp;
                                            if (jump > maxJump) maxJump = jump;
                                        }
                                    }
                                    return { name, start: first.xp, end: last.xp, delta: maxJump, timeline: entries };
                                }).sort((a, b) => b.end - a.end);
                            };

                            function updateDashboard() {
                                try {
                                    let fullData;
                                    try {
                                        fullData = JSON.parse(localStorage.getItem(streamKey) || '{}');
                                    } catch (error) {
                                        console.error("[Dashboard] Błąd parsowania danych podczas aktualizacji dla klucza:", streamKey, error, "Dane:", localStorage.getItem(streamKey));
                                        return;
                                    }
                                    const history = fullData.history || [];
                                    if (history.length === 0) return;

                                    const summary = _aggregateChangesPerUser(history);
                                    topUsers = summary.slice(0, 50);
                                    topUsers.forEach(user => {
                                        if (!colorMap.has(user.name)) {
                                            colorMap.set(user.name, '#' + (Math.random().toString(16) + '000000').substring(2, 8));
                                        }
                                    });

                                    const newDatasets = topUsers.map(user => ({
                                        label: user.name,
                                        data: user.timeline.map(p => ({ x: p.timestamp, y: p.xp })),
                                        fill: false,
                                        borderColor: colorMap.get(user.name),
                                        borderWidth: 2,
                                        tension: 0.1
                                    }));

                                    const userList = document.querySelector('.user-list');
                                    if (userList) {
                                        userList.innerHTML = topUsers.map((u, i) => \`
                                            <label title="\${u.name}">
                                                <input type='checkbox' checked onchange='toggleUser(\${i})'>
                                                <span class="color-swatch" style="background-color: \${colorMap.get(u.name)};"></span>
                                                <span>\${u.name}</span>
                                            </label>
                                        \`).join('');
                                    }

                                    document.getElementById('rankingTableBody').innerHTML = topUsers.map((u, i) => \`
                                        <tr>
                                            <td>\${i + 1}</td>
                                            <td><span class="color-swatch" style="background-color: \${colorMap.get(u.name) || '#ccc'}; display: inline-block; vertical-align: middle; margin-right: 8px;"></span>\${u.name}</td>
                                            <td>\${u.end.toLocaleString()}</td>
                                            <td>\${u.delta > 0 ? '+' : ''}\${u.delta.toLocaleString()}</td>
                                        </tr>
                                    \`).join('');

                                    const topGainers = [...summary].sort((a, b) => b.delta - a.delta).slice(0, 10);
                                    pieChart.data.labels = topGainers.map(u => u.name);
                                    pieChart.data.datasets[0].data = topGainers.map(u => u.delta > 0 ? u.delta : 0);
                                    pieChart.data.datasets[0].backgroundColor = topGainers.map(u => colorMap.get(u.name) || '#cccccc');
                                    pieChart.update('none');

                                    lineChart.data.datasets = newDatasets;
                                    lineChart.update('none');
                                    document.getElementById('lastUpdated').textContent = \`Ostatnia aktualizacja: \${formatTime24h(new Date())}\`;
                                } catch (error) {
                                    console.error("[Dashboard] Błąd podczas aktualizacji dashboardu:", error);
                                }
                            }

                            const summary = _aggregateChangesPerUser(history);
                            topUsers = summary.slice(0, 50);
                            topUsers.forEach(user => colorMap.set(user.name, '#' + (Math.random().toString(16) + '000000').substring(2, 8)));
                            const initialDatasets = topUsers.map(user => ({
                                label: user.name,
                                data: user.timeline.map(p => ({ x: p.timestamp, y: p.xp })),
                                fill: false,
                                borderColor: colorMap.get(user.name),
                                borderWidth: 2,
                                tension: 0.1
                            }));
                            const topGainers = [...summary].sort((a, b) => b.delta - a.delta).slice(0, 10);
                            const allXpValues = topUsers.flatMap(u => u.timeline.map(p => p.xp));
                            const globalMinXP = allXpValues.length > 0 ? Math.floor(Math.min(...allXpValues)) : 0;
                            const globalMaxXP = allXpValues.length > 0 ? Math.ceil(Math.max(...allXpValues)) : 1000;
                            const paddedMinXP = Math.max(0, globalMinXP - 20);
                            const paddedMaxXP = globalMaxXP + 20;

                            let dashboardHTML = \`
                                <div class="info-message">Uwaga: Dashboard jest wyświetlany pod tymczasowym adresem URL. Aby zapisać dashboard, użyj opcji „Pobierz Dashboard jako HTML” w skrypcie.</div>
                                <div class="main-container">
                                    <h1>XP Tracker - \${title} <small id="lastUpdated"></small></h1>
                                    <div class="chart-wrapper">
                                        <div class="controls">
                                            <h3>Filtruj użytkowników (Top \${topUsers.length})</h3>
                                            <div class="user-list">\${topUsers.map((u, i) => \`<label title="\${u.name}"><input type='checkbox' checked onchange='toggleUser(\${i})'><span class="color-swatch" style="background-color: \${colorMap.get(u.name)};"></span><span>\${u.name}</span></label>\`).join('')}</div>
                                            <div class="scale-controls">
                                                <h3>Kontrola osi Y</h3>
                                                <label>Min Y: <input type="number" id="minY" value="\${paddedMinXP}"></label>
                                                <label>Max Y: <input type="number" id="maxY" value="\${paddedMaxXP}"></label>
                                                <button onclick="applyScale()">Zastosuj</button>
                                                <label><input type="checkbox" id="logScaleToggle" onchange="toggleLogScale()"> Skala logarytmiczna</label>
                                            </div>
                                        </div>
                                        <div class="canvas-container"><canvas id="lineChart"></canvas></div>
                                        <button onclick="downloadChartPNG('lineChart', 'line_chart')">📥 Pobierz wykres liniowy (PNG)</button>
                                    </div>
                                    <div class="analysis-section">
                                        <div class="chart-wrapper">
                                            <h2>Ranking Punktowy i Największe Skoki</h2>
                                            <div style="max-height: 400px; overflow-y: auto;">
                                            <table><thead><tr><th>#</th><th>Użytkownik</th><th>Aktualne XP</th><th>Największy Skok</th></tr></thead><tbody id="rankingTableBody"></tbody></table>
                                            </div>
                                            <button onclick="exportToCsv()">📥 Eksportuj ranking do CSV</button>
                                        </div>
                                        <div class="chart-wrapper">
                                            <h2>Udział w Największych Skokach XP (Top 10)</h2>
                                            <canvas id="pieChart"></canvas>
                                            <button onclick="downloadChartPNG('pieChart', 'pie_chart')">📥 Pobierz wykres kołowy (PNG)</button>
                                        </div>
                                    </div>
                                </div>
                            \`;
                            document.getElementById('dashboardContent').innerHTML = dashboardHTML;

                            const formatTime24h = (date) => date.toLocaleTimeString('pl-PL', { hour12: false });

                            function initializeCharts() {
                                try {
                                    const ctxLine = document.getElementById('lineChart').getContext('2d');
                                    lineChart = new Chart(ctxLine, {
                                        type: 'line',
                                        data: { datasets: initialDatasets },
                                        options: {
                                            animation: false,
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            interaction: { intersect: false, mode: 'index' },
                                            plugins: { title: { display: true, text: 'XP w czasie', color: '#eee', font: { size: 18 } }, legend: { display: false } },
                                            scales: {
                                                x: { type: 'time', time: { tooltipFormat: 'dd.MM.yyyy HH:mm:ss', displayFormats: { minute: 'HH:mm', hour: 'HH:mm' } }, ticks: { source: 'data', color: '#ccc', maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 20 } },
                                                y: { type: 'linear', ticks: { color: '#ccc' } }
                                            }
                                        }
                                    });
                                    const ctxPie = document.getElementById('pieChart').getContext('2d');
                                    pieChart = new Chart(ctxPie, {
                                        type: 'pie',
                                        data: {
                                            labels: topGainers.map(u => u.name),
                                            datasets: [{ data: topGainers.map(u => u.delta > 0 ? u.delta : 0), backgroundColor: topGainers.map(u => colorMap.get(u.name) || '#cccccc') }]
                                        },
                                        options: { animation: false, responsive: true, plugins: { legend: { position: 'top', labels: { color: '#eee' } } } }
                                    });
                                    updateDashboard();
                                    setInterval(updateDashboard, 3000); // Auto-odświeżanie co 3 sekundy
                                } catch (error) {
                                    console.error("[Dashboard] Błąd podczas inicjalizacji wykresów:", error);
                                    document.getElementById('dashboardContent').innerHTML = '<div class="placeholder">Błąd podczas ładowania wykresów. Sprawdź konsolę (F12).</div>';
                                }
                            }

                            window.toggleUser = (index) => {
                                lineChart.setDatasetVisibility(index, !lineChart.isDatasetVisible(index));
                                lineChart.update();
                            };
                            window.applyScale = () => {
                                const minVal = document.getElementById('minY').value;
                                const maxVal = document.getElementById('maxY').value;
                                lineChart.options.scales.y.min = minVal !== '' ? parseFloat(minVal) : undefined;
                                lineChart.options.scales.y.max = maxVal !== '' ? parseFloat(maxVal) : undefined;
                                lineChart.update();
                            };
                            window.toggleLogScale = () => {
                                const logCheckbox = document.getElementById('logScaleToggle');
                                lineChart.options.scales.y.type = logCheckbox.checked ? 'logarithmic' : 'linear';
                                applyScale();
                            };
                            window.downloadChartPNG = (canvasId, filenamePrefix) => {
                                const canvas = document.getElementById(canvasId);
                                const a = document.createElement('a');
                                a.href = canvas.toDataURL('image/png', 1.0);
                                a.download = \`\${streamKey.replace('yt_xp_tracker_', '')}_\${filenamePrefix}.png\`;
                                a.click();
                            };
                            window.exportToCsv = () => {
                                const summary = _aggregateChangesPerUser(history);
                                const csvContent = ['Pozycja,Użytkownik,Aktualne XP,Największy Skok', ...summary.map((s, i) => \`\${i + 1},"\${s.name.replace(/"/g, '""')}",\${s.end},\${s.delta}\`)].join('\\n');
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = \`ranking_\${streamKey.replace('yt_xp_tracker_', '')}.csv\`;
                                a.click();
                                URL.revokeObjectURL(a.href);
                            };

                            initializeCharts();
                        }
                    } catch (error) {
                        console.error("[Dashboard] Błąd w skrypcie dashboardu:", error);
                        document.getElementById('dashboardContent').innerHTML = '<div class="placeholder">Błąd w skrypcie dashboardu. Sprawdź konsolę (F12).</div>';
                    }
                </script>
            </body>
            </html>
        `;
        try {
            const blob = new Blob([viewerHTML], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const existingWindow = window.open('', 'xp_tracker_dashboard');
            if (existingWindow && !existingWindow.closed) {
                existingWindow.location.href = url;
            } else {
                window.open(url, 'xp_tracker_dashboard');
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            console.error("[YT XP Tracker] Błąd podczas otwierania dashboardu jako Blob:", error);
            alert("Wystąpił błąd podczas otwierania dashboardu. Spróbuj pobrać plik HTML z opcji 'Pobierz Dashboard jako HTML'.");
        }
    }

    function downloadDashboardAsHtml() {
        const streamKeys = Object.keys(localStorage).filter(k => /^yt_xp_tracker_[\w-]{11}$/.test(k));
        console.log("[YT XP Tracker] Znalezione klucze streamów (pobieranie):", streamKeys);
        const streams = [];
        for (const key of streamKeys) {
            try {
                const storedData = localStorage.getItem(key);
                if (!storedData) {
                    console.warn(`[YT XP Tracker] Klucz ${key} jest pusty.`);
                    continue;
                }
                const data = JSON.parse(storedData);
                if (!data.videoId) {
                    console.warn(`[YT XP Tracker] Brak videoId w danych dla klucza ${key}:`, data);
                    continue;
                }
                const title = data.title && data.title !== `Stream (${data.videoId})` ? data.title : `${data.title} (ID: ${data.videoId})`;
                streams.push({ key, title, videoId: data.videoId });
            } catch (error) {
                console.error(`[YT XP Tracker] Błąd parsowania danych dla klucza ${key}:`, error, `Dane:`, localStorage.getItem(key));
                console.warn(`[YT XP Tracker] Usuwam uszkodzony klucz ${key}.`);
                localStorage.removeItem(key);
            }
        }
        streams.sort((a, b) => a.title.localeCompare(b.title));
        console.log("[YT XP Tracker] Przetworzone streamy (pobieranie):", streams);

        if (streams.length === 0) {
            alert("Brak danych streamów do zapisania.");
            return;
        }

        const viewerHTML = String.raw`
            <!DOCTYPE html><html lang="pl">
            <head>
                <meta charset="UTF-8">
                <title>Przeglądarka Danych XP</title>
                <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; background: #181818; color: #eee; margin: 0; display: flex; flex-direction: column; height: 100vh; }
                    header { background: #2a2a2a; padding: 1em 2em; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 1em; z-index: 10; }
                    #dashboardContent { flex-grow: 1; padding: 2em; overflow-y: auto; }
                    .placeholder { text-align: center; color: #777; font-size: 1.5em; margin-top: 10vh; }
                    h1, h2, h3 { font-weight: 300; border-bottom: 1px solid #444; padding-bottom: 10px; margin-top: 40px; }
                    h1 small { font-size: 0.5em; color: #999; margin-left: 1em; }
                    .main-container { display: flex; flex-direction: column; gap: 2em; }
                    .chart-wrapper { background: #222; padding: 1.5em; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
                    .controls { margin-bottom: 1em; padding: 1em; background: #2a2a2a; border-radius: 6px; }
                    .user-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; max-height: 200px; overflow-y: auto; }
                    .user-list label { display: flex; align-items: center; gap: 6px; font-size: 14px; white-space: nowrap; cursor: pointer; overflow: hidden; }
                    .color-swatch { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
                    .scale-controls { display: flex; align-items: center; gap: 10px; margin-top: 1em; flex-wrap: wrap; }
                    table { width: 100%; border-collapse: collapse; font-size: 14px; }
                    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #444; }
                    .canvas-container { position: relative; height: 60vh; width: 100%; }
                    .analysis-section { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 2em; margin-top: 2em; }
                    button { background: #4a4a4a; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; transition: background 0.2s; margin-top: 1em; }
                    button:hover { background: #666; }
                </style>
            </head>
            <body>
                <header>
                    <label for="streamSelector">Wybierz zapisany stream:</label>
                    <select id="streamSelector">
                        <option value="">-- Wybierz --</option>
                        ${streams.map(s => `<option value="${s.key}">${s.title}</option>`).join('')}
                    </select>
                </header>
                <main id="dashboardContent"><div class="placeholder">Wybierz stream z listy powyżej...</div></main>
                <script>
                    try {
                        document.getElementById('streamSelector').addEventListener('change', (event) => {
                            const selectedKey = event.target.value;
                            if (selectedKey) {
                                let streamData;
                                try {
                                    streamData = JSON.parse(localStorage.getItem(selectedKey));
                                    console.log("[Dashboard] Wczytano dane dla klucza:", selectedKey, streamData);
                                } catch (error) {
                                    console.error("[Dashboard] Błąd parsowania danych dla klucza:", selectedKey, error, "Dane:", localStorage.getItem(selectedKey));
                                    document.getElementById('dashboardContent').innerHTML = '<div class="placeholder">Błąd wczytywania danych streamu. Sprawdź konsolę (F12).</div>';
                                    return;
                                }
                                renderDashboard(streamData, selectedKey);
                            } else {
                                document.getElementById('dashboardContent').innerHTML = '<div class="placeholder">Wybierz stream z listy...</div>';
                            }
                        });

                        function renderDashboard(streamData, streamKey) {
                            const { title, history } = streamData;
                            if (!history || history.length === 0) {
                                document.getElementById('dashboardContent').innerHTML = \`<div class="placeholder">Brak danych XP dla streamu: \${title}</div>\`;
                                return;
                            }

                            const colorMap = new Map();
                            let lineChart, pieChart;
                            let topUsers = [];

                            const _aggregateChangesPerUser = (h) => {
                                if (!h || h.length === 0) return [];
                                const users = new Map();
                                h.forEach(e => e.data.forEach(({ name, xp }) => {
                                    if (!users.has(name)) users.set(name, []);
                                    users.get(name).push({ timestamp: e.timestamp, xp });
                                }));
                                return Array.from(users.entries()).map(([name, entries]) => {
                                    entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                                    const first = entries[0];
                                    const last = entries[entries.length - 1];
                                    let maxJump = 0;
                                    if (entries.length > 1) {
                                        for (let i = 1; i < entries.length; i++) {
                                            const jump = entries[i].xp - entries[i - 1].xp;
                                            if (jump > maxJump) maxJump = jump;
                                        }
                                    }
                                    return { name, start: first.xp, end: last.xp, delta: maxJump, timeline: entries };
                                }).sort((a, b) => b.end - a.end);
                            };

                            function updateDashboard() {
                                try {
                                    let fullData;
                                    try {
                                        fullData = JSON.parse(localStorage.getItem(streamKey) || '{}');
                                    } catch (error) {
                                        console.error("[Dashboard] Błąd parsowania danych podczas aktualizacji dla klucza:", streamKey, error, "Dane:", localStorage.getItem(streamKey));
                                        return;
                                    }
                                    const history = fullData.history || [];
                                    if (history.length === 0) return;

                                    const summary = _aggregateChangesPerUser(history);
                                    topUsers = summary.slice(0, 50);
                                    topUsers.forEach(user => {
                                        if (!colorMap.has(user.name)) {
                                            colorMap.set(user.name, '#' + (Math.random().toString(16) + '000000').substring(2, 8));
                                        }
                                    });

                                    const newDatasets = topUsers.map(user => ({
                                        label: user.name,
                                        data: user.timeline.map(p => ({ x: p.timestamp, y: p.xp })),
                                        fill: false,
                                        borderColor: colorMap.get(user.name),
                                        borderWidth: 2,
                                        tension: 0.1
                                    }));

                                    const userList = document.querySelector('.user-list');
                                    if (userList) {
                                        userList.innerHTML = topUsers.map((u, i) => \`
                                            <label title="\${u.name}">
                                                <input type='checkbox' checked onchange='toggleUser(\${i})'>
                                                <span class="color-swatch" style="background-color: \${colorMap.get(u.name)};"></span>
                                                <span>\${u.name}</span>
                                            </label>
                                        \`).join('');
                                    }

                                    document.getElementById('rankingTableBody').innerHTML = topUsers.map((u, i) => \`
                                        <tr>
                                            <td>\${i + 1}</td>
                                            <td><span class="color-swatch" style="background-color: \${colorMap.get(u.name) || '#ccc'}; display: inline-block; vertical-align: middle; margin-right: 8px;"></span>\${u.name}</td>
                                            <td>\${u.end.toLocaleString()}</td>
                                            <td>\${u.delta > 0 ? '+' : ''}\${u.delta.toLocaleString()}</td>
                                        </tr>
                                    \`).join('');

                                    const topGainers = [...summary].sort((a, b) => b.delta - a.delta).slice(0, 10);
                                    pieChart.data.labels = topGainers.map(u => u.name);
                                    pieChart.data.datasets[0].data = topGainers.map(u => u.delta > 0 ? u.delta : 0);
                                    pieChart.data.datasets[0].backgroundColor = topGainers.map(u => colorMap.get(u.name) || '#cccccc');
                                    pieChart.update('none');

                                    lineChart.data.datasets = newDatasets;
                                    lineChart.update('none');
                                    document.getElementById('lastUpdated').textContent = \`Ostatnia aktualizacja: \${formatTime24h(new Date())}\`;
                                } catch (error) {
                                    console.error("[Dashboard] Błąd podczas aktualizacji dashboardu:", error);
                                }
                            }

                            const summary = _aggregateChangesPerUser(history);
                            topUsers = summary.slice(0, 50);
                            topUsers.forEach(user => colorMap.set(user.name, '#' + (Math.random().toString(16) + '000000').substring(2, 8)));
                            const initialDatasets = topUsers.map(user => ({
                                label: user.name,
                                data: user.timeline.map(p => ({ x: p.timestamp, y: p.xp })),
                                fill: false,
                                borderColor: colorMap.get(user.name),
                                borderWidth: 2,
                                tension: 0.1
                            }));
                            const topGainers = [...summary].sort((a, b) => b.delta - a.delta).slice(0, 10);
                            const allXpValues = topUsers.flatMap(u => u.timeline.map(p => p.xp));
                            const globalMinXP = allXpValues.length > 0 ? Math.floor(Math.min(...allXpValues)) : 0;
                            const globalMaxXP = allXpValues.length > 0 ? Math.ceil(Math.max(...allXpValues)) : 1000;
                            const paddedMinXP = Math.max(0, globalMinXP - 20);
                            const paddedMaxXP = globalMaxXP + 20;

                            let dashboardHTML = \`
                                <div class="main-container">
                                    <h1>XP Tracker - \${title} <small id="lastUpdated"></small></h1>
                                    <div class="chart-wrapper">
                                        <div class="controls">
                                            <h3>Filtruj użytkowników (Top \${topUsers.length})</h3>
                                            <div class="user-list">\${topUsers.map((u, i) => \`<label title="\${u.name}"><input type='checkbox' checked onchange='toggleUser(\${i})'><span class="color-swatch" style="background-color: \${colorMap.get(u.name)};"></span><span>\${u.name}</span></label>\`).join('')}</div>
                                            <div class="scale-controls">
                                                <h3>Kontrola osi Y</h3>
                                                <label>Min Y: <input type="number" id="minY" value="\${paddedMinXP}"></label>
                                                <label>Max Y: <input type="number" id="maxY" value="\${paddedMaxXP}"></label>
                                                <button onclick="applyScale()">Zastosuj</button>
                                                <label><input type="checkbox" id="logScaleToggle" onchange="toggleLogScale()"> Skala logarytmiczna</label>
                                            </div>
                                        </div>
                                        <div class="canvas-container"><canvas id="lineChart"></canvas></div>
                                        <button onclick="downloadChartPNG('lineChart', 'line_chart')">📥 Pobierz wykres liniowy (PNG)</button>
                                    </div>
                                    <div class="analysis-section">
                                        <div class="chart-wrapper">
                                            <h2>Ranking Punktowy i Największe Skoki</h2>
                                            <div style="max-height: 400px; overflow-y: auto;">
                                            <table><thead><tr><th>#</th><th>Użytkownik</th><th>Aktualne XP</th><th>Największy Skok</th></tr></thead><tbody id="rankingTableBody"></tbody></table>
                                            </div>
                                            <button onclick="exportToCsv()">📥 Eksportuj ranking do CSV</button>
                                        </div>
                                        <div class="chart-wrapper">
                                            <h2>Udział w Największych Skokach XP (Top 10)</h2>
                                            <canvas id="pieChart"></canvas>
                                            <button onclick="downloadChartPNG('pieChart', 'pie_chart')">📥 Pobierz wykres kołowy (PNG)</button>
                                        </div>
                                    </div>
                                </div>
                            \`;
                            document.getElementById('dashboardContent').innerHTML = dashboardHTML;

                            const formatTime24h = (date) => date.toLocaleTimeString('pl-PL', { hour12: false });

                            function initializeCharts() {
                                try {
                                    const ctxLine = document.getElementById('lineChart').getContext('2d');
                                    lineChart = new Chart(ctxLine, {
                                        type: 'line',
                                        data: { datasets: initialDatasets },
                                        options: {
                                            animation: false,
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            interaction: { intersect: false, mode: 'index' },
                                            plugins: { title: { display: true, text: 'XP w czasie', color: '#eee', font: { size: 18 } }, legend: { display: false } },
                                            scales: {
                                                x: { type: 'time', time: { tooltipFormat: 'dd.MM.yyyy HH:mm:ss', displayFormats: { minute: 'HH:mm', hour: 'HH:mm' } }, ticks: { source: 'data', color: '#ccc', maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 20 } },
                                                y: { type: 'linear', ticks: { color: '#ccc' } }
                                            }
                                        }
                                    });
                                    const ctxPie = document.getElementById('pieChart').getContext('2d');
                                    pieChart = new Chart(ctxPie, {
                                        type: 'pie',
                                        data: {
                                            labels: topGainers.map(u => u.name),
                                            datasets: [{ data: topGainers.map(u => u.delta > 0 ? u.delta : 0), backgroundColor: topGainers.map(u => colorMap.get(u.name) || '#cccccc') }]
                                        },
                                        options: { animation: false, responsive: true, plugins: { legend: { position: 'top', labels: { color: '#eee' } } } }
                                    });
                                    updateDashboard();
                                    setInterval(updateDashboard, 3000); // Auto-odświeżanie co 3 sekundy
                                } catch (error) {
                                    console.error("[Dashboard] Błąd podczas inicjalizacji wykresów:", error);
                                    document.getElementById('dashboardContent').innerHTML = '<div class="placeholder">Błąd podczas ładowania wykresów. Sprawdź konsolę (F12).</div>';
                                }
                            }

                            window.toggleUser = (index) => {
                                lineChart.setDatasetVisibility(index, !lineChart.isDatasetVisible(index));
                                lineChart.update();
                            };
                            window.applyScale = () => {
                                const minVal = document.getElementById('minY').value;
                                const maxVal = document.getElementById('maxY').value;
                                lineChart.options.scales.y.min = minVal !== '' ? parseFloat(minVal) : undefined;
                                lineChart.options.scales.y.max = maxVal !== '' ? parseFloat(maxVal) : undefined;
                                lineChart.update();
                            };
                            window.toggleLogScale = () => {
                                const logCheckbox = document.getElementById('logScaleToggle');
                                lineChart.options.scales.y.type = logCheckbox.checked ? 'logarithmic' : 'linear';
                                applyScale();
                            };
                            window.downloadChartPNG = (canvasId, filenamePrefix) => {
                                const canvas = document.getElementById(canvasId);
                                const a = document.createElement('a');
                                a.href = canvas.toDataURL('image/png', 1.0);
                                a.download = \`\${streamKey.replace('yt_xp_tracker_', '')}_\${filenamePrefix}.png\`;
                                a.click();
                            };
                            window.exportToCsv = () => {
                                const summary = _aggregateChangesPerUser(history);
                                const csvContent = ['Pozycja,Użytkownik,Aktualne XP,Największy Skok', ...summary.map((s, i) => \`\${i + 1},"\${s.name.replace(/"/g, '""')}",\${s.end},\${s.delta}\`)].join('\\n');
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = \`ranking_\${streamKey.replace('yt_xp_tracker_', '')}.csv\`;
                                a.click();
                                URL.revokeObjectURL(a.href);
                            };

                            initializeCharts();
                        }
                    } catch (error) {
                        console.error("[Dashboard] Błąd w skrypcie dashboardu:", error);
                        document.getElementById('dashboardContent').innerHTML = '<div class="placeholder">Błąd w skrypcie dashboardu. Sprawdź konsolę (F12).</div>';
                    }
                </script>
            </body>
            </html>
        `;
        try {
            const blob = new Blob([viewerHTML], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `xp_tracker_${streams.length > 0 ? streams[0].videoId : 'xp_tracker'}.html`;
            a.click();
            URL.revokeObjectURL(url);
            alert(`Dashboard został zapisany jako plik HTML: xp_tracker_${streams.length > 0 ? streams[0].videoId : 'xp_tracker'}.html. Otwórz plik w przeglądarce, aby zobaczyć wykresy.`);
        } catch (error) {
            console.error("[YT XP Tracker] Błąd podczas pobierania dashboardu jako HTML:", error);
            alert("Wystąpił błąd podczas zapisywania dashboardu. Sprawdź konsolę (F12).");
        }
    }
})();
