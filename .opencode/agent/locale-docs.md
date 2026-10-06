---
description: Translates one release's README banner + CHANGELOG entry into one locale (es pt-BR ko-KR ja ru zh-CN zh-TW fr pl uk da ar de it tr hi).
mode: subagent
temperature: 0.2
---
You own exactly two files: `README.<L>.md` and `CHANGELOG.<L>.md`. Source of truth is the newest
`## [X.Y.Z]` block in `CHANGELOG.md` and the `🆕` banner line in `README.md`.
- CHANGELOG: insert the translated entry above the previous version, heading exactly
  `## [X.Y.Z] — YYYY-MM-DD`, using the section labels this file already uses; code spans, names,
  URLs, PR numbers and @handles untranslated. Exactly one such heading.
- README: new `🆕` lead (the file's own "Latest release" wording), then `>`, then the old lead
  relabelled with the file's own "Previous" wording; delete the older previous line and its `>`.
- Keep the file's typography (CJK full-width punctuation where the file uses it; no English
  glosses in headings, especially `ar`). Touch nothing else; verify with grep.
