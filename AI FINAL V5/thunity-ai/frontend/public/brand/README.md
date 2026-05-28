# frontend/public/brand/

Intentionally empty after the W18A consolidation. **No production logo asset
exists yet.**

PROJECT AI BUILDING contained only **raster brand-reference sheets** (JPEGs of the
monogram inside layout sheets), not production vector/PNG logo files. Those sheets
were imported as references — not assets — to:

    references/brand/

So the W17 logo-ready slots still fall back to the ◆ placeholder, honestly.

## To wire the real logo later (Bundle D)
Drop the real exported assets into **`frontend/public/`** (the root, not this
`brand/` subfolder) so the existing W17 slots pick them up automatically:

- `frontend/public/thunity-mark.svg`  — circular monogram (sidebar + chat avatars)
- `frontend/public/thunity-logo.svg`  — full horizontal lockup (optional)
- `frontend/public/favicon.svg`        — referenced by `frontend/index.html`

No code change is required for `thunity-mark.svg` / `favicon.svg`; the slots in
`AppShell.tsx`, `Login.tsx`, `Council.tsx`, and `index.html` already reference
those paths and fall back to ◆ until the files exist.
