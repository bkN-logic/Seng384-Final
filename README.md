# Project Bridge

Project Bridge is a lightweight full-stack collaboration site for professionals across disciplines. It includes:

- A polished premium frontend with auth, multiple sections, and three themes:
  - `Neon Pulse`
  - `Earth Canvas`
  - `Citrus Tide`
- A backend API for:
  - login and registration
  - viewing users, projects, and project rooms
  - posting new projects
  - adding friends to a network
  - opening focused project rooms
  - sending room messages
- JSON-backed local data storage

## Run it

There are no npm package dependencies—only Node.js is required for local runs. Use **Node 18+** (the Docker image uses Node 22).

### Local (Node)

From the repo root:

```bash
npm start
```

Equivalent:

```bash
npm run dev
```

The server listens on port **3000** by default. Override if needed (example uses `8080`):

```bash
PORT=8080 npm start
```

Open [http://localhost:3000](http://localhost:3000), or `http://localhost:$PORT` when using a custom port.

### Docker

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2.

**Start** (build image, run in background, map host `3000` → container `3000`):

```bash
npm run docker:up
```

Or explicitly:

```bash
docker compose up --build -d
```

If **port 3000 is already in use** on your machine, set `HOST_PORT` to any free port:

```bash
HOST_PORT=3080 docker compose up --build -d
```

Then open `http://localhost:3080` (or whatever you set).

Data is persisted via a bind mount: the container uses `./data` on your host (same as local `npm start`).

**Logs** (follow `web` service):

```bash
npm run docker:logs
```

**Stop** and remove the stack:

```bash
npm run docker:down
```

**Build image only** (optional):

```bash
npm run docker:build
```

## Project structure

```text
.
├── api/index.js          # Vercel serverless entry
├── data/db.json
├── lib/store.js
├── public/
│   ├── app.js
│   ├── index.html
│   ├── styles.css
│   └── dna-hero.png
├── server.js
├── vercel.json
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
└── package.json
```

## Deploy to Vercel

- The project is now Vercel-ready with:
  - [api/index.js](./api/index.js) as the serverless entry
  - [vercel.json](./vercel.json) routing all requests through the same app handler
- Push the repo to GitHub, import it into Vercel, and deploy with the default settings.

## Notes

- Local development stores data in [data/db.json](./data/db.json).
- On Vercel, data is copied into `/tmp/project-bridge-db.json` at runtime.
- Vercel file storage is temporary, so new accounts, messages, and projects are not permanently persisted between cold starts or redeploys.
- The app is built with Node's built-in modules, so there are no external package dependencies to install.
