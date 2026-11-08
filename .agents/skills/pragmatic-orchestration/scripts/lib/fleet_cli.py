#!/usr/bin/env python3
"""File entrypoint keeps imports local without changing the caller's PYTHONPATH."""
from fleet.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
