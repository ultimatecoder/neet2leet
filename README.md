# neet2leet

Firefox extension that adds an "Open on LeetCode" button next to the problem title on NeetCode problem pages (https://neetcode.io/problems/...), opening the matching LeetCode problem in a new tab.

## Install (temporary)

1. Open about:debugging#/runtime/this-firefox in Firefox.
2. Click "Load Temporary Add-on...".
3. Select manifest.json in this folder.
4. Open any NeetCode problem page.

Note: Temporary add-ons are removed when Firefox restarts, so repeat the steps after each restart.

## How it works

- content.js reads the problem title (h1.problem-title) and the NeetCode slug from the URL, and re-runs on NeetCode single-page navigation.
- background.js searches LeetCode GraphQL (https://leetcode.com/graphql, questionList with searchKeywords = title) and accepts only a single exact title match (ignoring case and punctuation).
- Fallback: if the title search fails or finds no exact match, it parses the NeetCode JS bundle (`main.<hash>.js`), which maps each NeetCode slug (ncLink) to its LeetCode slug (link).
- Found links are cached in browser.storage.local per NeetCode slug.

## Button states

- "Finding on LeetCode..." (lookup running)
- "Open on LeetCode" (click opens new tab)
- "No LeetCode match" (NeetCode-only problem)
- "LeetCode lookup failed - retry" (network error, click to retry)

## Troubleshooting

- view background logs via about:debugging -> neet2leet -> Inspect (each resolution logs its source: title or neetcode)
- to clear the cache, remove and reload the add-on

## Privacy

- No analytics, no tracking, no data sent to the extension author.
- The only network requests: the problem title is sent to `leetcode.com/graphql` to search for the matching problem, and the public NeetCode page/bundle is fetched from `neetcode.io` as a fallback.
- Resolved links are stored locally in `browser.storage.local`.

## Build

```bash
npx web-ext lint --ignore-files CLAUDE.md
npx web-ext build --overwrite-dest --ignore-files CLAUDE.md LICENSE README.md amo-metadata.json
```

The zip is written to `web-ext-artifacts/`.

## Author

Jaysinh Shukla ([@ultimatecoder](https://github.com/ultimatecoder))

## License

MIT, see [LICENSE](LICENSE).

## Publishing to addons.mozilla.org

Maintainer-only. Uses your own AMO API credentials
(https://addons.mozilla.org/developers/addon/api/key/); never commit them.

```bash
npx web-ext sign --channel=listed --amo-metadata=amo-metadata.json --ignore-files CLAUDE.md LICENSE README.md amo-metadata.json --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET"
```

Bump `version` in `manifest.json` before each new submission.
