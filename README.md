
# CODEX — Fleet Checklist (Android + Web + Backend)

Funkcje:
- Role: **admin** i **driver**
- Admin: dodaje pojazdy (rejestracja, model), dodaje trailery (nr), przypisuje do użytkownika
- Admin może również zakładać konta kierowców, a panel pokazuje listę pojazdów, naczep oraz aktywne przydziały
- Driver: codzienna checklista (walkaround + poranne odczyty: stan licznika, paliwo, AdBlue, poziomy płynów, czystość, uwagi) → PDF → upload na Google Drive Workspace do folderu pojazdu (z datą/godziną)
- Raport PDF zawiera rozbudowany layout z podsumowaniem odczytów, statusów checklisty oraz notatkami kierowcy
- Aplikacja działa na **Android** i **Web** (Expo)

## Start
1) Backend
```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

2) App (Android lub Web)
```bash
cd app
npm install
npx expo prebuild
npm run android  # Android
npm run web      # Web
```

Ustaw API URL w `app/src/config.js` (`10.0.2.2` dla Android emulatora).

> Po uruchomieniu backendu warto wykonać `npm run migrate`, aby upewnić się, że baza zawiera aktualne kolumny (m.in. `metadata_json` dla dodatkowych odczytów porannych).

## Google Drive
W `backend/.env` ustaw:
```
GOOGLE_SERVICE_ACCOUNT_JSON=... # JSON lub ścieżka
DRIVE_PARENT_FOLDER_ID=...      # ID folderu nadrzędnego w Workspace
```

## Dalsze kroki
- Dodanie `/admin/users` do przeglądania listy userów
- Historia checklist i podgląd PDF (frontend ma przycisk „Historia” — backend do wdrożenia)
- Eksport CSV, powiadomienia, podpis kierowcy
