"""porch ui [--desktop]: attach an optional view to an existing registry."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import threading
from urllib.parse import urlencode

from steer.registry import Registry, RegistryError
from .focus import launch_focus
from .server import create_server


def main():
    parser = argparse.ArgumentParser(description="Observe existing Porch runs; closing UI leaves workers running")
    parser.add_argument("--desktop", action="store_true", help="open the optional Porch desktop window")
    parser.add_argument("--port", type=int, default=0, help="loopback port (default: automatic)")
    parser.add_argument("--registry-root", type=Path, help="defaults to PORCH_STEER_DIR / standard registry")
    parser.add_argument("--mine", action="store_true", help="show active runs launched by this agent session")
    parser.add_argument("--focus-run", metavar="RUN_ID", help="select an existing run (can be combined with --mine)")
    # cmd.exe's %* retains the original subcommand after SHIFT.
    argv = sys.argv[2:] if sys.argv[1:2] == ["ui"] else sys.argv[1:]
    args = parser.parse_args(argv)
    ui = Path(__file__).resolve().parents[3] / "ui"
    if not (ui / "dist" / "index.html").is_file():
        parser.error(f"UI has not been built. Run: cd '{ui}' && pnpm install && pnpm build")
    electron = ui / "node_modules" / "electron" / "cli.js"
    if args.desktop and not electron.is_file():
        parser.error(f"Desktop runtime is not installed. Run pnpm install in {ui}")
    if not 0 <= args.port <= 65535:
        parser.error("--port must be between 0 and 65535")
    registry = Registry(args.registry_root)
    try:
        focus = launch_focus(registry, os.environ, mine=args.mine, run_id=args.focus_run or "")
    except (RegistryError, ValueError) as error:
        parser.error(str(error))
    server = create_server(registry, ui / "dist", port=args.port)
    url = f"{server.origin}/#{urlencode({'token': server.token, **focus})}"
    print(f"Porch UI: {url}", flush=True)
    print("Read-only observer. Ctrl+C closes the view; workers keep running.", file=sys.stderr)
    try:
        if args.desktop:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                if sys.platform == "darwin":
                    from .mac_app import executable
                    command = [str(executable(ui)), str(ui / "electron" / "main.cjs"), url]
                else:
                    command = ["node", str(electron), str(ui / "electron" / "main.cjs"), url]
                return subprocess.call(command,
                                       env={k: v for k, v in os.environ.items() if k != "ELECTRON_RUN_AS_NODE"})
            finally:
                server.shutdown()
                thread.join()
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
