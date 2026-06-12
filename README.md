<div align="center">

# ◆ ThuAI — Version Archive (`master`)

### Your Personal AI. Your Own Database. Your Machine.

[![Archive](https://img.shields.io/badge/Branch-Version%20Archive-8957e5?style=for-the-badge)](#-version-index)
[![Latest](https://img.shields.io/badge/Latest%20Version-v1.3%20on%20main-blueviolet?style=for-the-badge)](../../tree/main)

</div>

---

## 📦 What this branch is

This `master` branch is the **version archive** of ThuAI — Thunity Personal Business
Organization AI. It carries the **full release history**, so every released version of
the project can be checked out from here by its exact commit.

> 🟢 **Looking for the app?** The latest version always lives on
> [**`main`**](../../tree/main) — use that branch to run, develop, and read the full
> product README.

---

## 📜 Version Index

Versions are numbered **sequentially** (`v1.0 → v1.1 → v1.2 → v1.3 → …`).
To browse or restore any version from this archive:

```bash
git fetch origin master
git checkout <commit>        # e.g. git checkout 7a29e7e  → ThuAI v1.2
```

| Version | Commit | Date | Highlights |
|---|---|---|---|
| **v1.3** *(latest — on `main`)* | `89b8a5a` | 2026‑06 | Runs out-of-the-box: dev boot fix (no more startup refusal on fresh checkout) + Vite `/api` proxy (zero CORS); malformed UUIDs → 404/400; real list totals; embedding-model tracking; parser resource ceilings; `MAX_PARALLEL_AGENT_RUNS` enforced; provider error bodies kept out of audit logs; frontier-routing test suite — **110 tests** |
| v1.2 | `7a29e7e` | 2026‑06 | Security & reliability hardening: absolute `LOCAL_ONLY_MODE` gating, fail-closed production startup, approval-gate bypass closed, tool-arg schema validation, RAG relevance floor + full-chunk grounding, hardened containers — **82 tests** |
| v1.1 | `9e85592` | 2026‑06 | ThuAI 1.1 promoted to the repo root as the canonical app; README redesign + live screenshots |
| v1.0 | `fad422d` | 2026‑06 | Initial release (*push awal*) — local-first AI Company OS foundation |

---

## 🔢 Versioning rules

1. Numbering is **sequential** — the next release after v1.3 is **v1.4** (a breaking
   redesign may open v2.0, then continue v2.1, v2.2, …).
2. Every release lands on [`main`](../../tree/main) first; `main`'s README documents
   the *current* version.
3. After a release, `master` is fast-forwarded and this **Version Index** gains one
   row — so this branch always indexes *every* version ever shipped.

---

## 🧠 About ThuAI (short)

ThuAI is a **private, local-first AI Company OS** — a 6-stage AI agent council,
local RAG knowledge vault, founder memory, governed decisions/tasks/workflows, and a
complete audit trail, all running on **your hardware** with **your own PostgreSQL**.
`LOCAL_ONLY_MODE=true` (the default) hard-disables every external AI path; an optional
frontier lane (Claude/OpenRouter) is opt-in, labelled, and never a silent fallback.

Full documentation, screenshots, quick-start guides, and architecture live in the
[`main` README](../../blob/main/README.md) and [`docs/`](docs/).

---

<div align="center">

**◆ ThuAI** — *because your company's brain belongs to you.*

🔒 Local-first · 🗄️ Own database · 🏛️ AI council · 🛡️ Governed automation

</div>
