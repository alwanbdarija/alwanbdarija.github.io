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
 * Layout in Drive: <folder>/<participant code>/<prompt id>.{webm|m4a|ogg, png, json}
 * Re-recording a card replaces its files.
 */
const FOLDER_ID = "PASTE_FOLDER_ID_HERE";
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const EXT = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg" };

function doPost(e) {
  let d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: "bad json" });
  }
  if (!/^[A-Z0-9]{6}$/.test(d.speaker || "") || !/^[a-z]+_[a-z_]+$/.test(d.id || "")) {
    return reply({ ok: false, error: "bad request" });
  }
  const audio = Utilities.base64Decode(d.audio || "");
  if (!audio.length || audio.length > MAX_AUDIO_BYTES) return reply({ ok: false, error: "bad audio" });
  const mime = String(d.mime || "audio/webm").split(";")[0];
  const ext = EXT[mime] || "webm";

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);  // avoid two uploads creating the same participant folder twice
  try {
    const root = DriveApp.getFolderById(FOLDER_ID);
    const found = root.getFoldersByName(d.speaker);
    const folder = found.hasNext() ? found.next() : root.createFolder(d.speaker);
    ["webm", "m4a", "ogg", "png", "json"].forEach(function (x) {
      const old = folder.getFilesByName(d.id + "." + x);
      while (old.hasNext()) old.next().setTrashed(true);
    });

    folder.createFile(Utilities.newBlob(audio, mime, d.id + "." + ext));
    if (d.image) folder.createFile(Utilities.newBlob(Utilities.base64Decode(d.image), "image/png", d.id + ".png"));
    const meta = Object.assign({}, d.meta || {}, { speaker: d.speaker, id: d.id, mime: mime, received: new Date().toISOString() });
    folder.createFile(d.id + ".json", JSON.stringify(meta, null, 1), "application/json");
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

function doGet() {
  return reply({ ok: true, service: "alwan bdarija upload" });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
