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

    const payload = {
      action: 'sync_magista',
      timestamp: new Date().toISOString(),
      source: 'himasta-evaluation',
      totalInterns: rows.length,
      rows,
    };

    const gsheetsResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const resultText = await gsheetsResponse.text();

    return NextResponse.json({
      success: true,
      message: 'Data MAGISTA berhasil dikirim ke Google Spreadsheet.',
      gsheetsStatus: gsheetsResponse.status,
      response: resultText,
    });
  } catch (error: any) {
    console.error('Error syncing with Google Sheets:', error);
    return NextResponse.json({ error: error.message || 'Gagal menyinkronkan dengan Google Sheets' }, { status: 500 });
  }
}
