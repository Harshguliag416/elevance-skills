const crypto = require("crypto");

/**
 * Password generator for the Forgot Password flow.
 *
 * Per the product spec the reset password must contain ONLY uppercase and
 * lowercase letters — no numbers, no special characters. A CSPRNG is used and
 * both cases are guaranteed to be present.
 */
const LETTERS_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LETTERS_LOWER = "abcdefghijklmnopqrstuvwxyz";
const ALL_LETTERS = LETTERS_UPPER + LETTERS_LOWER;

const DEFAULT_LENGTH = 10;

/** Pick n distinct indices from a pool via crypto (no replacement). */
function pickDistinct(poolLength, n) {
  const indices = Array.from({ length: poolLength }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, n);
}

/** Generate a letters-only password with at least one upper and one lower case. */
function generateLetterPassword(length = DEFAULT_LENGTH) {
  if (!Number.isInteger(length) || length < 4) length = DEFAULT_LENGTH;

  // Reserve one slot for each case guarantee.
  const upper = LETTERS_UPPER[crypto.randomInt(0, LETTERS_UPPER.length)];
  const lower = LETTERS_LOWER[crypto.randomInt(0, LETTERS_LOWER.length)];

  const rest = Array.from({ length: length - 2 }, () =>
    ALL_LETTERS[crypto.randomInt(0, ALL_LETTERS.length)]
  );

  const chars = [upper, lower, ...rest];
  // Shuffle so the guaranteed characters are not predictable at the edges.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

module.exports = { generateLetterPassword, DEFAULT_LENGTH };
