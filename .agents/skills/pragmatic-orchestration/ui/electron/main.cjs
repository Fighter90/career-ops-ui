const { app, BrowserWindow, screen, session } = require("electron");
const path = require("node:path");

// Electron shifts application arguments when launched from a named .app bundle.
const target = process.argv.find((arg) => arg.startsWith("http://127.0.0.1:"));
let url;
try {
  url = new URL(target);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.pathname !== "/" ||
    !new URLSearchParams(url.hash.slice(1)).get("token")
  )
    throw new Error("Invalid observer URL");
} catch {
  console.error("Launch this window through porch ui --desktop.");
  process.exit(1);
}

app.setName("Porch");
app.whenReady().then(() => {
  const builtIn = screen
    .getAllDisplays()
    .find((display) => /built-in|retina|internal|macbook/i.test(display.label));
  if (process.env.PORCH_UI_DISPLAY === "internal" && !builtIn) {
    console.error("Built-in display was requested but was not found.");
    app.quit();
    return;
  }
  const display = builtIn || screen.getPrimaryDisplay();
  const width = Math.min(1240, display.workArea.width - 40);
  const height = Math.min(840, display.workArea.height - 40);
  const icon = path.join(__dirname, "..", "public", "brand", "porch-mark.png");
  if (app.dock) app.dock.setIcon(icon);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  const window = new BrowserWindow({
    x: display.workArea.x + Math.round((display.workArea.width - width) / 2),
    y: display.workArea.y + Math.round((display.workArea.height - height) / 2),
    width,
    height,
    minWidth: 420,
    minHeight: 580,
    title: "Porch",
    icon,
    show: false,
    backgroundColor: "#fafaf8",
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.once("ready-to-show", () => window.show());
  window.webContents.on("will-navigate", (event, destination) => {
    if (new URL(destination).origin !== url.origin) event.preventDefault();
  });
  window.webContents.on("will-redirect", (event) => event.preventDefault());
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  session.defaultSession.on("will-download", (event, item) => {
    if (!item.getURL().startsWith(`blob:${url.origin}/`)) event.preventDefault();
    else item.setSaveDialogOptions({ title: "Save Porch output" });
  });
  void window.loadURL(target);
});
app.on("window-all-closed", () => app.quit());
