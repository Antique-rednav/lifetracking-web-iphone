/**
 * Dashboard Pribadi — penyimpanan di Google Sheets.
 * Pasang di: Spreadsheet > Ekstensi > Apps Script.
 * Token rahasia disimpan di Script Properties (BUKAN di kode):
 *   Project Settings > Script Properties > tambah APP_TOKEN = (token yang sama dengan APP_TOKEN di Netlify)
 */
var CHUNK = 45000; // batas sel Sheets 50.000 karakter
var STATE_SHEET = '_state';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var expected = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
    if (!expected || body.token !== expected) return out_({ ok: false, error: 'Token salah' });
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (body.action === 'pull') return out_({ ok: true, state: readState_() });
      if (body.action === 'push') {
        writeState_(body.state);
        writeTables_(body.tables || {});
        return out_({ ok: true });
      }
      return out_({ ok: false, error: 'Aksi tidak dikenal' });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doGet() { return out_({ ok: true, info: 'Dashboard Pribadi Web App aktif. Gunakan POST.' }); }

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function readState_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(STATE_SHEET);
  if (!sh || sh.getLastRow() < 1) return null;
  var vals = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  var s = vals.map(function (r) { return r[0]; }).join('');
  return s ? JSON.parse(s) : null;
}

function writeState_(state) {
  if (!state || state.v !== 2) throw new Error('State tidak valid');
  var json = JSON.stringify(state);
  var rows = [];
  for (var i = 0; i < json.length; i += CHUNK) rows.push([json.substr(i, CHUNK)]);
  var sh = sheet_(STATE_SHEET);
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 1).setNumberFormat('@').setValues(rows);
  sh.hideSheet();
}

function writeTables_(tables) {
  Object.keys(tables).forEach(function (name) {
    var rows = tables[name];
    if (!rows || !rows.length) return;
    var sh = sheet_(name);
    var width = rows[0].length;
    rows = rows.map(function (r) {
      var o = r.slice(0, width);
      while (o.length < width) o.push('');
      return o;
    });
    sh.clearContents();
    sh.getRange(1, 1, rows.length, width).setValues(rows);
    sh.getRange(1, 1, 1, width).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
}
