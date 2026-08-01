// Smoke test for src/lib/profanity.ts. Run with:
//   node --experimental-strip-types scripts/profanity-smoke.mjs
// (or after the project compiles, equivalent).
//
// Verifies both directions:
//   - Innocent prose MUST NOT trigger the filter.
//   - Every documented bypass variant MUST trigger.
//
// Exits 0 on success, 1 on any unexpected result.

import { containsProfanity, getProfanityRedirectUrl } from "../src/lib/profanity.ts";

let failures = 0;
function expect(label, cond) {
  if (cond) {
    // eslint-disable-next-line no-console
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    // eslint-disable-next-line no-console
    console.log(`FAIL  ${label}`);
  }
}

// -- Innocent prose MUST NOT trigger --
const innocent = [
  "Please read chapter 3 before tomorrow's class.",
  "Math homework, page 12, problems 1 through 10.",
  "Bring your textbook and a pencil to the science lab.",
  "Don't forget to bring your calculator for the test.",
  "John's a great student in the History elective.",
  "Math, Science, English, Humanities, CCE, and General are subjects.",
  "Hello world. This sentence is perfectly fine.",
];
for (const t of innocent) {
  expect(`innocent prose does NOT trip: "${t}"`, !containsProfanity(t));
}

// -- Standard denylist words MUST trigger --
const shouldTrip = [
  "shit",
  "Shit.",
  "SHIT",
  "this is shit",
  "fuck",
  "FUCK this assignment",
  "damn",
  "dammit",
  "hell yeah",
  "crap",
  "bitch",
  "bastard",
  "asshole",
  "you ass",
  "piss off",
  "you dick",
  "bullshit",
  "wtf is this",
  "stfu already",
  "lmfao that was bad",
];
for (const t of shouldTrip) {
  expect(`denylist word trips: "${t}"`, containsProfanity(t));
}

// -- Bypass surface MUST trigger --
const bypasses = [
  // Punctuation collapsed to space
  "s.h.i.t",
  "s-h-i-t",
  "sh.it",
  "ass-hole",
  "sh*t", // literal in denylist
  "f*ck", // literal in denylist
  // Letter-spacing
  "f u c k",
  "f u ck",
  "s h i t",
  "s h   i t",
  "f    u  c  k",
  // Multiple spaces and tabs
  "f\tu\tc\tk",
  // Apostrophe-splitting (apostrophe dropped on collapse)
  "fu'ck",
  "sh'it",
  "ass'ass", // becomes "ass ass" after apostrophe drop — still matches "ass"
  // Zero-width / bidi marks
  "f\u200B u c k",
  "d\u200damn",
  "d\u200Eamn",
  // Combining diacriticals (Latin-only range)
  "da\u0301mn",
  // NFKC fullwidth
  "\uFF53\uFF48\uFF49\uFF54", // shit in fullwidth
  // Mixed case + punct + spaces
  "F.U.C.K",
  "F**K",
];
for (const t of bypasses) {
  expect(`bypass variant trips: ${JSON.stringify(t)}`, containsProfanity(t));
}

// -- Things that MUST NOT trip (legitimate uses / false-positive guards) --
const falsePositiveGuards = [
  // 'bass' must not match 'ass'.
  "The bass drops at 32 Hz.",
  // 'class' must not match 'ass'.
  "This class is fun.",
  // 'pass' must not match 'ass'.
  "Please pass the test.",
  // 'damned' must not match 'damn' (boundary blocks embedded match).
  "She was damned if she did.",
  // Subject names must not trip.
  "Math, Science, English, Humanities, CCE, General, ChangeMakers, Safety & Wellness",
];
for (const t of falsePositiveGuards) {
  expect(`false-positive guard holds: ${JSON.stringify(t)}`, !containsProfanity(t));
}

// -- URL scheme allowlist --
process.env.PROFANITY_REDIRECT_URL = "javascript:alert(1)";
expect("javascript: URL is rejected", getProfanityRedirectUrl() === null);

process.env.PROFANITY_REDIRECT_URL = "data:text/html,<script>alert(1)</script>";
expect("data: URL is rejected", getProfanityRedirectUrl() === null);

process.env.PROFANITY_REDIRECT_URL = "https://example.com/no-swearing";
expect("https URL is accepted", getProfanityRedirectUrl() === "https://example.com/no-swearing");

process.env.PROFANITY_REDIRECT_URL = "http://example.com/no-swearing";
expect("http URL is accepted", getProfanityRedirectUrl() === "http://example.com/no-swearing");

delete process.env.PROFANITY_REDIRECT_URL;
// (Once unset, getProfanityRedirectUrl returns null and warns once; we don't re-test the warning behavior.)

if (failures > 0) {
  // eslint-disable-next-line no-console
  console.log(`\n${failures} test(s) failed.`);
  process.exit(1);
}
// eslint-disable-next-line no-console
console.log("\nAll profanity smoke tests passed.");
