/**
 * Receives recordings from the Alwan bdarija page and stores them in Google Drive.
 *
 * Setup (once):
 *  1. In Google Drive, create a folder (e.g. "alwan_recordings"). Open it and copy the id
 *     at the end of the URL: drive.google.com/drive/folders/<FOLDER_ID>
 *  2. Go to script.google.com -> New project, paste this file, put the id below.
 *  3. Deploy -> New deployment -> type "Web app"
 *       Execute as: Me    Who has access: Anyone
 *     Authorise, then copy the web app URL (https://script.google.com/macros/s/.../exec)
 *     into UPLOAD_URL in index.html.
 *  After editing this script, use Deploy -> Manage deployments -> edit -> New version,
 *  so the URL stays the same.
 *
 * Layout in Drive: <folder>/<participant code>/<card id>.{webm|m4a|ogg, png, json}
 * Re-recording a card replaces its files. Every answer is JSON ({ok:true} or {ok:false, error}),
 * including on unexpected errors; "busy" tells the page to retry a moment later.
 */
const FOLDER_ID = "PASTE_FOLDER_ID_HERE";
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_META_CHARS = 20000;
const MAX_UPLOADS_PER_CODE_PER_MINUTE = 20;   // a person records far fewer
const MAX_UPLOADS_PER_MINUTE = 600;           // everyone together
const EXT = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg" };

function doPost(e) {
  try {
    return reply(handle(e));
  } catch (err) {
    return reply({ ok: false, error: "server: " + String(err).slice(0, 120) });
  }
}

function handle(e) {
  let d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return { ok: false, error: "bad json" };
  }
  // Codes use the page's alphabet (no 0, 1, O, I); card ids are "<colour>_<object>_<question>".
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(d.speaker || "") || !/^[a-z]+_[a-z_]{1,40}$/.test(d.id || "")) {
    return { ok: false, error: "bad request" };
  }
  if (!rateOk(d.speaker)) return { ok: false, error: "busy" };

  const audio = Utilities.base64Decode(d.audio || "");
  if (!audio.length || audio.length > MAX_AUDIO_BYTES) return { ok: false, error: "bad audio" };
  const image = d.image ? Utilities.base64Decode(d.image) : null;
  if (image && image.length > MAX_IMAGE_BYTES) return { ok: false, error: "bad image" };
  const metaText = JSON.stringify(Object.assign({}, d.meta || {}, {
    speaker: d.speaker, id: d.id, mime: String(d.mime || ""), received: new Date().toISOString() }), null, 1);
  if (metaText.length > MAX_META_CHARS) return { ok: false, error: "bad meta" };
  const mime = String(d.mime || "audio/webm").split(";")[0];
  const ext = EXT[mime] || "webm";

  const folder = participantFolder(d.speaker);
  if (!folder) return { ok: false, error: "busy" };
  ["webm", "m4a", "ogg", "png", "json"].forEach(function (x) {
    const old = folder.getFilesByName(d.id + "." + x);
    while (old.hasNext()) old.next().setTrashed(true);
  });
  folder.createFile(Utilities.newBlob(audio, mime, d.id + "." + ext));
  if (image) folder.createFile(Utilities.newBlob(image, "image/png", d.id + ".png"));
  folder.createFile(d.id + ".json", metaText, "application/json");
  return { ok: true };
}

// The lock only covers finding or creating the participant's folder (so two uploads cannot create it
// twice); the file writes run in parallel. If the lock is not free quickly, the page retries.
function participantFolder(speaker) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return null;
  try {
    const root = DriveApp.getFolderById(FOLDER_ID);
    const found = root.getFoldersByName(speaker);
    return found.hasNext() ? found.next() : root.createFolder(speaker);
  } finally {
    lock.releaseLock();
  }
}

// Simple per-minute counters, per participant code and overall.
function rateOk(speaker) {
  const cache = CacheService.getScriptCache();
  const minute = Math.floor(Date.now() / 60000);
  const bump = function (key, max) {
    const n = Number(cache.get(key) || 0) + 1;
    cache.put(key, String(n), 120);
    return n <= max;
  };
  return bump("all_" + minute, MAX_UPLOADS_PER_MINUTE) && bump(speaker + "_" + minute, MAX_UPLOADS_PER_CODE_PER_MINUTE);
}

function doGet() {
  return reply({ ok: true, service: "alwan bdarija upload" });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
