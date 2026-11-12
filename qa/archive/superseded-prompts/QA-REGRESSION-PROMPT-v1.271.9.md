# QA regression prompt — v1.271.9

Swarm release (CAR-266). Story: The oraclecloud scanner recognized boards too loosely, so a wrong or spoofed oracle-flavored host could slip into a scan. The swarm pinned the canonical entry host in both the source module and its adapter, backed by a new test suite. Users now get scans that reach only genuine Oracle Cloud postings, with fewer junk rows and safer fetches.
[0m
> build · glm-5.3-flash

- Gates at ship time: see the CHANGELOG entry for 1.271.9 and the release workflow run.
- Spot check: Parent-sync #5c: oracle_host — pin хоста входа oraclecloud (#6635) behaves as described; no regressions on the touched surfaces.
