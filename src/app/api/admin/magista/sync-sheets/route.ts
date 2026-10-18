import { NextResponse } from 'next/server';
import { getStaffList, getPeriods, getEvaluations, getScorePredicate } from '@/lib/db';
import { isValidPasscode } from '@/lib/auth';

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.split(' ')[1];
  return isValidPasscode(token);
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const webhookUrl = body.webhookUrl || process.env.GOOGLE_SHEETS_WEBHOOK_URL;

    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
      return NextResponse.json({ error: 'URL Google Apps Script Webhook tidak valid.' }, { status: 400 });
    }

    if (webhookUrl.includes('docs.google.com/spreadsheets')) {
      return NextResponse.json({
        error: 'URL yang dimasukkan adalah link spreadsheet biasa. Yang dibutuhkan adalah "Web App URL" dari Google Apps Script (berakhiran /exec dari menu Deploy > New deployment).'
      }, { status: 400 });
    }

    if (!webhookUrl.includes('script.google.com') || !webhookUrl.endsWith('/exec')) {
      return NextResponse.json({
        error: 'URL Webhook harus berasal dari Google Apps Script dan berakhiran "/exec" (contoh: https://script.google.com/macros/s/AKfycb.../exec). Jangan gunakan link /edit atau /dev.'
      }, { status: 400 });
    }

    const allStaff = await getStaffList();
    const allPeriods = await getPeriods();
    const allEvaluations = await getEvaluations();

    const interns = allStaff.filter((s) => s.role === 'intern');

    const fgdPeriodIds = new Set(allPeriods.filter((p) => p.type === 'magista_fgd').map((p) => p.id));
    const bidangPeriodIds = new Set(allPeriods.filter((p) => p.type === 'magista_bidang').map((p) => p.id));
    const angkatanPeriodIds = new Set(allPeriods.filter((p) => p.type === 'magista_angkatan').map((p) => p.id));

    const getAvgScores = (evals: typeof allEvaluations) => {
      if (!evals || evals.length === 0) return null;
      const n = evals.length;
      const s = [
        evals.reduce((sum, e) => sum + e.scoreSikap, 0) / n,
        evals.reduce((sum, e) => sum + e.scoreKomunikasi, 0) / n,
        evals.reduce((sum, e) => sum + e.scoreImprovement, 0) / n,
        evals.reduce((sum, e) => sum + e.scoreProfesionalisme, 0) / n,
        evals.reduce((sum, e) => sum + e.scoreLeadership, 0) / n,
      ];
      const avg = s.reduce((a, b) => a + b, 0) / 5;
      return {
        scores: s.map((v) => Number(v.toFixed(2))),
        average: Number(avg.toFixed(2)),
        predicate: getScorePredicate(avg).label,
      };
    };

    const rows = interns.map((intern, index) => {
      const nimMatch = intern.jabatan.match(/\d{14}/) || intern.email.match(/\d{14}/);
      const nim = nimMatch ? nimMatch[0] : '';
      const internEvals = allEvaluations.filter((e) => e.targetId === intern.id);

      const fgd = getAvgScores(internEvals.filter((e) => fgdPeriodIds.has(e.periodId)));
      const bidang = getAvgScores(internEvals.filter((e) => bidangPeriodIds.has(e.periodId)));
      const angkatan = getAvgScores(internEvals.filter((e) => angkatanPeriodIds.has(e.periodId)));

      const sessionAverages: number[] = [];
      if (fgd) sessionAverages.push(fgd.average);
      if (bidang) sessionAverages.push(bidang.average);
      if (angkatan) sessionAverages.push(angkatan.average);

      let finalAvg: any = '-';
      let finalPred = '-';
      if (sessionAverages.length > 0) {
        const sum = sessionAverages.reduce((a, b) => a + b, 0);
        finalAvg = Number((sum / (angkatan ? 3 : sessionAverages.length)).toFixed(2));
        finalPred = getScorePredicate(finalAvg).label;
      }

      return {
        no: index + 1,
        nim,
        name: intern.name,
        department: intern.department,
        fgdAverage: fgd ? fgd.average : '-',
        bidangAverage: bidang ? bidang.average : '-',
        bidangPredicate: bidang ? bidang.predicate : '-',
        angkatanAverage: angkatan ? angkatan.average : '-',
        angkatanPredicate: angkatan ? angkatan.predicate : '-',
        finalAverage: finalAvg,
        finalPredicate: finalPred,
      };
    });

    // 2. Generate Department Sheets Data (100% identical to Excel export)
    const DEPT_MAP: Record<string, string> = {
      'Finance': 'Finance',
      'Secretary': 'Sekre',
      'Social Event': 'SE',
      'Academic and Achievement': 'Acent',
      'Public Relation': 'PR',
      'Business Development': 'Bisdev',
      'Human Capital': 'HC',
      'Talent Acquisition': 'TA',
      'Media and Branding': 'Medbrand',
    };

    const FGD_INDICATOR_LABELS = [
      'Sikap dan etika',
      'Komunikasi',
      'Self improvement',
      'Kesesuaian Jawaban',
      'Leadership',
    ];

    const BIDANG_INDICATOR_LABELS = [
      'Sikap dan etika',
      'Kerja sama dan komunikasi',
      'Self improvement',
      'Profesionalisme',
      'Leadership',
    ];

    const departmentSheets: Record<string, any[][]> = {};

    for (const [deptFullName, sheetName] of Object.entries(DEPT_MAP)) {
      const deptInterns = interns.filter((i) => i.department === deptFullName);
      const sheetData: any[][] = [];

      for (const intern of deptInterns) {
        const nimMatch = intern.jabatan.match(/\d{14}/) || intern.email.match(/\d{14}/);
        const nim = nimMatch ? nimMatch[0] : '';
        const internEvals = allEvaluations.filter((e) => e.targetId === intern.id);

        const fgd = getAvgScores(internEvals.filter((e) => fgdPeriodIds.has(e.periodId)));
        const bidang = getAvgScores(internEvals.filter((e) => bidangPeriodIds.has(e.periodId)));
        const angkatan = getAvgScores(internEvals.filter((e) => angkatanPeriodIds.has(e.periodId)));

        // Header Rows for this intern block (12 columns)
        sheetData.push([
          `${intern.name} (${nim})`, '', '', '',
          'No', 'Point Penilaian', 'Magang Bidang', '', 'Magang Angkatan', '', 'Rata - rata', ''
        ]);
        sheetData.push([
          'No', 'Point Penilaian', 'FGD', '', '', '',
          'Nilai', 'Predikat', 'Nilai', 'Predikat', 'Nilai', 'Predikat'
        ]);

        // Indicator Rows 1 to 5
        for (let idx = 0; idx < 5; idx++) {
          const fgdVal = fgd ? fgd.scores[idx] : '-';
          const bidangVal = bidang ? bidang.scores[idx] : '-';
          const bidangPred = bidang ? getScorePredicate(bidang.scores[idx]).label : '-';
          const angkatanVal = angkatan ? angkatan.scores[idx] : '-';
          const angkatanPred = angkatan ? getScorePredicate(angkatan.scores[idx]).label : '-';

          let comboVals: number[] = [];
          if (fgd) comboVals.push(fgd.scores[idx]);
          if (bidang) comboVals.push(bidang.scores[idx]);
          if (angkatan) comboVals.push(angkatan.scores[idx]);

          let comboAvg: any = '-';
          let comboPred = '-';
          if (comboVals.length > 0) {
            const sum = comboVals.reduce((a, b) => a + b, 0);
            comboAvg = Number((sum / (angkatan ? 3 : comboVals.length)).toFixed(2));
            comboPred = getScorePredicate(comboAvg).label;
          }

          sheetData.push([
            idx + 1,
            FGD_INDICATOR_LABELS[idx],
            fgdVal,
            '',
            idx + 1,
            BIDANG_INDICATOR_LABELS[idx],
            bidangVal,
            bidangPred,
            angkatanVal,
            angkatanPred,
            comboAvg,
            comboPred,
          ]);
        }

        // Summary Row: Rata - rata
        let finalComboAvg: any = '-';
        let finalComboPred = '-';
        const sessionAverages: number[] = [];
        if (fgd) sessionAverages.push(fgd.average);
        if (bidang) sessionAverages.push(bidang.average);
        if (angkatan) sessionAverages.push(angkatan.average);

        if (sessionAverages.length > 0) {
          const sum = sessionAverages.reduce((a, b) => a + b, 0);
          finalComboAvg = Number((sum / (angkatan ? 3 : sessionAverages.length)).toFixed(2));
          finalComboPred = getScorePredicate(finalComboAvg).label;
        }

        sheetData.push([
          'Rata - rata',
          '',
          fgd ? fgd.average : '-',
          '',
          'Rata - rata',
          '',
          bidang ? bidang.average : '-',
          bidang ? bidang.predicate : '-',
          angkatan ? angkatan.average : '-',
          angkatan ? angkatan.predicate : '-',
          finalComboAvg,
          finalComboPred,
        ]);

        // Separator row (12 empty cells)
        sheetData.push(['', '', '', '', '', '', '', '', '', '', '', '']);
      }

      departmentSheets[sheetName] = sheetData;
    }

    const payload = {
      action: 'sync_magista',
      timestamp: new Date().toISOString(),
      source: 'himasta-evaluation',
      totalInterns: rows.length,
      rows,
      departmentSheets,
    };

    const gsheetsResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const resultText = await gsheetsResponse.text();

    // Cek apakah Google mengarahkan ke halaman login karena permission belum "Anyone"
    if (resultText.includes('<html') || resultText.includes('<!DOCTYPE') || resultText.includes('ServiceLogin') || resultText.includes('accounts.google.com')) {
      return NextResponse.json({
        error: 'Google Apps Script menolak akses (mengarahkan ke login). Pastikan pada Deploy > Manage deployments, set "Who has access" ke "Anyone" (Siapa saja).'
      }, { status: 403 });
    }

    let parsedResult: any = null;
    try {
      parsedResult = JSON.parse(resultText);
    } catch {
      // not JSON
    }

    if (parsedResult && parsedResult.status === 'error') {
      return NextResponse.json({
        error: `Google Apps Script Error: ${parsedResult.message || 'Terjadi kesalahan pada script spreadsheet.'}`
      }, { status: 500 });
    }

    if (!gsheetsResponse.ok) {
      return NextResponse.json({
        error: `Google Spreadsheet mengembalikan status HTTP ${gsheetsResponse.status}.`
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: 'Data MAGISTA berhasil dikirim ke Google Spreadsheet.',
      gsheetsStatus: gsheetsResponse.status,
      response: parsedResult || resultText,
    });
  } catch (error: any) {
    console.error('Error syncing with Google Sheets:', error);
    return NextResponse.json({ error: error.message || 'Gagal menyinkronkan dengan Google Sheets' }, { status: 500 });
  }
}
