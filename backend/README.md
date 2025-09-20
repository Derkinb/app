
# Backend (Express + SQLite + JWT + Roles + PDF + Google Drive)

## Quick start
```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
# API on http://localhost:4000
```

## Roles
`role` in users: `admin` | `driver`. Register the first admin by posting `{ email, password, role: "admin" }` to `/auth/register`.

## Admin Endpoints
- `GET /admin/vehicles`
- `POST /admin/vehicles` `{ registration, model }`
- `GET /admin/trailers`
- `POST /admin/trailers` `{ number }`
- `GET /admin/assignments`
- `POST /admin/assignments` `{ user_id, vehicle_id, trailer_id?, active? }`
- `GET /admin/checklist-templates`
- `POST /admin/checklist-templates` `{ name, items: string[] }`

## Driver Endpoints
- `GET /driver/daily`
- `POST /driver/submit` `{ template_id, answers: [{label, checked, note?}], date? }`

## Google Drive Workspace
- Create a Service Account, enable Drive API. (For Workspace, consider domain-wide delegation.)
- In `.env`:
```
GOOGLE_SERVICE_ACCOUNT_JSON=... # json or path
DRIVE_PARENT_FOLDER_ID=...      # workspace folder ID
```
- When adding a vehicle, a folder is created under `DRIVE_PARENT_FOLDER_ID`.
- Submissions generate a PDF and upload it into the vehicle's folder (timestamped filename).
