"use strict";

// Resolves a Neetcode problem to its LeetCode URL.
// Message contract (from content.js):
//   request:  { type: "resolve", ncSlug: string, title: string }
//   response: { ncSlug, status: "found", url, source: "cache"|"title"|"neetcode" }
//           | { ncSlug, status: "notfound" }
//           | { ncSlug, status: "error", message }

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";
const NEETCODE_ORIGIN = "https://neetcode.io";
const CACHE_PREFIX = "lc:";

const QUESTION_LIST_QUERY = `
  query n2lSearch($filters: QuestionListFilterInput) {
    questionList(categorySlug: "", limit: 50, skip: 0, filters: $filters) {
      data { title titleSlug }
    }
  }`;

// ncSlug -> LeetCode slug, parsed from Neetcode's bundle once per background lifetime.
let neetcodeMapPromise = null;

// Case- and punctuation-insensitive: "Implement Trie Prefix Tree" == "Implement Trie (Prefix Tree)".
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function leetcodeUrl(slug) {
  return `https://leetcode.com/problems/${slug}/`;
}

// Returns the LeetCode slug whose title exactly matches, or null if zero or several match.
async function lookupByTitle(title) {
  const res = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: QUESTION_LIST_QUERY,
      variables: { filters: { searchKeywords: title } },
    }),
  });
  if (!res.ok) throw new Error(`LeetCode GraphQL HTTP ${res.status}`);
  const json = await res.json();
  const questions = json?.data?.questionList?.data;
  if (!Array.isArray(questions)) throw new Error("LeetCode GraphQL: unexpected response");
  const wanted = normalizeTitle(title);
  const matches = questions.filter((q) => normalizeTitle(q.title) === wanted);
  return matches.length === 1 ? matches[0].titleSlug : null;
}

// Neetcode's main.<hash>.js embeds objects like
//   {problem:"Contains Duplicate",...,link:"contains-duplicate/",...,ncLink:"duplicate-integer/"}
async function loadNeetcodeMap() {
  const html = await (await fetch(`${NEETCODE_ORIGIN}/`)).text();
  const src = html.match(/src="([^"]*main\.[0-9a-f]+\.js)"/)?.[1];
  if (!src) throw new Error("Neetcode bundle not found");
  const bundleRes = await fetch(new URL(src, `${NEETCODE_ORIGIN}/`));
  if (!bundleRes.ok) throw new Error(`Neetcode bundle HTTP ${bundleRes.status}`);
  const bundle = await bundleRes.text();

  const map = new Map();
  for (const [entry] of bundle.matchAll(/\{problem:"[^{}]*?\}/g)) {
    const link = entry.match(/[{,]link:"([^"\/]+)\/?"/)?.[1];
    const ncLink = entry.match(/[{,]ncLink:"([^"\/]+)\/?"/)?.[1];
    if (link && ncLink && !map.has(ncLink)) map.set(ncLink, link);
  }
  if (map.size === 0) throw new Error("Neetcode bundle: no problem mappings parsed");
  return map;
}

async function lookupByNeetcodeData(ncSlug) {
  if (!neetcodeMapPromise) {
    neetcodeMapPromise = loadNeetcodeMap().catch((err) => {
      neetcodeMapPromise = null; // allow retry on next request
      throw err;
    });
  }
  return (await neetcodeMapPromise).get(ncSlug) ?? null;
}

async function resolve({ ncSlug, title }) {
  const key = CACHE_PREFIX + ncSlug;
  const cached = (await browser.storage.local.get(key))[key];
  if (cached) return { ncSlug, status: "found", url: leetcodeUrl(cached), source: "cache" };

  const errors = [];
  let slug = null;
  let source = null;

  if (title) {
    try {
      slug = await lookupByTitle(title);
      source = "title";
    } catch (err) {
      errors.push(err);
    }
  }
  if (!slug) {
    try {
      slug = await lookupByNeetcodeData(ncSlug);
      source = "neetcode";
    } catch (err) {
      errors.push(err);
    }
  }

  if (slug) {
    await browser.storage.local.set({ [key]: slug });
    console.log(`neet2leet: ${ncSlug} -> ${slug} (${source})`);
    return { ncSlug, status: "found", url: leetcodeUrl(slug), source };
  }
  // Both lookups failed outright: report error so the user can retry.
  // If at least one lookup ran successfully and found nothing, it is a genuine miss.
  const attempts = title ? 2 : 1;
  if (errors.length === attempts) {
    console.warn("neet2leet: lookup failed", ncSlug, errors);
    return { ncSlug, status: "error", message: errors.map((e) => e.message).join("; ") };
  }
  return { ncSlug, status: "notfound" };
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "resolve" || typeof msg.ncSlug !== "string") return undefined;
  return resolve(msg);
});
