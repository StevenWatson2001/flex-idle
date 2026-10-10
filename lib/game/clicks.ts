// The numbers behind clicking. The browser's click count is untrusted, so
// the server accepts at most MAX_CLICKS_PER_SECOND for the time since its
// last accepted clicks, banking at most MAX_BANKED_SECONDS of it (see
// save_clicks in the #7 migration).

export const GOLD_PER_CLICK = 1;
export const MAX_CLICKS_PER_SECOND = 20;
export const MAX_BANKED_SECONDS = 10;

// The most clicks one save may claim; more is refused outright.
export const MAX_CLICKS_PER_SAVE = 1000;

// How often the browser sends its clicks, in milliseconds.
export const SAVE_INTERVAL_MS = 2000;
