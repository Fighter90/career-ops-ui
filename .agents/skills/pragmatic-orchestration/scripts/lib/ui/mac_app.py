"""Prepare a named macOS shell for the optional Porch observer."""
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile

APP_ID = "ai.pragmatic-orchestration.porch"


def _icon(png: Path, destination: Path) -> None:
    iconset = destination.parent / "Porch.iconset"
    iconset.mkdir()
    for size in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            pixels = size * scale
            suffix = "@2x" if scale == 2 else ""
            output = iconset / f"icon_{size}x{size}{suffix}.png"
            subprocess.run(["sips", "-s", "format", "png", "-z", str(pixels), str(pixels),
                            str(png), "--out", str(output)], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(destination)], check=True)
    shutil.rmtree(iconset)


def executable(ui: Path) -> Path:
    source = ui / "node_modules" / "electron" / "dist" / "Electron.app"
    if not source.is_dir():
        raise FileNotFoundError("Electron is not installed; run pnpm install in the Porch UI directory")
    with (source / "Contents" / "Info.plist").open("rb") as stream:
        version = str(plistlib.load(stream)["CFBundleVersion"])
    root = Path.home() / "Library" / "Caches" / "porch-desktop" / f"electron-{version}"
    app = root / "Porch.app"
    binary = app / "Contents" / "MacOS" / "Porch"
    if binary.is_file() and (app / "Contents" / "Frameworks" / "Porch Helper.app").is_dir():
        with (app / "Contents" / "Info.plist").open("rb") as stream:
            if plistlib.load(stream).get("CFBundleIdentifier") == APP_ID:
                return binary
    if app.exists():
        shutil.rmtree(app)
    root.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix="porch-app-", dir=root))
    try:
        staged = temporary / "Porch.app"
        subprocess.run(["cp", "-cR", str(source), str(staged)], check=True)
        info_path = staged / "Contents" / "Info.plist"
        with info_path.open("rb") as stream:
            info = plistlib.load(stream)
        info.update(CFBundleName="Porch", CFBundleDisplayName="Porch",
                    CFBundleIdentifier=APP_ID, CFBundleExecutable="Porch",
                    CFBundleIconFile="Porch.icns")
        with info_path.open("wb") as stream:
            plistlib.dump(info, stream)
        (staged / "Contents" / "MacOS" / "Electron").rename(staged / "Contents" / "MacOS" / "Porch")
        for helper in list((staged / "Contents" / "Frameworks").glob("Electron Helper*.app")):
            helper_info_path = helper / "Contents" / "Info.plist"
            with helper_info_path.open("rb") as stream:
                helper_info = plistlib.load(stream)
            suffix = helper.stem.removeprefix("Electron Helper").strip(" ()")
            label = f"Porch Helper ({suffix})" if suffix else "Porch Helper"
            helper_info.update(CFBundleName=label, CFBundleDisplayName=label,
                               CFBundleExecutable=label,
                               CFBundleIdentifier=f"{APP_ID}.helper{('.' + suffix.lower()) if suffix else ''}")
            with helper_info_path.open("wb") as stream:
                plistlib.dump(helper_info, stream)
            (helper / "Contents" / "MacOS" / helper.stem).rename(
                helper / "Contents" / "MacOS" / label)
            helper.rename(helper.with_name(f"{label}.app"))
        _icon(ui / "public" / "brand" / "porch-mark.png",
              staged / "Contents" / "Resources" / "Porch.icns")
        subprocess.run(["codesign", "--force", "--deep", "--sign", "-", str(staged)], check=True,
                       stdout=subprocess.DEVNULL)
        subprocess.run(["codesign", "--verify", "--deep", str(staged)], check=True)
        try:
            os.rename(staged, app)
        except FileExistsError:
            if not binary.is_file():
                raise
    finally:
        shutil.rmtree(temporary, ignore_errors=True)
    return binary
