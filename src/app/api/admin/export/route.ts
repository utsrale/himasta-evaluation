import { NextResponse } from 'next/server';
import { getStaffList, getEvaluations, getPeriods } from '@/lib/db';
import { isValidPasscode } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get('periodId');
    const token = searchParams.get('token');

    // Check passcode auth (passed as query param since it's a file download link)
    if (!token || !isValidPasscode(token)) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!periodId) {
      return new Response('Parameter periodId diperlukan.', { status: 400 });
    }

    const periods = await getPeriods();
    const period = periods.find((p) => p.id === periodId);
    if (!period) {
      return new Response('Periode tidak ditemukan.', { status: 404 });
    }

    const staffList = await getStaffList();
    const evaluations = await getEvaluations(periodId);

    // 1. Prepare Data_Rapi (Raw Evaluations)
    const rawData = evaluations.map((e, index) => {
      const evaluator = staffList.find((s) => s.id === e.evaluatorId);
      const target = staffList.find((s) => s.id === e.targetId);
      const overall = (
        e.scoreSikap +
        e.scoreKomunikasi +
        e.scoreImprovement +
        e.scoreProfesionalisme +
        e.scoreLeadership
      ) / 5;

      return {
        'No': index + 1,
        'Waktu Submit': new Date(e.createdAt).toLocaleString('id-ID'),
        'Nama Penilai': evaluator ? evaluator.name : 'Unknown',
        'Departemen Penilai': evaluator ? evaluator.department : 'Unknown',
        'Jabatan Penilai': evaluator ? evaluator.jabatan : 'Unknown',
        'Staf yang Dinilai': target ? target.name : 'Unknown',
        'Departemen Staf': target ? target.department : 'Unknown',
        'Sikap & Etika': e.scoreSikap,
        'Kerjasama & Komunikasi': e.scoreKomunikasi,
        'Self Improvement': e.scoreImprovement,
        'Profesionalisme': e.scoreProfesionalisme,
        'Leadership': e.scoreLeadership,
        'Rata-rata Nilai': Math.round(overall * 100) / 100,
      };
    });

    // 2. Prepare Ranking (only for staff, exclude PHT and BPH)
    const rankings = staffList.filter((s) => s.role === 'staff').map((staff) => {
      const staffEvals = evaluations.filter((e) => e.targetId === staff.id);
      const staffEvaluators = staffEvals.map((e) => ({
        eval: e,
        evaluator: staffList.find((s) => s.id === e.evaluatorId),
      })).filter(item => item.evaluator !== undefined);

      const staffGroup = staffEvaluators.filter(item => item.evaluator!.role === 'staff');
      const phtGroup = staffEvaluators.filter(item => item.evaluator!.role === 'pht');
      const directorGroup = staffEvaluators.filter(item => item.evaluator!.role === 'director_vice');

      const calcGroupAvg = (group: typeof staffEvaluators) => {
        if (group.length === 0) return null;
        const sum = group.reduce((acc, curr) => {
          const evalAvg = (
            curr.eval.scoreSikap +
            curr.eval.scoreKomunikasi +
            curr.eval.scoreImprovement +
            curr.eval.scoreProfesionalisme +
            curr.eval.scoreLeadership
          ) / 5;
          return acc + evalAvg;
        }, 0);
        return sum / group.length;
      };

      const avgStaff = calcGroupAvg(staffGroup);
      const avgPht = calcGroupAvg(phtGroup);
      const avgDirector = calcGroupAvg(directorGroup);

      let totalWeight = 0;
      let weightedSum = 0;

      if (avgStaff !== null) {
        totalWeight += 0.4;
        weightedSum += avgStaff * 0.4;
      }
      if (avgPht !== null) {
        totalWeight += 0.5;
        weightedSum += avgPht * 0.5;
      }
      if (avgDirector !== null) {
        totalWeight += 0.1;
        weightedSum += avgDirector * 0.1;
      }

      const finalScore = totalWeight > 0 ? (weightedSum / totalWeight) : 0;

      let category = 'Belum Dinilai';
      if (totalWeight > 0) {
        if (finalScore >= 8.5) category = 'Sangat Baik';
        else if (finalScore >= 7.0) category = 'Baik';
        else if (finalScore >= 5.5) category = 'Cukup';
        else if (finalScore >= 4.0) category = 'Kurang';
        else category = 'Sangat Kurang';
      }

      return {
        name: staff.name,
        department: staff.department,
        jabatan: staff.jabatan,
        countStaff: staffGroup.length,
        avgStaff: avgStaff !== null ? Math.round(avgStaff * 100) / 100 : null,
        countPht: phtGroup.length,
        avgPht: avgPht !== null ? Math.round(avgPht * 100) / 100 : null,
        countDirector: directorGroup.length,
        avgDirector: avgDirector !== null ? Math.round(avgDirector * 100) / 100 : null,
        totalEvaluations: staffEvals.length,
        finalScore: Math.round(finalScore * 100) / 100,
        category,
      };
    });

    // Sort by score
    rankings.sort((a, b) => b.finalScore - a.finalScore || a.name.localeCompare(b.name));

    const rankingRows = rankings.map((r, index) => ({
      'Rank': r.totalEvaluations > 0 ? index + 1 : '-',
      'Nama Staf': r.name,
      'Departemen': r.department,
      'Jabatan': r.jabatan,
      'Rata-rata Nilai Staff (40%)': r.avgStaff !== null ? r.avgStaff : '-',
      'Jumlah Penilai Staff': r.countStaff,
      'Rata-rata Nilai PHT (50%)': r.avgPht !== null ? r.avgPht : '-',
      'Jumlah Penilai PHT': r.countPht,
      'Rata-rata Nilai Dir/Wadir (10%)': r.avgDirector !== null ? r.avgDirector : '-',
      'Jumlah Penilai Dir/Wadir': r.countDirector,
      'Total Penilai': r.totalEvaluations,
      'Nilai Akhir (Weighted)': r.totalEvaluations > 0 ? r.finalScore : '-',
      'Kategori Performa': r.category,
    }));

    // Generate sheet and workbook
    const wb = XLSX.utils.book_new();
    const wsRank = XLSX.utils.json_to_sheet(rankingRows);
    XLSX.utils.book_append_sheet(wb, wsRank, 'Ranking Staf');

    const wsRaw = XLSX.utils.json_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, wsRaw, 'Data Rapi');

    const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const periodSlug = period.name.replace(/\s+/g, '_');
    const filename = `Rekap_Penilaian_HIMASTA_${periodSlug}.xlsx`;

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return new Response(error.message || 'Gagal mengekspor file.', { status: 500 });
  }
}
