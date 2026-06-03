# PropManager UK PostgreSQL Trial

This version adds a PostgreSQL-backed architecture for a UK landlord trial app.

## Architecture

- React/Vite frontend
- Node/Express backend API
- PostgreSQL database
- Nginx reverse proxy for `/api`
- Docker Compose suitable for TrueNAS Custom App use

## Included features

- Admin and tenant login roles
- Tenant data isolation in the API
- Admin dashboard for all properties, tenants, rent, repairs, documents and expenses
- Tenant portal showing only their property, rent records, documents and repairs
- Manual rent tracking
- Repair ticket creation
- UK-focused compliance document tracking: tenancy agreement, gas safety, EPC, EICR, deposit protection, Right to Rent, smoke/CO alarm and other documents
- Audit log table ready for future edit tracking

## Run locally

```bash
docker compose up --build
```

Open:

```text
http://localhost:8080
```

Trial logins:

```text
admin@propmanager.local / ChangeMe123!
tenant@example.local / ChangeMe123!
```

## Production notes for TrueNAS

Change these before using real tenant data:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_SECRET`
- default user passwords

Do not expose this directly to the internet without HTTPS, strong passwords, backups, and ideally a reverse proxy such as Nginx Proxy Manager, Traefik, or Cloudflare Tunnel.
