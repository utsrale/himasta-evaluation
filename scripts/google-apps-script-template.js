/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: WEBHOOK SYNC REKAPITULASI MAGISTA 2026 (HIMASTA UNS)
 * =========================================================================
 * 
 * Menghasilkan otomatis 10 Sheet persis seperti file Excel referensi:
 * 1. "Data Rekap Rapi" (Master Rekapitulasi 103 Peserta)
 * 2. 9 Sheet Departemen: "Sekre", "Finance", "HC", "TA", "SE", "PR", "Acent", "Bisdev", "Medbrand"
 * 
 * PANDUAN PEMASANGAN / UPDATE (1 Menit):
 * 1. Buka spreadsheet Anda di Google Spreadsheet (https://sheets.new atau file yang sudah ada)
 * 2. Klik menu: Extensions (Ekstensi) > Apps Script
 * 3. Hapus kode lama, lalu salin dan tempel SELURUH KODE di bawah ini.
 * 4. Klik tombol "Deploy" (Terapkan) berwarna biru di kanan atas:
 *    - Jika baru pertama kali: Pilih "New deployment" > jenis "Web app".
 *    - Jika update: Pilih "Manage deployments" (Kelola penerapan) > klik ikon Pensil (Edit) > pilih Version: "New version" (Versi baru).
 * 5. Atur:
 *    - Description: "Webhook Penilaian MAGISTA 10 Sheets"
 *    - Execute as: "Me" (Saya)
 *    - Who has access: "Anyone" (Siapa saja)  <-- PENTING!
 * 6. Klik "Deploy", izinkan izin akses akun jika diminta.
 * 7. Salin URL Web app (akhiran /exec) dan simpan di Dashboard Admin HIMASTA.
 * 8. Klik tombol "Sync ke Spreadsheet ⚡" di Dashboard Admin HIMASTA!
 */

function doPost(e) {
  try {
    var raw = e.postData.contents;
    var data = JSON.parse(raw);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // =========================================================================
    // 1. MASTER SHEET: "Data Rekap Rapi"
    // =========================================================================
    var masterSheetName = "Data Rekap Rapi";
    var masterSheet = ss.getSheetByName(masterSheetName) || ss.getSheetByName("Rekap Nilai MAGISTA 2026");
    if (!masterSheet) {
      masterSheet = ss.insertSheet(masterSheetName);
    } else {
      masterSheet.setName(masterSheetName);
    }
    masterSheet.clear();
    
    var masterHeaders = [
      "No",
      "NIM",
      "Nama Mahasiswa",
      "Departemen",
      "Rata-rata FGD",
      "Rata-rata Magang Bidang",
      "Predikat Magang Bidang",
      "Rata-rata Magang Angkatan",
      "Predikat Magang Angkatan",
      "Nilai Akhir Gabungan",
      "Predikat Akhir"
    ];
    
    masterSheet.appendRow(masterHeaders);
    var masterHeaderRange = masterSheet.getRange(1, 1, 1, masterHeaders.length);
    masterHeaderRange.setFontWeight("bold");
    masterHeaderRange.setBackground("#EA580C"); // Burnt Orange Groovy
    masterHeaderRange.setFontColor("#FFFFFF");
    masterHeaderRange.setHorizontalAlignment("center");
    
    var rows = data.rows || [];
    var rowData = [];
    var bgColors = [];
    
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      rowData.push([
        r.no,
        "'" + r.nim,
        r.name,
        r.department,
        r.fgdAverage,
        r.bidangAverage,
        r.bidangPredicate,
        r.angkatanAverage,
        r.angkatanPredicate,
        r.finalAverage,
        r.finalPredicate
      ]);
      
      var rowBg = [];
      var color = (i % 2 === 0) ? "#FFFDF9" : "#FFF7ED";
      for (var c = 0; c < masterHeaders.length; c++) {
        rowBg.push(color);
      }
      bgColors.push(rowBg);
    }
    
    if (rowData.length > 0) {
      var dataRange = masterSheet.getRange(2, 1, rowData.length, masterHeaders.length);
      dataRange.setValues(rowData);
      dataRange.setBackgrounds(bgColors);
      
      masterSheet.getRange(2, 1, rowData.length, 1).setHorizontalAlignment("center");
      masterSheet.getRange(2, 2, rowData.length, 1).setHorizontalAlignment("center");
      masterSheet.getRange(2, 3, rowData.length, 2).setHorizontalAlignment("left");
      masterSheet.getRange(2, 5, rowData.length, masterHeaders.length - 4).setHorizontalAlignment("center");
    }
    
    for (var mc = 1; mc <= masterHeaders.length; mc++) {
      masterSheet.autoResizeColumn(mc);
    }
    
    // =========================================================================
    // 2. DEPARTMENT SHEETS (9 BIDANG): "Sekre", "Finance", "HC", dll.
    // =========================================================================
    var departmentSheets = data.departmentSheets || {};
    var deptOrder = [
      "Sekre", "Finance", "HC", "TA", "SE", "PR", "Acent", "Bisdev", "Medbrand"
    ];
    
    // Pastikan semua departemen diproses sesuai urutan
    var allDeptKeys = [];
    for (var d = 0; d < deptOrder.length; d++) {
      if (departmentSheets[deptOrder[d]]) allDeptKeys.push(deptOrder[d]);
    }
    for (var k in departmentSheets) {
      if (allDeptKeys.indexOf(k) === -1) allDeptKeys.push(k);
    }
    
    for (var dIdx = 0; dIdx < allDeptKeys.length; dIdx++) {
      var deptName = allDeptKeys[dIdx];
      var deptData = departmentSheets[deptName];
      if (!deptData || deptData.length === 0) continue;
      
      var deptSheet = ss.getSheetByName(deptName);
      if (!deptSheet) {
        deptSheet = ss.insertSheet(deptName);
      }
      deptSheet.clear();
      
      var numRows = deptData.length;
      var numCols = 12;
      
      var bgMatrix = [];
      var weightMatrix = [];
      var colorMatrix = [];
      var alignMatrix = [];
      
      for (var r = 0; r < numRows; r++) {
        var row = deptData[r];
        var bgs = [];
        var weights = [];
        var colors = [];
        var aligns = [];
        
        var firstCell = (row[0] !== undefined && row[0] !== null) ? row[0].toString().trim() : "";
        
        if (firstCell.indexOf("(") !== -1 && row[4] === "No") {
          // Banner Nama Mahasiswa & Header Magang Bidang
          for (var c = 0; c < numCols; c++) {
            bgs.push("#EA580C"); // Burnt Orange
            weights.push("bold");
            colors.push("#FFFFFF");
            aligns.push(c < 4 ? "left" : "center");
          }
        } else if (firstCell === "No") {
          // Sub-header kolom (Point Penilaian, Nilai, Predikat, dll)
          for (var c = 0; c < numCols; c++) {
            bgs.push("#FED7AA"); // Warm Peach
            weights.push("bold");
            colors.push("#431407");
            aligns.push(c === 1 || c === 5 ? "left" : "center");
          }
        } else if (firstCell === "Rata - rata") {
          // Baris Ringkasan Rata - rata
          for (var c = 0; c < numCols; c++) {
            bgs.push(c === 3 ? "#FFFFFF" : "#FFEDD5");
            weights.push("bold");
            colors.push("#9A3412");
            aligns.push(c === 1 || c === 5 ? "left" : "center");
          }
        } else if (firstCell === "" && (!row[1] || row[1] === "")) {
          // Baris Pemisah Kosong antar peserta
          for (var c = 0; c < numCols; c++) {
            bgs.push("#FFFFFF");
            weights.push("normal");
            colors.push("#000000");
            aligns.push("center");
          }
        } else {
          // Baris Data Indikator 1 s/d 5
          for (var c = 0; c < numCols; c++) {
            bgs.push(c === 3 ? "#FFFFFF" : "#FFFDF9");
            weights.push("normal");
            colors.push("#1C1917");
            aligns.push(c === 1 || c === 5 ? "left" : "center");
          }
        }
        
        bgMatrix.push(bgs);
        weightMatrix.push(weights);
        colorMatrix.push(colors);
        alignMatrix.push(aligns);
      }
      
      // Tulis nilai dan format secara batch (Ultra Cepat)
      var targetRange = deptSheet.getRange(1, 1, numRows, numCols);
      targetRange.setValues(deptData);
      targetRange.setBackgrounds(bgMatrix);
      targetRange.setFontWeights(weightMatrix);
      targetRange.setFontColors(colorMatrix);
      targetRange.setHorizontalAlignments(alignMatrix);
      
      // Penataan lebar kolom agar rapi persis template Excel
      deptSheet.setColumnWidth(1, 45); // No FGD
      deptSheet.autoResizeColumn(2);   // Point Penilaian FGD
      deptSheet.autoResizeColumn(3);   // FGD Nilai
      deptSheet.setColumnWidth(4, 25); // Kolom Pemisah (Spacer)
      deptSheet.setColumnWidth(5, 45); // No Bidang
      deptSheet.autoResizeColumn(6);   // Point Penilaian Bidang
      deptSheet.autoResizeColumn(7);   // Nilai Bidang
      deptSheet.autoResizeColumn(8);   // Predikat Bidang
      deptSheet.autoResizeColumn(9);   // Nilai Angkatan
      deptSheet.autoResizeColumn(10);  // Predikat Angkatan
      deptSheet.autoResizeColumn(11);  // Nilai Gabungan
      deptSheet.autoResizeColumn(12);  // Predikat Gabungan
    }
    
    // =========================================================================
    // 3. RAPAIKAN URUTAN SHEET & HAPUS SHEET1 BAWAAN
    // =========================================================================
    ss.setActiveSheet(masterSheet);
    ss.moveActiveSheet(1);
    
    for (var oIdx = 0; oIdx < allDeptKeys.length; oIdx++) {
      var targetDeptSheet = ss.getSheetByName(allDeptKeys[oIdx]);
      if (targetDeptSheet) {
        ss.setActiveSheet(targetDeptSheet);
        ss.moveActiveSheet(oIdx + 2);
      }
    }
    ss.setActiveSheet(masterSheet);
    
    // Hapus sheet default kosong jika ada
    var defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Sheet 1") || ss.getSheetByName("Halaman 1");
    if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
      try {
        ss.deleteSheet(defaultSheet);
      } catch (err) {}
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "10 Sheet MAGISTA 2026 berhasil disinkronkan ke Google Spreadsheet!",
      timestamp: new Date().toISOString(),
      masterRowsCount: rows.length,
      departmentSheetsCount: allDeptKeys.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Webhook Penilaian MAGISTA HIMASTA Aktif dan Siap Menerima Data.");
}
