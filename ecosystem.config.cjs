// PM2 process definition — `pm2 start ecosystem.config.cjs`.
//
// Runs `npm run start` (`next start`) rather than calling `next` directly:
// this way `package.json`'s own `start` script stays the one place that
// defines how the app is launched (its port flag, if any), and PM2 does not
// end up with its own, second copy of that command to keep in sync.
//
// `next start` reads `.env`/`.env.local` itself on boot — nothing here needs
// to inject `DATABASE_URL`, `STORAGE_ROOT`, or any of the rest.
module.exports = {
  apps: [
    {
      name: "pix-ku-csc",
      script: "npm",
      args: "run start",
      cwd: __dirname,
      // A single Node process is what this app is built around — the
      // Postgres pool, the in-memory upload/indexing concurrency limits in
      // lib/face/pipeline.ts, and STORAGE_ROOT's local-disk writes all
      // assume one process, not several sharing the same event loop's
      // in-memory state. `instances: 1` under `fork` mode is that
      // assumption made explicit, not a placeholder to raise later.
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      // Never in production — a watcher restarting the app every time it
      // writes a photo under STORAGE_ROOT (if that ever ended up inside the
      // watched tree) or appends a log file would turn "always on" into
      // "restarts under load."
      watch: false,
      // A crash-loop guard, not a tuned ceiling — sharp's decode/resize work
      // and the face-indexing concurrency caps already bound how much of
      // this app runs at once. Raise it if the server's own available
      // memory is smaller than this, or if real usage shows it is too low.
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
