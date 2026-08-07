# Queueless Kenya

Skip the wait. A smarter way to move through queues across Kenya.

## Start / stop local servers

```bash
./start-servers.sh
./stop-servers.sh
```

- Admin: http://localhost:4000/
- Customer: http://localhost:3000/
- pgAdmin: http://localhost:5050/

## Local admin stack

### 1. Start Postgres + pgAdmin

```bash
docker compose up -d
```

### 2. Start API + admin UI

```bash
cd backend
npm install
npm start
```

- Admin UI: http://localhost:4000/
- API health: http://localhost:4000/health

### 3. Start customer app (separate URL)

```bash
cd customer
npm install
npm start
```

- Customer UI: http://localhost:3000/

### Admin login

| Field | Value |
| --- | --- |
| Username | `admin` |
| Password | `admin123` |

### pgAdmin

| Field | Value |
| --- | --- |
| URL | http://localhost:5050 |
| Email | `admin@queueless.co.ke` |
| Password | `admin123` |

Register the Postgres server in pgAdmin:

| Field | Value |
| --- | --- |
| Host name/address | `db` (inside Docker network) |
| Port | `5432` |
| Maintenance database | `queueless` |
| Username | `queueless` |
| Password | `queueless_dev` |

Postgres is also exposed on the host at `localhost:5434` (mapped away from the local Homebrew Postgres on 5432).

### Customer app

- Customer UI: http://localhost:3000/ (own server — not nested under admin)
- Sign up with first name, phone, PIN, confirm PIN
- OTP is **web-only for now** (`OTP_MODE=web`) and shown in **Admin → Customers**
- After OTP verification, customers log in with **phone + PIN**

Advanta credentials are stored in `backend/.env` for when you switch `OTP_MODE=sms`.
