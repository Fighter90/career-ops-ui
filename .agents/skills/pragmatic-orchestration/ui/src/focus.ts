export function readFocus(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const mine = params.get("scope") === "mine" && !!params.get("launcher");
  return {
    mine,
    launcher: mine ? params.get("launcher") || "" : "",
    instance: mine ? params.get("instance") || "" : "",
    run: params.get("run") || "",
  };
}
