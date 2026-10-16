import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { getStaffList, getPeriods, getEvaluations, getScorePredicate } from '@/lib/db';
import { isValidPasscode } from '@/lib/auth';

function checkAuth(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const queryToken = searchParams.get('token');
  if (queryToken && isValidPasscode(queryToken)) return true;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.split(' ')[1];
  return isValidPasscode(token);
}

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

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allStaff = await getStaffList();
    const allPeriods = await getPeriods();
    const allEvaluations = await getEvaluations();

    const interns = allStaff.filter((s) => s.role === 'intern');

    const fgdPeriodIds = new Set(allPeriods.filter((p) => p.type === 'magista_fgd').map((p) => p.id));
    const bidangPeriodIds = new Set(allPeriods.filter((p) => p.type === 'magista_bidang').map((p) => p.id));
    const angkatanPeriodIds = new Set(allPeriods.filter((p) => p.type === 'magista_angkatan').map((p) => p.id));

    // Helper to calculate score averages
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

    const workbook = xlsx.utils.book_new();

    // 1. Generate Department Sheets
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

        // Header Rows for this intern block
        sheetData.push([
          `${intern.name} (${nim})`, null, null, null,
          'No', 'Point Penilaian', 'Magang Bidang', null, 'Magang Angkatan', null, 'Rata - rata'
        ]);
        sheetData.push([
          'No', 'Point Penilaian', 'FGD', null, null, null,
          'Nilai', 'Predikat', 'Nilai', 'Predikat', 'Nilai', 'Predikat'
        ]);

        // Indicator Rows 1 to 5
        for (let idx = 0; idx < 5; idx++) {
          const fgdVal = fgd ? fgd.scores[idx] : '-';
          const bidangVal = bidang ? bidang.scores[idx] : '-';
          const bidangPred = bidang ? getScorePredicate(bidang.scores[idx]).label : '-';
          const angkatanVal = angkatan ? angkatan.scores[idx] : '-';
          const angkatanPred = angkatan ? getScorePredicate(angkatan.scores[idx]).label : '-';

          // Combined average for this indicator
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
            null,
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
          null,
          fgd ? fgd.average : '-',
          null,
          'Rata - rata',
          null,
          bidang ? bidang.average : '-',
          bidang ? bidang.predicate : '-',
          angkatan ? angkatan.average : '-',
          angkatan ? angkatan.predicate : '-',
          finalComboAvg,
          finalComboPred,
        ]);

        // Blank spacer row
        sheetData.push([]);
      }

      const worksheet = xlsx.utils.aoa_to_sheet(sheetData);
      xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    // 2. Generate Master Sheet 'Data Rekap Rapi'
    const masterRows: any[] = [];
    interns.forEach((intern, index) => {
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

      masterRows.push({
        'No': index + 1,
        'NIM': nim,
        'Nama Mahasiswa': intern.name,
        'Departemen': intern.department,
        'Rata-rata FGD': fgd ? fgd.average : '-',
        'Rata-rata Magang Bidang': bidang ? bidang.average : '-',
        'Predikat Magang Bidang': bidang ? bidang.predicate : '-',
        'Rata-rata Magang Angkatan': angkatan ? angkatan.average : '-',
        'Predikat Magang Angkatan': angkatan ? angkatan.predicate : '-',
        'Nilai Akhir Gabungan': finalAvg,
        'Predikat Akhir': finalPred,
      });
    });

    const masterSheet = xlsx.utils.json_to_sheet(masterRows);
    xlsx.utils.book_append_sheet(workbook, masterSheet, 'Data Rekap Rapi');

    // Generate buffer
    const buf = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="Rekap_Nilai_MAGISTA_2026_${new Date().toISOString().slice(0, 10)}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error: any) {
    console.error('Error generating MAGISTA Excel export:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengekspor Excel' }, { status: 500 });
  }
}
