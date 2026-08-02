/**
 * Indian Standard Time (UTC+05:30) window helpers.
 *
 * Used for:
 *  - Task 5: mobile logins are only allowed between 10:00 AM and 1:00 PM IST.
 *  - Task 6: subscription payments are only allowed between 10:00 AM and
 *    11:00 AM IST.
 *
 * We compare in UTC against a fixed +5:30 offset so the rules are unambiguous
 * regardless of the server's local timezone.
 */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** Minutes elapsed since midnight IST for a given Date. */
function istMinutes(date = new Date()) {
  const utc = date.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const d = new Date(utc);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function isWithinWindow(date = new Date(), startMinute, endMinute) {
  const now = istMinutes(date);
  // Handles wraparound windows (e.g. 22:00 → 01:00) even though current uses
  // never cross midnight.
  if (endMinute >= startMinute) {
    return now >= startMinute && now < endMinute;
  }
  return now >= startMinute || now < endMinute;
}

/** Mobile login window: 10:00–13:00 IST. */
function isMobileLoginWindow(date = new Date()) {
  return isWithinWindow(date, 10 * 60, 13 * 60);
}

/** Payment window: 10:00–11:00 IST. */
function isPaymentWindow(date = new Date()) {
  return isWithinWindow(date, 10 * 60, 11 * 60);
}

/** Human-readable current IST time for messages, e.g. "10:34". */
function istClock(date = new Date()) {
  const utc = date.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const d = new Date(utc);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

module.exports = {
  IST_OFFSET_MINUTES,
  istMinutes,
  istClock,
  isWithinWindow,
  isMobileLoginWindow,
  isPaymentWindow,
};
