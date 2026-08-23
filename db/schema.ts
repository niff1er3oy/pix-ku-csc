import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRole = pgEnum("user_role", ["user", "photographer", "admin"]);

/** Photographers self-apply; an admin flips them to approved before they can
 *  create events. */
export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const eventStatus = pgEnum("event_status", [
  "draft", // photographer is still setting it up, not submitted
  "pending", // waiting on admin approval
  "approved", // live, publicly reachable via QR/URL
  "rejected",
  "archived",
]);

/** Where a photo is in the Rekognition indexing pipeline. */
export const indexStatus = pgEnum("index_status", [
  "pending",
  "indexing",
  "indexed",
  "no_face", // processed fine, Rekognition just found nobody
  "failed",
]);

export const watermarkPosition = pgEnum("watermark_position", [
  "bottom_right",
  "bottom_left",
  "top_right",
  "top_left",
  "center",
  "tiled",
]);

/** PDPA consent is versioned so a policy change can re-prompt users. */
export const consentType = pgEnum("consent_type", [
  "biometric_search", // one-off: scan my face against this event
  "biometric_storage", // ongoing: keep my reference face on file
  "terms",
  "privacy",
]);

export const searchMode = pgEnum("search_mode", [
  "saved_face", // logged-in user reusing their stored reference selfie
  "uploaded_selfie", // anonymous or logged-in one-off upload, never stored
]);

// ---------------------------------------------------------------------------
// Auth.js tables (shape dictated by @auth/drizzle-adapter)
// ---------------------------------------------------------------------------

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  role: userRole("role").notNull().default("user"),
  locale: text("locale").notNull().default("th"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ---------------------------------------------------------------------------
// Photographers
// ---------------------------------------------------------------------------

export const photographers = pgTable(
  "photographer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    bio: text("bio"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    /** Faculty / club / company the photographer shoots for. */
    affiliation: text("affiliation"),
    status: approvalStatus("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("photographer_status_idx").on(t.status)],
);

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const events = pgTable(
  "event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nameTh: text("name_th").notNull(),
    nameEn: text("name_en"),
    descriptionTh: text("description_th"),
    descriptionEn: text("description_en"),
    location: text("location"),
    /**
     * The day the event happened. A date, not a timestamp, and that removes a
     * problem rather than deferring it: a timestamp forces every read and
     * write to agree on a timezone, and the previous `timestamptz` needed the
     * Bangkok offset pinned by hand on the way in because `datetime-local`
     * carries no zone. A `date` has no zone to get wrong — 2026-09-10 is that
     * day in every timezone there is.
     *
     * Held as a string rather than a JS `Date` for the same reason: a Date is
     * an instant, and constructing one from a date-only value re-introduces
     * the midnight-in-which-zone question this column exists to avoid.
     */
    eventDate: date("event_date", { mode: "string" }).notNull(),

    ownerId: uuid("owner_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),

    status: eventStatus("status").notNull().default("draft"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),

    /** Rekognition collection holding every indexed face in this event.
     *  Null until the first photo is uploaded. */
    faceCollectionId: text("face_collection_id"),

    /**
     * The event's cover image, relative to STORAGE_ROOT.
     *
     * Replaces an unused `cover_photo_id` that pointed at a photo inside the
     * event. That could never work at the moment it is needed: a photographer
     * sets the cover while creating the event, before a single photo has been
     * uploaded. This is its own image, chosen deliberately, rather than
     * whichever frame happened to land first.
     *
     * Null falls back to the first photo's thumbnail, so an event that never
     * gets a cover still looks like something.
     */
    coverPath: text("cover_path"),

    /**
     * A private event: kept out of every public list *and* gated behind an
     * entry PIN.
     *
     * One switch rather than two, because the two always travelled together —
     * a gallery worth hiding from the index is a gallery worth asking for a
     * PIN, and an unlisted event with no PIN was only ever a guessable URL
     * away from public. Replaces the previous `is_unlisted`, which did the
     * first half and called it privacy.
     */
    isPrivate: boolean("is_private").notNull().default(false),

    /**
     * scrypt hash of the six-digit entry PIN, as `salt:hash`. Null on a public
     * event.
     *
     * Hashed rather than stored, at the owner's direction, so the PIN cannot be
     * read back out of the database — not by an admin screen, not by whoever
     * ends up with a backup. The photographer sees it once when it is set and
     * generates a new one if they lose it. See lib/event-pin.ts.
     */
    entryPinHash: text("entry_pin_hash"),
    /**
     * The six-character code printed under the QR — never chosen by a
     * photographer or a visitor, and **the event's public address**: the page
     * lives at /e/{accessCode} and the QR points there. One identifier rather
     * than a slug beside a code, so the person who scans and the person who
     * types the code off the sign land in the same place, and there is no
     * second value to keep unique.
     *
     * **Issued by the database**, by `gen_event_code()` in migration 0002.
     * Generating it here rather than in Node means no write path can produce
     * an event without one; a code is the only way into an unlisted event, so
     * a row that slipped through without one would be photographs nobody can
     * reach. That migration also adds a CHECK on the shape, so the format
     * cannot drift away from `cleanEventCode` in lib/event-code.ts.
     *
     * Unique, and that is correctness rather than tidiness: the finder
     * resolves a code to exactly one event. With two events sharing a code the
     * lookup returned whichever row Postgres reached first, verified in a
     * browser — the visitor holding the second event's code was sent into the
     * first event's gallery, i.e. photographs of people who never agreed to be
     * findable that way.
     */
    accessCode: text("access_code")
      .notNull()
      .default(sql`gen_event_code()`),

    // --- watermark, configured per event by the photographer ---------------
    watermarkEnabled: boolean("watermark_enabled").notNull().default(false),
    watermarkText: text("watermark_text"),
    /** Path under STORAGE_ROOT to a PNG the photographer uploaded. */
    watermarkLogoPath: text("watermark_logo_path"),
    watermarkPosition: watermarkPosition("watermark_position")
      .notNull()
      .default("bottom_right"),
    /** 0-100. */
    watermarkOpacity: integer("watermark_opacity").notNull().default(60),
    /** Watermark width as a percentage of the photo's width. */
    watermarkScale: integer("watermark_scale").notNull().default(18),

    /** Downloads are full-resolution; this only decides whether the watermark
     *  is burned in on the way out. */
    allowOriginalDownload: boolean("allow_original_download")
      .notNull()
      .default(true),

    photoCount: integer("photo_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("event_status_idx").on(t.status),
    index("event_owner_idx").on(t.ownerId),
    index("event_date_idx").on(t.eventDate),
    // Unique, and also the index the finder's lookup runs on — every visit
    // that starts from a printed code hits exactly this.
    uniqueIndex("event_access_code_idx").on(t.accessCode),
  ],
);

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export const photos = pgTable(
  "photo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    originalFilename: text("original_filename").notNull(),
    /** All paths are relative to STORAGE_ROOT. */
    originalPath: text("original_path").notNull(),
    previewPath: text("preview_path").notNull(),
    thumbPath: text("thumb_path").notNull(),

    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    /** EXIF DateTimeOriginal when present — lets users narrow by time of day. */
    capturedAt: timestamp("captured_at", { withTimezone: true }),

    indexStatus: indexStatus("index_status").notNull().default("pending"),
    indexError: text("index_error"),
    faceCount: integer("face_count").notNull().default(0),

    /** SHA-256 of the original bytes, so re-uploading the same file is a no-op
     *  instead of paying Rekognition twice. */
    checksum: text("checksum").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("photo_event_idx").on(t.eventId),
    index("photo_index_status_idx").on(t.indexStatus),
    uniqueIndex("photo_event_checksum_idx").on(t.eventId, t.checksum),
  ],
);

/** One row per face Rekognition found in a photo. */
export const photoFaces = pgTable(
  "photo_face",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** FaceId returned by IndexFaces — the join key for search results. */
    faceId: text("face_id").notNull().unique(),
    /** Normalized 0-1 box: { Width, Height, Left, Top }. Used to draw the
     *  "this is you" highlight over the result thumbnail. */
    boundingBox: jsonb("bounding_box").$type<{
      Width: number;
      Height: number;
      Left: number;
      Top: number;
    }>(),
    confidence: real("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("photo_face_photo_idx").on(t.photoId),
    index("photo_face_event_idx").on(t.eventId),
  ],
);

// ---------------------------------------------------------------------------
// Saved reference faces (logged-in users only)
// ---------------------------------------------------------------------------

/**
 * The selfie a signed-in user keeps on file so they can hit "find my photos"
 * without re-uploading. We store the image itself rather than an embedding:
 * Rekognition's SearchFacesByImage takes an image, and keeping the source
 * means we can honour a delete request by removing exactly one file.
 *
 * Anonymous searches never reach this table — their selfie is discarded as
 * soon as the search returns.
 */
export const userFaces = pgTable(
  "user_face",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Path under STORAGE_ROOT/faces. */
    imagePath: text("image_path").notNull(),
    /** Rekognition's own quality read at upload time, surfaced to the user so
     *  they can retake a bad selfie before it costs them matches. */
    quality: jsonb("quality").$type<{
      brightness: number;
      sharpness: number;
    }>(),
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("user_face_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Search history + downloads
// ---------------------------------------------------------------------------

export const searches = pgTable(
  "search",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** Null for anonymous searches. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    mode: searchMode("mode").notNull(),
    matchCount: integer("match_count").notNull().default(0),
    topSimilarity: real("top_similarity"),
    /** Salted hash, not the address itself — enough for rate limiting and
     *  abuse review without storing an identifier. */
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("search_event_idx").on(t.eventId),
    index("search_user_idx").on(t.userId),
    index("search_created_idx").on(t.createdAt),
  ],
);

/**
 * Which faces a search actually matched — one row per distinct face id, not
 * per raw Rekognition hit (`SearchFacesByImage` can return several matches
 * against the same indexed face; the search route already collapses those to
 * one best-similarity score before this is written).
 *
 * Split from `searches` rather than a `faceIds` array column on it: this is a
 * step up in sensitivity from what `searches` already keeps (count and top
 * score only) — it is the record of exactly which detected faces a specific
 * account's search reached, which `matchCount`/`topSimilarity` deliberately
 * stopped short of. A separate table keeps that distinction visible in the
 * schema instead of buried in a column, and lets it be pruned or restricted
 * independently of the aggregate search log later if that turns out to matter.
 */
export const searchMatches = pgTable(
  "search_match",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    searchId: uuid("search_id")
      .notNull()
      .references(() => searches.id, { onDelete: "cascade" }),
    /** References the same Rekognition id `photo_face.face_id` holds, not
     *  that row's own uuid — so this stays meaningful even if a photo (and
     *  its `photo_face` row) is deleted; `onDelete: cascade` here means the
     *  match record disappears with it rather than pointing at nothing. */
    faceId: text("face_id")
      .notNull()
      .references(() => photoFaces.faceId, { onDelete: "cascade" }),
    /** 0-100, Rekognition's own score for this specific face. */
    similarity: real("similarity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("search_match_search_idx").on(t.searchId),
    index("search_match_face_idx").on(t.faceId),
  ],
);

export const downloads = pgTable(
  "download",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    watermarked: boolean("watermarked").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("download_photo_idx").on(t.photoId)],
);

// ---------------------------------------------------------------------------
// PDPA consent log
// ---------------------------------------------------------------------------

/**
 * Append-only. PDPA requires us to show *what* was agreed to and *when*, so a
 * withdrawal is recorded as revokedAt on the original row rather than a delete.
 */
export const consents = pgTable(
  "consent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** For anonymous searches: an opaque cookie id, so a visitor can still
     *  prove and withdraw their consent without an account. */
    anonymousId: text("anonymous_id"),
    type: consentType("type").notNull(),
    /** Version of the policy text that was on screen when they agreed. */
    version: text("version").notNull(),
    granted: boolean("granted").notNull().default(true),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("consent_user_idx").on(t.userId),
    index("consent_anon_idx").on(t.anonymousId),
  ],
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type Photographer = typeof photographers.$inferSelect;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type PhotoFace = typeof photoFaces.$inferSelect;
export type UserFace = typeof userFaces.$inferSelect;
export type Consent = typeof consents.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];
export type EventStatus = (typeof eventStatus.enumValues)[number];
export type WatermarkPosition = (typeof watermarkPosition.enumValues)[number];
