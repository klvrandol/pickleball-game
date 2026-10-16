# UI localization

- `ko.ts` / `en.ts`: all translated UI copy, including legacy rule-message templates. Shared keys and `{v0}`, `{v1}` parameters must match across catalogs.
- `index.ts`: browser-language detection, `pickleball.language` persistence, `t(key, values, fallback)`, change subscriptions. Missing Korean entries fall back to English; unknown keys use the supplied English fallback or `Unavailable`.
- `dom.ts`: live text/ARIA bindings for existing markup and event-only notices. The binding remembers each node's source text, so switching language translates a notice already on screen without restarting it.
- New UI should use `t(...)`. `localizeText` is the compatibility boundary for existing rule reasons, AI statuses and HTML text. The match/AI classes keep their original authoritative reason/status strings because gameplay and animation code inspect some of them. Never translate those internal fields in place.
- Language selection updates labels only. It does not start, pause, restart or advance a match. The pause screen also provides a selector, allowing changes while the match is safely paused.
- `PICKLE COURT`, actor IDs, GLB paths, scores, CSS role colors and input shortcuts remain independent of locale. Language autonyms (`한국어`, `English`) deliberately remain unchanged.
- To add a language: add its catalog, register its messages and autonym in `LANGUAGES` (selection, fallback and browser detection use that registry). Run catalog/placeholder tests and the browser checks below.

Checks: `npm test`; with Vite running, `node tools/check-i18n.cjs`. Browser tests cover language detection, live/persisted selection, title/help/settings, nameplates and match notices for both modes. Test-only hooks expose state without changing game logic.
