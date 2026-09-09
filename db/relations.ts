import { relations } from "drizzle-orm";

import {
  accounts,
  consents,
  downloads,
  events,
  notifications,
  photoFaces,
  photographers,
  photos,
  searches,
  searchMatches,
  sessions,
  userFaces,
  users,
} from "./schema";

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  photographer: one(photographers, {
    fields: [users.id],
    references: [photographers.userId],
  }),
  faces: many(userFaces),
  consents: many(consents),
  searches: many(searches),
  notifications: many(notifications),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const photographersRelations = relations(
  photographers,
  ({ one, many }) => ({
    user: one(users, {
      fields: [photographers.userId],
      references: [users.id],
    }),
    events: many(events),
  }),
);

export const eventsRelations = relations(events, ({ one, many }) => ({
  owner: one(photographers, {
    fields: [events.ownerId],
    references: [photographers.id],
  }),
  photos: many(photos),
  faces: many(photoFaces),
  searches: many(searches),
}));

export const photosRelations = relations(photos, ({ one, many }) => ({
  event: one(events, { fields: [photos.eventId], references: [events.id] }),
  uploader: one(users, { fields: [photos.uploadedBy], references: [users.id] }),
  faces: many(photoFaces),
  downloads: many(downloads),
}));

export const photoFacesRelations = relations(photoFaces, ({ one, many }) => ({
  photo: one(photos, { fields: [photoFaces.photoId], references: [photos.id] }),
  event: one(events, { fields: [photoFaces.eventId], references: [events.id] }),
  matches: many(searchMatches),
}));

export const userFacesRelations = relations(userFaces, ({ one }) => ({
  user: one(users, { fields: [userFaces.userId], references: [users.id] }),
}));

export const searchesRelations = relations(searches, ({ one, many }) => ({
  event: one(events, { fields: [searches.eventId], references: [events.id] }),
  user: one(users, { fields: [searches.userId], references: [users.id] }),
  matches: many(searchMatches),
}));

export const searchMatchesRelations = relations(searchMatches, ({ one }) => ({
  search: one(searches, {
    fields: [searchMatches.searchId],
    references: [searches.id],
  }),
  face: one(photoFaces, {
    fields: [searchMatches.faceId],
    references: [photoFaces.faceId],
  }),
}));

export const downloadsRelations = relations(downloads, ({ one }) => ({
  photo: one(photos, {
    fields: [downloads.photoId],
    references: [photos.id],
  }),
  user: one(users, { fields: [downloads.userId], references: [users.id] }),
}));

export const consentsRelations = relations(consents, ({ one }) => ({
  user: one(users, { fields: [consents.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));
