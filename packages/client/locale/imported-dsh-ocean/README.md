# DSH Ocean translation import

English | [中文](README.zh.md)

Source: installed `@dsh-ocean/builtin-locales` version **0.4.0**, containing the user's Russian, Spanish, Brazilian Portuguese, German, French, Japanese and Korean dictionaries. The original source repository was not changed.

`catalogs.json` preserves the original data verbatim (apart from JSON formatting); `LICENSE` retains DSH Ocean and DeepSeek attribution. `migration-report.json` records the source client SHA-256, counts, and rejected placeholder/command/API-token mismatches.

## Compatibility policy

- Match by current namespace and key, never by a similar label in another namespace.
- Preserve the current English placeholders, slash commands and API-field tokens. Do not import unmatched/obsolete keys or invisible Unicode markers.
- Keep current translations for new keys. Map the old `pt-BR` dictionary to the existing `pt` language (the application already resolves Brazilian Portuguese browser tags).
- Replace the product token `DSH` with `Ocean-Chat`, but keep DeepSeek provider/model names and legal attribution.
- Korean registers only matched keys through the existing locale service, with English fallback. It is intentionally not listed as a complete language in the upstream parity gate.
- The full upstream interface is larger than the old pack. Presence of a language in Settings is not proof that every current screen is translated by this import.

The frontend maintains the current dictionary ownership and HMR disposal. Imported strings are integrated into their owning namespace; Korean registrations are owned by the locale plugin and disposed with it.
