function doGet(e) {
  try {
    var action = (e.parameter.action || "").trim();
    var result = null;
    if (action === "stats") {
      result = withCache_(
        cacheKey_("stats", { from: e.parameter.from, to: e.parameter.to, group: e.parameter.group || "day" }),
        function () {
          return getStats_(e);
        },
        90
      );
      return json_(result);
    }
    if (action === "activities") {
      result = withCache_(cacheKey_("activities", {}), function () {
        return getActivities_();
      }, 120);
      return json_(result);
    }
    if (action === "activitiesAdmin") {
      result = withCache_(cacheKey_("activitiesAdmin", { code: e.parameter.code || e.parameter.adminCode || "" }), function () {
        return getActivitiesAdmin_(e);
      }, 120);
      return json_(result);
    }
    if (action === "encouragement") {
      result = withCache_(cacheKey_("encouragement", {}), function () {
        return getEncouragement_();
      }, 120);
      return json_(result);
    }
    if (action === "encouragementAdmin") {
      result = withCache_(
        cacheKey_("encouragementAdmin", { code: e.parameter.code || e.parameter.adminCode || "" }),
        function () {
          return getEncouragementAdmin_(e);
        },
        120
      );
      return json_(result);
    }
    if (action === "ipdOpenCases") {
      result = withCache_(cacheKey_("ipdOpenCases", { code: e.parameter.code || e.parameter.unitCode || "" }), function () {
        return getIpdOpenCases_(e);
      }, 30);
      return json_(result);
    }
    return json_({ error: "unknown action" });
  } catch (err) {
    return json_({ error: err.message || String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    var action = (body.action || "").trim();
    var result = null;
    if (action === "addStatsRow") result = postAddStatsRow_(body);
    else if (action === "addIpdAdmit") result = postAddIpdAdmit_(body);
    else if (action === "addIpdDischarge") result = postAddIpdDischarge_(body);
    else if (action === "addActivity") result = postAddActivity_(body);
    else if (action === "addEncouragement") result = postAddEncouragement_(body);
    else if (action === "deleteRow") result = postDeleteRow_(body);
    else if (action === "updateRow") result = postUpdateRow_(body);
    else return json_({ error: "unknown action" });

    // write สำเร็จเมื่อใด ให้ invalidation cache ทั้งระบบทันที
    if (result && result.ok === true) {
      bumpCacheVersion_();
    }

    return json_(result);
  } catch (err) {
    return json_({ error: err.message || String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getProp_(name, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(name);
  return v || fallback || "";
}

function firstNonEmpty_() {
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] !== undefined && arguments[i] !== null && String(arguments[i]).trim() !== "") {
      return String(arguments[i]).trim();
    }
  }
  return "";
}

function cacheVersion_() {
  return getProp_("CACHE_VERSION", "1");
}

function cacheKey_(action, payload) {
  var raw = action + "|" + cacheVersion_() + "|" + JSON.stringify(payload || {});
  return raw.substring(0, 250);
}

function withCache_(key, producerFn, ttlSeconds) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(key);
  if (cached) return JSON.parse(cached);
  var value = producerFn();
  var ttl = Number(ttlSeconds || 120);
  cache.put(key, JSON.stringify(value), ttl);
  return value;
}

function bumpCacheVersion_() {
  var props = PropertiesService.getScriptProperties();
  var current = Number(getProp_("CACHE_VERSION", "1"));
  props.setProperty("CACHE_VERSION", String(current + 1));
}

function checkUnitCode_(code) {
  if (!code || code !== getProp_("UNIT_CODE")) throw new Error("unit code ไม่ถูกต้อง");
}

function checkAdminCode_(code) {
  if (!code || code !== getProp_("ADMIN_CODE")) throw new Error("admin code ไม่ถูกต้อง");
}

function parseDate_(s) {
  if (!s) return null;
  var d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
}

function toDateKey_(d) {
  return Utilities.formatDate(d, "Asia/Bangkok", "yyyy-MM-dd");
}

function periodKey_(d, group) {
  if (group === "day") return Utilities.formatDate(d, "Asia/Bangkok", "yyyy-MM-dd");
  if (group === "month") return Utilities.formatDate(d, "Asia/Bangkok", "yyyy-MM");
  if (group === "year") return Utilities.formatDate(d, "Asia/Bangkok", "yyyy");
  // week
  var onejan = new Date(d.getFullYear(), 0, 1);
  var day = Math.floor((d - onejan) / 86400000);
  var week = Math.ceil((day + onejan.getDay() + 1) / 7);
  return d.getFullYear() + "-W" + ("0" + week).slice(-2);
}

function statsSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function activitiesSpreadsheet_() {
  var id = getProp_("ACTIVITIES_SHEET_ID");
  if (!id) throw new Error("ยังไม่ได้ตั้งค่า ACTIVITIES_SHEET_ID");
  return SpreadsheetApp.openById(id);
}

function encouragementSpreadsheet_() {
  var id = getProp_("ENCOURAGEMENT_SHEET_ID");
  if (!id) throw new Error("ยังไม่ได้ตั้งค่า ENCOURAGEMENT_SHEET_ID");
  return SpreadsheetApp.openById(id);
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }

  // เขียน header เฉพาะตอนจำเป็น เพื่อลด write operation และให้โหลดเร็วขึ้น
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    var currentHeaders = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    var needsUpdate = false;
    for (var i = 0; i < headers.length; i++) {
      if (String(currentHeaders[i] || "") !== String(headers[i] || "")) {
        needsUpdate = true;
        break;
      }
    }
    if (needsUpdate) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sh;
}

function getStats_(e) {
  var from = parseDate_(e.parameter.from);
  var to = parseDate_(e.parameter.to);
  var group = e.parameter.group || "day";
  if (!from || !to) throw new Error("from/to ไม่ถูกต้อง");

  var rowsMap = {};
  var wardMap = {};
  var losSum = 0;
  var losCount = 0;

  var ss = statsSpreadsheet_();
  var opdSh = ensureSheet_(ss, "OPD", ["Date", "Count"]);
  var consultSh = ensureSheet_(ss, "Consult", ["Date", "Count"]);
  var ipdSh = ensureSheet_(ss, "IPD_Stays", ["HN", "Ward", "AdmitDate", "DischargeDate", "LOS"]);

  function ensureBucket_(key) {
    if (!rowsMap[key]) rowsMap[key] = { key: key, opd: 0, consult: 0, ipdAdmit: 0, ipdDischarge: 0 };
    return rowsMap[key];
  }

  function sumCountSheet_(sh, target) {
    var values = sh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      var d = parseDate_(values[i][0]);
      var c = Number(values[i][1] || 0);
      if (!d || d < from || d > to) continue;
      var k = periodKey_(d, group);
      ensureBucket_(k)[target] += c;
    }
  }

  sumCountSheet_(opdSh, "opd");
  sumCountSheet_(consultSh, "consult");

  var ipdValues = ipdSh.getDataRange().getValues();
  for (var r = 1; r < ipdValues.length; r++) {
    var hn = String(ipdValues[r][0] || "");
    var ward = String(ipdValues[r][1] || "");
    var admitDate = parseDate_(ipdValues[r][2]);
    var dischargeDate = parseDate_(ipdValues[r][3]);
    var los = Number(ipdValues[r][4] || 0);

    if (ward && !wardMap[ward]) wardMap[ward] = { ward: ward, admit: 0, discharge: 0 };

    if (admitDate && admitDate >= from && admitDate <= to) {
      ensureBucket_(periodKey_(admitDate, group)).ipdAdmit += 1;
      if (ward) wardMap[ward].admit += 1;
    }
    if (dischargeDate && dischargeDate >= from && dischargeDate <= to) {
      ensureBucket_(periodKey_(dischargeDate, group)).ipdDischarge += 1;
      if (ward) wardMap[ward].discharge += 1;
      if (los > 0 && hn) {
        losSum += los;
        losCount += 1;
      }
    }
  }

  var rows = Object.keys(rowsMap)
    .sort()
    .map(function (k) {
      return rowsMap[k];
    });

  var wardStats = Object.keys(wardMap)
    .sort()
    .map(function (k) {
      return wardMap[k];
    });

  return {
    rows: rows,
    wardStats: wardStats,
    avgLosDays: losCount ? losSum / losCount : 0,
  };
}

function postAddStatsRow_(body) {
  checkUnitCode_(body.code);
  var sheetName = body.sheetName;
  if (sheetName !== "OPD" && sheetName !== "Consult") throw new Error("sheetName ไม่ถูกต้อง");
  var date = body.date;
  var count = Number(body.count || 0);

  var sh = ensureSheet_(statsSpreadsheet_(), sheetName, ["Date", "Count"]);
  sh.appendRow([date, count]);
  return { ok: true };
}

function postAddIpdAdmit_(body) {
  checkUnitCode_(body.code);
  var hn = String(body.hn || "").trim();
  var ward = String(body.ward || "").trim();
  var admitDate = String(body.admitDate || "").trim();
  if (!hn || !ward || !admitDate) throw new Error("ข้อมูลไม่ครบ");
  var sh = ensureSheet_(statsSpreadsheet_(), "IPD_Stays", ["HN", "Ward", "AdmitDate", "DischargeDate", "LOS"]);
  sh.appendRow([hn, ward, admitDate, "", ""]);
  return { ok: true };
}

function postAddIpdDischarge_(body) {
  checkUnitCode_(body.code);
  var hn = String(body.hn || "").trim();
  var dischargeDate = parseDate_(body.dischargeDate);
  if (!hn || !dischargeDate) throw new Error("ข้อมูลไม่ครบ");

  var sh = ensureSheet_(statsSpreadsheet_(), "IPD_Stays", ["HN", "Ward", "AdmitDate", "DischargeDate", "LOS"]);
  var values = sh.getDataRange().getValues();

  for (var i = values.length - 1; i >= 1; i--) {
    var rowHn = String(values[i][0] || "").trim();
    var admit = parseDate_(values[i][2]);
    var dc = parseDate_(values[i][3]);
    if (rowHn === hn && admit && !dc) {
      var los = Math.max(1, Math.round((dischargeDate - admit) / 86400000));
      sh.getRange(i + 1, 4).setValue(toDateKey_(dischargeDate));
      sh.getRange(i + 1, 5).setValue(los);
      return { ok: true, los: los };
    }
  }
  throw new Error("ไม่พบเคสค้างของ HN นี้");
}

function getIpdOpenCases_(e) {
  checkUnitCode_(firstNonEmpty_(e.parameter.code, e.parameter.unitCode));
  var sh = ensureSheet_(statsSpreadsheet_(), "IPD_Stays", ["HN", "Ward", "AdmitDate", "DischargeDate", "LOS"]);
  var values = sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var hn = String(values[i][0] || "");
    var ward = String(values[i][1] || "");
    var admitDate = String(values[i][2] || "");
    var dischargeDate = String(values[i][3] || "");
    if (hn && admitDate && !dischargeDate) rows.push({ hn: hn, ward: ward, admitDate: admitDate });
  }
  return { rows: rows };
}

function getActivities_() {
  var sh = ensureSheet_(activitiesSpreadsheet_(), "Activities", [
    "id",
    "date",
    "title",
    "detail",
    "type",
    "imageUrl",
    "imageCaption",
    "youtubeUrl",
    "externalUrl",
  ]);
  return { rows: toObjects_(sh.getDataRange().getValues()) };
}

function getActivitiesAdmin_(e) {
  checkAdminCode_(firstNonEmpty_(e.parameter.code, e.parameter.adminCode));
  return getActivities_();
}

function postAddActivity_(body) {
  checkAdminCode_(firstNonEmpty_(body.code, body.adminCode));
  var sh = ensureSheet_(activitiesSpreadsheet_(), "Activities", [
    "id",
    "date",
    "title",
    "detail",
    "type",
    "imageUrl",
    "imageCaption",
    "youtubeUrl",
    "externalUrl",
  ]);
  sh.appendRow([
    Utilities.getUuid(),
    body.date || "",
    body.title || "",
    body.detail || "",
    body.type || "",
    body.imageUrl || "",
    body.imageCaption || "",
    body.youtubeUrl || "",
    body.externalUrl || "",
  ]);
  return { ok: true };
}

function getEncouragement_() {
  var sh = ensureSheet_(encouragementSpreadsheet_(), "Encouragement", ["id", "date", "name", "message"]);
  return { rows: toObjects_(sh.getDataRange().getValues()) };
}

function getEncouragementAdmin_(e) {
  checkAdminCode_(firstNonEmpty_(e.parameter.code, e.parameter.adminCode));
  return getEncouragement_();
}

function postAddEncouragement_(body) {
  checkUnitCode_(firstNonEmpty_(body.code, body.unitCode));
  var senderName = firstNonEmpty_(body.name, body.author);
  var sh = ensureSheet_(encouragementSpreadsheet_(), "Encouragement", ["id", "date", "name", "message"]);
  sh.appendRow([Utilities.getUuid(), toDateKey_(new Date()), senderName, body.message || ""]);
  return { ok: true };
}

function postDeleteRow_(body) {
  checkAdminCode_(firstNonEmpty_(body.code, body.adminCode));
  var sh = targetSheet_(body.sheetType);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(body.rowId)) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  throw new Error("ไม่พบข้อมูลที่ต้องการลบ");
}

function postUpdateRow_(body) {
  checkAdminCode_(firstNonEmpty_(body.code, body.adminCode));
  var sh = targetSheet_(body.sheetType);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(body.rowId)) {
      if (body.sheetType === "activities") {
        sh.getRange(i + 1, 1, 1, 9).setValues([[
          body.rowId,
          body.date || "",
          body.title || "",
          body.detail || "",
          body.type || "",
          body.imageUrl || "",
          body.imageCaption || "",
          body.youtubeUrl || "",
          body.externalUrl || "",
        ]]);
      } else {
        sh.getRange(i + 1, 1, 1, 4).setValues([[
          body.rowId,
          body.date || "",
          body.name || "",
          body.message || "",
        ]]);
      }
      return { ok: true };
    }
  }
  throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข");
}

function targetSheet_(sheetType) {
  if (sheetType === "activities") {
    return ensureSheet_(activitiesSpreadsheet_(), "Activities", [
      "id",
      "date",
      "title",
      "detail",
      "type",
      "imageUrl",
      "imageCaption",
      "youtubeUrl",
      "externalUrl",
    ]);
  }
  if (sheetType === "encouragement") {
    return ensureSheet_(encouragementSpreadsheet_(), "Encouragement", ["id", "date", "name", "message"]);
  }
  throw new Error("sheetType ไม่ถูกต้อง");
}

function toObjects_(values) {
  if (!values || values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    for (var c = 0; c < headers.length; c++) {
      row[headers[c]] = values[i][c];
    }
    rows.push(row);
  }
  return rows;
}
