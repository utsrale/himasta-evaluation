import { NextResponse } from 'next/server';
import { getStaffById, getActivePeriod, addEvaluation } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      evaluatorId,
      targetId,
      scoreSikap,
      scoreKomunikasi,
      scoreImprovement,
      scoreProfesionalisme,
      scoreLeadership,
    } = body;

    // Validate fields
    if (!evaluatorId || !targetId) {
      return NextResponse.json({ error: 'Data penilai dan staf yang dinilai harus lengkap.' }, { status: 400 });
    }

    const scores = [scoreSikap, scoreKomunikasi, scoreImprovement, scoreProfesionalisme, scoreLeadership];
    if (scores.some((s) => typeof s !== 'number' || s < 1 || s > 10)) {
      return NextResponse.json({ error: 'Nilai indikator harus berupa angka antara 1 sampai 10.' }, { status: 400 });
    }

    const activePeriod = await getActivePeriod();
    if (!activePeriod) {
      return NextResponse.json({ error: 'Tidak ada periode penilaian yang aktif saat ini.' }, { status: 400 });
    }

    const evaluator = await getStaffById(evaluatorId);
    const target = await getStaffById(targetId);

    if (!evaluator) {
      return NextResponse.json({ error: 'Penilai tidak ditemukan.' }, { status: 404 });
    }
    if (!target) {
      return NextResponse.json({ error: 'Staf yang dinilai tidak ditemukan.' }, { status: 404 });
    }

    // Validate department restriction
    if (evaluator.role !== 'director_vice' && evaluator.department !== target.department) {
      return NextResponse.json({ error: 'Anda hanya diperbolehkan menilai staf dari departemen Anda sendiri.' }, { status: 403 });
    }

    // Validate target role: only 'staff' role can be evaluated
    if (target.role !== 'staff') {
      return NextResponse.json({ error: 'Hanya staf yang dapat dinilai.' }, { status: 403 });
    }

    // Validate self-evaluation: only 'staff' role can evaluate themselves
    if (evaluatorId === targetId && evaluator.role !== 'staff') {
      return NextResponse.json({ error: 'Hanya staff yang diperbolehkan melakukan penilaian diri sendiri.' }, { status: 403 });
    }

    // Insert evaluation
    const evaluation = await addEvaluation({
      periodId: activePeriod.id,
      evaluatorId,
      targetId,
      scoreSikap,
      scoreKomunikasi,
      scoreImprovement,
      scoreProfesionalisme,
      scoreLeadership,
    });

    return NextResponse.json({ success: true, evaluation });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menyimpan penilaian.' }, { status: 500 });
  }
}
