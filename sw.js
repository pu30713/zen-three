// sw.js (GitHub Pages / 靜態網站)
// 目的：離線/快取加速 + 仍能拿到最新題庫
// 策略：
// - index.html / questions.json：network-first（優先連線，失敗才用快取）
// - 其他靜態資源：cache-first（優先快取）

// Code.gs - 金剛經刷題小程序 (最終完美版)
const SHEET_QUESTIONS = "題庫";
const SHEET_STUDENTS = "學員名單";

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('金剛經刷題小程序')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getQuestionData() {
  const cache = CacheService.getScriptCache();
  // ★ 最終版金鑰
  const cacheKey = "question_db_final_gold"; 
  const cachedData = cache.get(cacheKey);

  if (cachedData != null) {
    return JSON.parse(cachedData);
  } else {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_QUESTIONS);
    if (!sheet) throw new Error(`找不到名為「${SHEET_QUESTIONS}」的分頁。`);
    
    // 強制讀取為文字 (DisplayValues)，避免數字格式問題
    const data = sheet.getDataRange().getDisplayValues(); 
    data.shift(); 
    
    const questions = data.map(row => {
      // ★ 資料清潔區：去空白、轉半形
      let a = String(row[7]).trim();
      // 全形轉半形 (０-９ -> 0-9)
      a = a.replace(/[\uff10-\uff19]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xfee0));
      // 移除句點
      a = a.replace(/\.$/, "");
      
      // 自動轉換中文是非
      if(a==="是"||a==="O"||a==="⭕") a="1";
      if(a==="非"||a==="否"||a==="X"||a==="❌") a="2";

      return {
        unit: row[0], qNum: row[1], qText: row[2],      
        options: [row[3], row[4], row[5], row[6]].filter(String), 
        ans: a, 
        explain: row[8]     
      };
    });
    // 快取設定為 20 分鐘 (正常運作模式)
    cache.put(cacheKey, JSON.stringify(questions), 1200);
    return questions;
  }
}

function getProgressSheetName(userClass) {
  if (userClass === "太谷一班") return "學員進度_太谷";
  if (userClass === "佛寶一班") return "學員進度_佛寶";
  return "學員進度_其他"; 
}

function saveUserProgress(studentId, name, unitIndex, score, userClass) {
  if (score < 80) return { status: "keep_trying", passCount: 0 };
  
  const lock = LockService.getScriptLock();
  if (lock.tryLock(30000)) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetName = getProgressSheetName(userClass);
      let sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(["時間", "班級", "學號", "法名", "單元索引", "分數"]);
      }

      let taiwanTime = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");
      sheet.appendRow([taiwanTime, userClass, studentId, name, unitIndex + 1, score]);
      SpreadsheetApp.flush();

      const currentCount = countPasses(sheet, studentId, unitIndex + 1);
      return { status: "success", passCount: currentCount };
    } catch (e) {
      return { status: "error", msg: e.toString() };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: "busy", msg: "系統忙碌中，請稍後再試。" };
  }
}

function countPasses(sheet, studentId, unitNum) {
  const data = sheet.getDataRange().getValues();
  const targetId = String(studentId).trim();
  const targetUnit = String(unitNum);
  let count = 0;
  for(let i=1; i<data.length; i++){
     if(String(data[i][2]).trim() === targetId && String(data[i][4]) === targetUnit && data[i][5] >= 80) { count++; }
  }
  return count;
}

function getStudentProgress(studentId, userClass) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getProgressSheetName(userClass);
  const sheet = ss.getSheetByName(sheetName);
  const result = {}; 
  if(!sheet) return result;
  
  const data = sheet.getDataRange().getValues();
  const targetId = String(studentId).trim();
  
  for(let i=1; i<data.length; i++){
    if(String(data[i][2]).trim() === targetId && data[i][5] >= 80){
       let u = data[i][4]; 
       if(!result[u]) result[u] = 0;
       result[u]++;
    }
  }
  return result;
}

function verifyStudentId(studentId) {
  const inputId = String(studentId).trim().toLowerCase();
  // 保留測試用帳號
  if (inputId === "b0636" || inputId === "b0763") {
     return { valid: true, className: "教授師", name: "教授師" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!sheet) return { valid: false, error: "系統找不到「學員名單」分頁" };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim().toLowerCase() === inputId) {
      return { valid: true, className: data[i][0], name: data[i][2] };
    }
  }
  return { valid: false };
}
