# syntax=docker/dockerfile:1.7
#
# PIX KU CSC — production image.
#
# Three things come out of this file:
#
#   runner    (the default)  the website: Next.js' standalone server, the
#                            public folder and the static assets. No source,
#                            no dev dependencies, runs as a non-root user.
#   migrator                 applies db/migrations to the database and exits.
#                            Run it before every start of a new version; it is
#                            a no-op when nothing has changed.
#
# docker-compose.prod.yml wires both to a Postgres and two volumes. Nothing
# secret is baked into either image: every key and password is passed in when
# the container starts. See DEPLOY.md.

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
# deps — every dependency, dev tools included (the build and drizzle-kit
# need them). Installed on Linux, so sharp brings the Linux binary it will
# actually run with, whatever machine the image is built from.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# builder
# ---------------------------------------------------------------------------
FROM deps AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone \
    STORAGE_ROOT=/data/storage
# The build renders nothing from the database — every page is dynamic — so it
# needs no database, no keys and no public address. Those are runtime settings.
RUN npm run build \
 && cp -r public .next/standalone/public \
 && mkdir -p .next/standalone/.next \
 && cp -r .next/static .next/standalone/.next/static

# ---------------------------------------------------------------------------
# migrator — drizzle-kit and the migration files, nothing else of the app.
# ---------------------------------------------------------------------------
FROM deps AS migrator
WORKDIR /app
COPY drizzle.config.ts ./
COPY db ./db
ENV NODE_ENV=production
USER node
CMD ["npx", "--no-install", "drizzle-kit", "migrate"]

# ---------------------------------------------------------------------------
# runner — the website.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    # Uploaded photographs and saved faces. Mount a volume here — anything
    # written inside the container is lost when it is replaced.
    STORAGE_ROOT=/data/storage

COPY --from=builder --chown=node:node /app/.next/standalone ./

RUN mkdir -p /data/storage && chown -R node:node /data
VOLUME ["/data/storage"]

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/privacy').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
