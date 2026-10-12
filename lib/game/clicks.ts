// The numbers behind clicking and saving. The browser's click count is
// untrusted, so the server accepts at most MAX_CLICKS_PER_SECOND for the
// time since its last accepted clicks, banking at most MAX_BANKED_SECONDS
// of it (see sync_progress in the #16 migration).

export const GOLD_PER_CLICK = 1;
export const MAX_CLICKS_PER_SECOND = 20;
export const MAX_BANKED_SECONDS = 10;

// The most clicks one save may claim; more is refused outright.
export const MAX_CLICKS_PER_SAVE = 1000;

// How often a signed-in page saves (clicks and income), in milliseconds.
export const SAVE_INTERVAL_MS = 2000;

// Units earn only while a signed-in page is open: each save credits at
// most this many seconds of income since the last. It's well over the
// save interval because browsers slow timers in hidden tabs to once a
// minute.
export const MAX_INCOME_SECONDS = 90;
