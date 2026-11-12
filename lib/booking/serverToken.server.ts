import "server-only";
/**
 * Must match booking_settings.server_token (migration 0002).
 * Only purpose: lets the database accept LINE user id/name from THIS server
 * (after it verified the LINE ID token). Bookings themselves don't need it.
 */
export const BOOKING_SERVER_TOKEN = process.env.BOOKING_SERVER_TOKEN || "c7fa22a1a212ee49322e8f54f8bd995afa19a1a403c8fa89";
