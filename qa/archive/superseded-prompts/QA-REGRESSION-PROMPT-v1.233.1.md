# QA regression — v1.233.1

Documentation release. The `#/config` help never described the control v1.233.0
introduced, and the same section still carried instructions that stopped being
true 200 releases ago.

## §0 — Gates

```bash
node --test tests/help-recognized-keys.test.mjs   # 3 pass
npm run test:ci                                    # 3021 pass, exit 0
npm run test:e2e:browser                           # 116 pass
```

Baseline 3018 → **3021**: three structural help gates. Help stays **32 H2 /
122 H3** in all 17 — everything landed inside existing headings.

## §1 — DOC-1: the "Use the default" entry was undocumented

v1.233.0 gave every dropdown an explicit *Use the default (…)* entry, which
expresses a state the UI had no way to show before: **the key is not set**. The
difference from picking the same value out of the list is invisible and
consequential:

| choice | in `.env` | when the project changes its default |
|---|---|---|
| *Use the default (llama3.2)* | no key | you get the new one |
| `llama3.2` from the list | `OLLAMA_MODEL=llama3.2` | you stay on the old one, silently |

That is exactly the drift CONFIG-2 and CONFIG-3 were about. The mechanism was
fixed in code; there was nowhere to read about it. Three bullets now sit in the
existing `### Behavior` list ×17, covering the entry, the "a field you never
touch is never written" rule, and the toast counting removals as well as writes.

The heading gates could not have caught this: they count H2/H3, and coverage is
not a count.

## §2 — DOC-2: a table row named no key, and its advice was wrong

The `### Recognized keys` table carried `| \`(server uses default UA)\` | … |` —
a parenthesised note where a key name belongs, describing `HH_USER_AGENT`, which
**v1.19.0 removed** from KNOWN_KEYS and the UI. The row then told the reader to
register an application at dev.hh.ru and supply its UA string.

That instruction has bought nothing since **v1.65.0**, when the hh.ru adapter
switched to scraping the public search site with a browser UA of its own. Two
further mentions were just as stale: an "Optional checks" bullet describing a
health row deleted in **v1.28.1**, and a troubleshooting row repeating the
dev.hh.ru advice.

All three are gone. The troubleshooting row is **rewritten rather than deleted**,
because half of it is still true: since July 2026 hh.ru serves HTTP 451 to
non-Russian IPs, so a Russian residential IP genuinely is required — what was
wrong was the registration step and the reference to a key that does not exist.

## §3 — The keys table now says what it is

`### Recognized keys` lists 6 of 45 keys. The heading promises a registry; the
content is a selection, and the provider families are covered in prose elsewhere
in the same section. One sentence ×17 now says so and points at `#/config` for
the complete, grouped list. No keys were added — this closes the ambiguity
rather than expanding the table.

## §4 — Manual pass

1. `#/help` → **App settings & API keys** → `### Behavior` reads three new
   bullets, in the UI language.
2. Search the bundle for `dev.hh.ru` — no hits, in any locale.
3. `#/docs-assistant` → *"what does 'Use the default' mean in App settings?"* →
   answers from the guide instead of saying it is not documented. **Needs a
   configured provider**; with none, check the bundle text instead.
4. `#/config` → the dropdown entry and the help text agree.

## §5 — Invariants

- Registry stays **92** sources; help stays **32 H2 / 122 H3** ×17.
- No key was added or removed; `/api/config` still reports 45.
- The accurate hh.ru passage (public-site scraping, HTTP 451 since July 2026)
  was already correct and is untouched.

## §6 — Sign-off

- [ ] `npm run test:ci` — 3021 pass, exit code captured directly
- [ ] `npm run test:e2e:browser` — 116 pass
- [ ] `grep -ci "use the default"` > 0 in each of the 17 bundles
- [ ] `grep -c "dev.hh.ru"` = 0 in each of the 17
- [ ] `/api/health` on resumecraft.ru reports 1.233.1
