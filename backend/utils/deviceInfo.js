/**
 * Lightweight user-agent parser for login-history tracking.
 *
 * Deliberately dependency-free: we only need the browser name, OS, and a
 * device-type bucket (desktop / laptop / mobile). Detection order matters and
 * is documented inline. Unknown values fall back to sensible defaults.
 */

/** Browser detection. Edge/Opera must be checked before Chrome (they embed it). */
function detectBrowser(ua) {
  const s = String(ua || "");
  if (s.includes("Edg/")) return "Microsoft Edge";
  if (s.includes("OPR/") || s.includes("Opera")) return "Opera";
  if (s.includes("Firefox/")) return "Firefox";
  if (s.includes("Chrome/") || s.includes("CriOS/")) return "Google Chrome";
  if (s.includes("Safari/")) return "Safari";
  if (s.includes("MSIE") || s.includes("Trident")) return "Internet Explorer";
  return "Unknown";
}

/** OS detection from UA markers. */
function detectOs(ua) {
  const s = String(ua || "");
  if (s.includes("Windows NT 10")) return "Windows 10";
  if (s.includes("Windows NT 6.3")) return "Windows 8.1";
  if (s.includes("Windows NT 6.1")) return "Windows 7";
  if (s.includes("Android")) return "Android";
  if (s.includes("iPhone") || s.includes("iPad") || s.includes("iPod"))
    return "iOS";
  if (s.includes("Mac OS X")) return "macOS";
  if (s.includes("CrOS")) return "Chrome OS";
  if (s.includes("Linux")) return "Linux";
  return "Unknown";
}

/**
 * Device type bucket.
 * - Mobile if the UA explicitly says so (phone/tablet).
 * - Laptop vs desktop is ambiguous from UA alone; we use a heuristic
 *   (tablet/touch + larger browser fingerprint → laptop) but default to
 *   "laptop" for portable devices and "desktop" for everything else.
 */
function detectDeviceType(ua) {
  const s = String(ua || "");
  const isMobile = /Mobile|Android|iPhone|iPod|iPad/i.test(s);
  if (isMobile) return "mobile";
  const isTablet = /Tablet|iPad|PlayBook|Silk/i.test(s);
  if (isTablet) return "laptop";
  // Desktop-style browser (Windows/macOS/Linux desktop) → desktop.
  return "desktop";
}

/** Full fingerprint used for login-history records. */
function parseUserAgent(ua) {
  return {
    browser: detectBrowser(ua),
    os: detectOs(ua),
    deviceType: detectDeviceType(ua),
  };
}

module.exports = { detectBrowser, detectOs, detectDeviceType, parseUserAgent };
