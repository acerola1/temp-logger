import type { Timestamp } from 'firebase/firestore';

// Stored/read as ISO-8601 string, for example 2026-04-17T13:45:00.000Z.
export type IsoDateTimeString = string;

// Stored/read as ISO-8601 date-only string, for example 2026-04-17.
export type IsoDateString = string;

// In-memory/chart domain value in Unix milliseconds.
export type UnixMillis = number;

// Firestore native timestamp shape (used only where Firestore returns Timestamp objects).
export type FirestoreTimestampLike = Timestamp;
