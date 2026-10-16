/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: WEBHOOK SYNC REKAPITULASI MAGISTA 2026 (HIMASTA UNS)
 * =========================================================================
 * 
 * PANDUAN PEMASANGAN (Hanya 1 Menit):
 * 1. Buka spreadsheet baru di Google Spreadsheet (https://sheets.new)
 * 2. Klik menu: Extensions (Ekstensi) > Apps Script
 * 3. Hapus kode default, lalu salin dan tempel SELURUH KODE di bawah ini.
 * 4. Klik tombol "Deploy" (Terapkan) berwarna biru di kanan atas > "New deployment" (Penerapan baru).
 * 5. Pilih jenis: "Web app" (Aplikasi web).
 * 6. Atur:
 *    - Description: "Webhook Penilaian MAGISTA"
 *    - Execute as: "Me" (Saya)
 *    - Who has access: "Anyone" (Siapa saja)  <-- PENTING agar website dapat mengirim data!
 * 7. Klik "Deploy", izinkan akses akun Google jika diminta.
 * 8. Salin "Web app URL" (akhiran /exec) dan tempelkan ke kolom Webhook di Dashboard Admin HIMASTA.
 */

function doPost(e) {
  try {
    var raw = e.postData.contents;
    var data = JSON.parse(raw);
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = "Rekap Nilai MAGISTA 2026";
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    sheet.clear(); // Bersihkan data lama untuk sinkronisasi mutakhir
    
    // 1. Header Tabel
    var headers = [
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
    
    sheet.appendRow(headers);
    
    // Format Header
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#EA580C"); // Burnt Orange Groovy
    headerRange.setFontColor("#FFFFFF");
    headerRange.setHorizontalAlignment("center");
    
    // 2. Data Rows
    var rows = data.rows || [];
    var rowData = [];
    
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      rowData.push([
        r.no,
        "'" + r.nim, // Prefix kutip satu agar NIM tidak terpotong format angka
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
    }
    
    if (rowData.length > 0) {
      sheet.getRange(2, 1, rowData.length, headers.length).setValues(rowData);
      
      // Zebra striping lembut & alignment
      for (var j = 2; j <= rowData.length + 1; j++) {
        if (j % 2 === 0) {
          sheet.getRange(j, 1, 1, headers.length).setBackground("#FFFDF9");
        } else {
          sheet.getRange(j, 1, 1, headers.length).setBackground("#FFF7ED");
        }
      }
      sheet.getRange(2, 1, rowData.length, 1).setHorizontalAlignment("center");
      sheet.getRange(2, 2, rowData.length, 1).setHorizontalAlignment("center");
      sheet.getRange(2, 5, rowData.length, headers.length - 4).setHorizontalAlignment("center");
    }
    
    // Auto-fit column widths
    for (var c = 1; c <= headers.length; c++) {
      sheet.autoResizeColumn(c);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data MAGISTA berhasil disinkronkan ke Google Spreadsheet!",
      timestamp: new Date().toISOString(),
      rowsCount: rows.length
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
