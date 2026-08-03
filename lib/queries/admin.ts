import "server-only";

import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { events, photographers, users } from "@/db/schema";

/**
 * Rows per page in the directory.
 *
 * The owner expects hundreds to low thousands of accounts, which is why the
 * search and the paging both run in Postgres rather than in the page. Loading
 * every user to filter them in JavaScript works fine at 30 accounts and stops
 * working somewhere the developer never sees.
 */
export const ADMIN_PAGE_SIZE = 25;

export type PendingPhotographer = {
  id: string;
  displayName: string;
  affiliation: string | null;
  contactEmail: string | null;
  bio: string | null;
  createdAt: Date;
};

/**
 * Oldest first. A review queue sorted newest-first quietly starves whoever has
 * been waiting longest, which on a campus service is the person who applied
 * before an event they are already committed to shooting.
 */
export async function getPendingPhotographers(): Promise<PendingPhotographer[]> {
  return db
    .select({
      id: photographers.id,
      displayName: photographers.displayName,
      affiliation: photographers.affiliation,
      contactEmail: photographers.contactEmail,
      bio: photographers.bio,
      createdAt: photographers.createdAt,
    })
    .from(photographers)
    .where(eq(photographers.status, "pending"))
    .orderBy(asc(photographers.createdAt));
}

export type PendingEvent = {
  id: string;
  slug: string;
  nameTh: string;
  descriptionTh: string | null;
  location: string | null;
  startsAt: Date;
  ownerName: string;
};

export async function getPendingEvents(): Promise<PendingEvent[]> {
  return db
    .select({
      id: events.id,
      slug: events.slug,
      nameTh: events.nameTh,
      descriptionTh: events.descriptionTh,
      location: events.location,
      startsAt: events.startsAt,
      ownerName: photographers.displayName,
    })
    .from(events)
    .innerJoin(photographers, eq(events.ownerId, photographers.id))
    .where(eq(events.status, "pending"))
    .orderBy(asc(events.createdAt));
}

// ---------------------------------------------------------------------------
// Dashboard counts
// ---------------------------------------------------------------------------

export type AdminStats = {
  users: number;
  photographers: number;
  pendingPhotographers: number;
  pendingEvents: number;
  events: number;
};

/**
 * One round trip rather than five. These are all `count(*)` over small tables,
 * and the numbers only mean anything read together — five separate queries
 * could each be true at a different instant and add up to a state that never
 * existed.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const [row] = await db
    .select({
      users: sql<number>`(select count(*) from "user")::int`,
      photographers: sql<number>`(select count(*) from photographer where status = 'approved')::int`,
      pendingPhotographers: sql<number>`(select count(*) from photographer where status = 'pending')::int`,
      pendingEvents: sql<number>`(select count(*) from event where status = 'pending')::int`,
      events: sql<number>`(select count(*) from event where status = 'approved')::int`,
    })
    .from(sql`(select 1) as one`);

  return row;
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

export type DirectoryRow = {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: "user" | "photographer" | "admin";
  joinedAt: Date;
  /** Null when this account has never applied or been made a photographer. */
  photographerId: string | null;
  photographerStatus: "pending" | "approved" | "rejected" | null;
  displayName: string | null;
  affiliation: string | null;
  eventCount: number;
};

export type Directory = {
  rows: DirectoryRow[];
  total: number;
  page: number;
  pageCount: number;
};

export type DirectoryFilter = "all" | "users" | "photographers" | "admins";

/**
 * Every account, with its photographer record folded in.
 *
 * A `leftJoin` rather than two lists: a person is one person whether or not
 * they also shoot events, and showing them twice would make "128 users" and
 * the rows on screen disagree. It also means the promote action has the
 * account and its photographer state in the same row, so the button can say
 * what it will actually do.
 */
export async function getDirectory({
  q = "",
  page = 1,
  filter = "all",
}: {
  q?: string;
  page?: number;
  filter?: DirectoryFilter;
} = {}): Promise<Directory> {
  const term = q.trim();

  // `ilike` on name and email. At the expected scale this is a sequential scan
  // over a few thousand short rows, which Postgres does in well under a
  // millisecond; a trigram index would be cost with no benefit until this is
  // an order of magnitude larger.
  const search = term
    ? or(ilike(users.name, `%${term}%`), ilike(users.email, `%${term}%`))
    : undefined;

  /**
   * `users` means `role = 'user'` rather than "has no photographer row", and
   * the difference is deliberate. The role only moves up on approval and back
   * down on revocation, so a plain account, one whose application is still
   * pending, and one that used to be a photographer all read as `user` — which
   * is what each of them actually is right now. Filtering on the absence of a
   * photographer record instead would hide the pending applicants from the
   * very list an admin scans to find people to promote.
   */
  const scope =
    filter === "users"
      ? eq(users.role, "user")
      : filter === "photographers"
        ? eq(photographers.status, "approved")
        : filter === "admins"
          ? eq(users.role, "admin")
          : undefined;

  const where = and(...[search, scope].filter(Boolean));

  const [{ total }] = await db
    .select({ total: count() })
    .from(users)
    .leftJoin(photographers, eq(photographers.userId, users.id))
    .where(where);

  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      joinedAt: users.createdAt,
      photographerId: photographers.id,
      photographerStatus: photographers.status,
      displayName: photographers.displayName,
      affiliation: photographers.affiliation,
      eventCount: sql<number>`(
        select count(*) from event where event.owner_id = photographer.id
      )::int`,
    })
    .from(users)
    .leftJoin(photographers, eq(photographers.userId, users.id))
    .where(where)
    // Newest accounts first: the reason to open this page is almost always
    // somebody who just signed up and is waiting to be given something.
    .orderBy(desc(users.createdAt))
    .limit(ADMIN_PAGE_SIZE)
    .offset((safePage - 1) * ADMIN_PAGE_SIZE);

  return { rows, total, page: safePage, pageCount };
}

/** Every event owned by one photographer, for the drill-down. */
export async function getPhotographerEvents(photographerId: string) {
  return db
    .select({
      id: events.id,
      slug: events.slug,
      nameTh: events.nameTh,
      status: events.status,
      startsAt: events.startsAt,
      photoCount: events.photoCount,
    })
    .from(events)
    .where(eq(events.ownerId, photographerId))
    .orderBy(desc(events.startsAt));
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export type DayPoint = { day: string; count: number };

export type AdminMetrics = {
  totals: {
    users: number;
    photographers: number;
    events: number;
    photos: number;
    faces: number;
    searches: number;
  };
  /** One entry per day for the window, including days with no activity. */
  searchesPerDay: DayPoint[];
  indexing: {
    total: number;
    indexed: number;
    working: number;
    noFace: number;
    failed: number;
  };
};

const METRIC_DAYS = 30;

/**
 * Everything the dashboard plots, in one round trip.
 *
 * **Every number here is counted from the tables.** PRODUCT.md forbids invented
 * figures, and this is the screen most tempted by them: a dashboard with
 * plausible-looking numbers is indistinguishable from a working one until the
 * day somebody makes a decision on it. An empty database must therefore read as
 * genuinely empty rather than as a demo.
 *
 * The daily series is built from `generate_series` left-joined onto the counts,
 * not from `group by date`. Grouping alone omits days where nothing happened,
 * and a line drawn through the surviving points slopes gently between them —
 * a quiet week renders as continuous activity. The zero has to be in the data
 * for the chart to tell the truth.
 */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const [totals] = await db
    .select({
      users: sql<number>`(select count(*) from "user")::int`,
      photographers: sql<number>`(select count(*) from photographer where status = 'approved')::int`,
      events: sql<number>`(select count(*) from event where status = 'approved')::int`,
      photos: sql<number>`(select count(*) from photo)::int`,
      faces: sql<number>`(select count(*) from photo_face)::int`,
      searches: sql<number>`(select count(*) from search)::int`,
    })
    .from(sql`(select 1) as one`);

  const [indexing] = await db
    .select({
      total: sql<number>`count(*)::int`,
      indexed: sql<number>`count(*) filter (where index_status = 'indexed')::int`,
      working: sql<number>`count(*) filter (where index_status in ('pending','indexing'))::int`,
      noFace: sql<number>`count(*) filter (where index_status = 'no_face')::int`,
      failed: sql<number>`count(*) filter (where index_status = 'failed')::int`,
    })
    .from(sql`photo`);

  // Days are Bangkok days, not UTC ones. Timestamps are stored with a zone, so
  // grouping them raw would push every search made after 7pm local into the
  // next day's column — on a service whose busiest hours are an evening event,
  // that is not a rounding detail, it is the wrong bar.
  const rows = await db.execute<{ day: string; count: number }>(sql`
    select
      to_char(d.day, 'YYYY-MM-DD') as day,
      coalesce(count(s.id), 0)::int as count
    from generate_series(
      current_date - ${METRIC_DAYS - 1}::int,
      current_date,
      interval '1 day'
    ) as d(day)
    left join search s
      on ((s.created_at at time zone 'Asia/Bangkok')::date) = d.day::date
    group by d.day
    order by d.day
  `);

  return {
    totals,
    indexing,
    searchesPerDay: (rows.rows ?? rows) as unknown as DayPoint[],
  };
}
