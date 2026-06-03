# TrueNAS Custom App notes

Use the included `docker-compose.yml` as the base for a TrueNAS custom app.

Before starting:

1. Change `POSTGRES_PASSWORD`.
2. Change `DATABASE_URL` so the password matches.
3. Change `JWT_SECRET` to a long random value.
4. Map the web service port to the port you want, for example `8080:80`.
5. Keep the database volume persistent.

Initial trial users:

- Admin: `admin@propmanager.local` / `ChangeMe123!`
- Tenant: `tenant@example.local` / `ChangeMe123!`

Change these passwords after first login once the user management screens are expanded.
