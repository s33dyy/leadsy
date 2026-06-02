# Leadsy Local Data

These folders are the visible local development data stores for Leadsy on this machine.

- `app/`: first-party app store for local auth, owner/client records, lead briefs, lead dossiers, run history, drafts, and agent activity logs.
- `postgres/`: PostgreSQL + pgvector data when Docker Compose is running.
- `redis/`: Redis append-only data when Docker Compose is running.

The app currently uses `data/app` for live local auth and Lead Magnet records. PostgreSQL and Redis are provisioned for the production-shaped architecture and become active when Docker Desktop is running and `npm run docker:up` is used.

Do not commit the generated JSON/database files.
