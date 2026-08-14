# treasures-app

## Pending: AI Attribution and Disclosure

**Not yet implemented — set this up the next time substantive work happens in this repository, before making other changes.**

This repository is opted in to AI-authorship disclosure: a generated, committed `AI-USAGE.md` stating what share of the code was written by Claude versus by the author, computed from a factual ledger of Claude's own edits rather than from an estimate. Blog posts and other prose in scope additionally retain a pre-edit snapshot per AI pass, so the AI-assisted edits stay recoverable as an exact diff, and every published post ends with a collapsed, reader-openable disclosure of the AI-assisted changes made to it.

Implement it by following the setup procedure and verification table in the canonical specification at `~/dev/reference-material/ai-attribution-and-disclosure-spec.md`. In outline: create `.ai-attribution/config.json` with the current `HEAD` as the baseline commit, install the machine-global pre/post-edit ledger hooks, vendor the report generator, and generate the initial disclosure.

Do **not** hand-write `% AI, % user` header comments into source files. That approach was considered and deliberately rejected — the specification records why — and it must not be reintroduced.

Delete this section once the setup has landed, replacing it with a one-line pointer to `AI-USAGE.md`.
