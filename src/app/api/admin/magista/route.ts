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

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allStaff = await getStaffList();
    const allPeriods = await getPeriods();
    const allEvaluations = await getEvaluations();

    // 1. Separate core staff and interns
    const phts = allStaff.filter((s) => s.role === 'pht');
    const interns = allStaff.filter((s) => s.role === 'intern');

    // 2. Identify MAGISTA periods
    const fgdPeriods = allPeriods.filter((p) => p.type === 'magista_fgd');
    const bidangPeriods = allPeriods.filter((p) => p.type === 'magista_bidang');
    const angkatanPeriods = allPeriods.filter((p) => p.type === 'magista_angkatan');

    const fgdPeriodIds = new Set(fgdPeriods.map((p) => p.id));
    const bidangPeriodIds = new Set(bidangPeriods.map((p) => p.id));
    const angkatanPeriodIds = new Set(angkatanPeriods.map((p) => p.id));

    // Active period
    const activePeriod = allPeriods.find((p) => p.status === 'active');

    // 3. Department list
    const DEPARTMENTS = [
      'Secretary', 'Finance', 'Human Capital', 'Talent Acquisition',
      'Social Event', 'Public Relation', 'Academic and Achievement',
      'Business Development', 'Media and Branding'
    ];

    // 4. Calculate progress per department
    const departmentProgress = DEPARTMENTS.map((dept) => {
      const deptPHTs = phts.filter((p) => p.department === dept);
      const deptInterns = interns.filter((i) => i.department === dept);

      const phtProgress = deptPHTs.map((pht) => {
        let doneFgd = 0;
        let doneBidang = 0;

        if (activePeriod) {
          const doneActive = allEvaluations.filter(
            (e) => e.evaluatorId === pht.id && e.periodId === activePeriod.id
          ).length;
          return {
            id: pht.id,
            name: pht.name,
            jabatan: pht.jabatan,
            done: doneActive,
            total: deptInterns.length,
            isFinished: doneActive >= deptInterns.length && deptInterns.length > 0,
          };
        }

        return {
          id: pht.id,
          name: pht.name,
          jabatan: pht.jabatan,
          done: 0,
          total: deptInterns.length,
          isFinished: false,
        };
      });

      return {
        department: dept,
        totalInterns: deptInterns.length,
        totalPHT: deptPHTs.length,
        phts: phtProgress,
        allPhtFinished: phtProgress.every((p) => p.isFinished),
      };
    });

    // 5. Calculate scores per intern
    const internRecap = interns.map((intern) => {
      // NIM extracted from jabatan "Peserta Magang (21108062610001)" or email
      const nimMatch = intern.jabatan.match(/\d{14}/) || intern.email.match(/\d{14}/);
      const nim = nimMatch ? nimMatch[0] : intern.id.replace('intern_', '');

      // Evaluations received for this intern
      const internEvals = allEvaluations.filter((e) => e.targetId === intern.id);

      const fgdEvals = internEvals.filter((e) => fgdPeriodIds.has(e.periodId));
      const bidangEvals = internEvals.filter((e) => bidangPeriodIds.has(e.periodId));
      const angkatanEvals = internEvals.filter((e) => angkatanPeriodIds.has(e.periodId));

      const calcAverageScores = (evals: typeof internEvals) => {
        if (!evals || evals.length === 0) return null;
        const count = evals.length;
        const sikap = evals.reduce((sum, e) => sum + e.scoreSikap, 0) / count;
        const komunikasi = evals.reduce((sum, e) => sum + e.scoreKomunikasi, 0) / count;
        const improvement = evals.reduce((sum, e) => sum + e.scoreImprovement, 0) / count;
        const profesionalisme = evals.reduce((sum, e) => sum + e.scoreProfesionalisme, 0) / count;
        const leadership = evals.reduce((sum, e) => sum + e.scoreLeadership, 0) / count;
        const avg = (sikap + komunikasi + improvement + profesionalisme + leadership) / 5;

        return {
          evalCount: count,
          sikap: Number(sikap.toFixed(2)),
          komunikasi: Number(komunikasi.toFixed(2)),
          improvement: Number(improvement.toFixed(2)),
          profesionalisme: Number(profesionalisme.toFixed(2)),
          leadership: Number(leadership.toFixed(2)),
          average: Number(avg.toFixed(2)),
          predicate: getScorePredicate(avg),
        };
      };

      const fgdData = calcAverageScores(fgdEvals);
      const bidangData = calcAverageScores(bidangEvals);
      const angkatanData = calcAverageScores(angkatanEvals);

      // Final combined average
      let finalAvg: number | null = null;
      let finalPredicate = null;

      const availableAverages: number[] = [];
      if (fgdData) availableAverages.push(fgdData.average);
      if (bidangData) availableAverages.push(bidangData.average);
      if (angkatanData) availableAverages.push(angkatanData.average);

      if (availableAverages.length > 0) {
        // If all 3 are present, standard formula: (FGD + Bidang + Angkatan) / 3
        const sum = availableAverages.reduce((a, b) => a + b, 0);
        finalAvg = Number((sum / (angkatanData ? 3 : availableAverages.length)).toFixed(2));
        finalPredicate = getScorePredicate(finalAvg);
      }

      return {
        id: intern.id,
        nim,
        name: intern.name,
        department: intern.department,
        fgd: fgdData,
        bidang: bidangData,
        angkatan: angkatanData,
        finalAverage: finalAvg,
        finalPredicate,
      };
    });

    return NextResponse.json({
      departments: DEPARTMENTS,
      departmentProgress,
      activePeriod,
      fgdPeriods,
      bidangPeriods,
      angkatanPeriods,
      interns: internRecap,
    });
  } catch (error: any) {
    console.error('Error in MAGISTA recap API:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
