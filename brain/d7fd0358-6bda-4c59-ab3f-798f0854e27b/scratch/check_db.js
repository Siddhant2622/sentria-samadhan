const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/sentria.db');

db.all("SELECT id, title, media_urls FROM complaints ORDER BY created_at DESC LIMIT 5", [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
