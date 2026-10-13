# Alwan bdarija · ألوان بالدارجة

A small website to collect voice recordings of colour words in Moroccan Darija, for a research
project on learning words from speech and images only (no text), the way a child does.

Each participant records series of 20 cards (each of the first four series covers all 11 colours; the fifth has the last 8 cards), out of 88: 11 colours × 8 phrase types (the word alone, "هادي كورة حمرا",
"شوف الكورة الحمرا", the plural "جوج كورات حومر", a free description…). Every card shows a drawn
object in a random shade of the colour; each colour appears once on each of the 8 objects, so the
shape never gives the colour away. The image shown is saved with the recording.

- `index.html`: the whole site (static, works on phones). Set `UPLOAD_URL` and `CONTACT` at the top of the script.
- `apps_script/Code.gs`: Google Apps Script web app that stores uploads in a Google Drive folder
  (setup steps in the file header).

Participants get a 6-character code; progress is remembered in the browser, and the code
lets them resume or ask for their recordings to be deleted. No names or e-mails are collected.
