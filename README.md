
# CODEX — Fleet Checklist (Android + Web + Backend)

Funkcje:
- Role: **admin** i **driver**
- Admin: dodaje pojazdy (rejestracja, model), dodaje trailery (nr), przypisuje do użytkownika
- Driver: codzienna checklista → PDF → upload na Google Drive Workspace do folderu pojazdu (z datą/godziną)
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

## Google Drive
W `backend/.env` ustaw:
```
GOOGLE_SERVICE_ACCOUNT_JSON=... # JSON lub ścieżka
DRIVE_PARENT_FOLDER_ID=...      # ID folderu nadrzędnego w Workspace
```

## Dalsze kroki
- Dodanie `/admin/users` do przeglądania listy userów
- Historia checklist i podgląd PDF
- Eksport CSV, powiadomienia, podpis kierowcy
