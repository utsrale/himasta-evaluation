import { NextResponse } from 'next/server';
import { getStaffList, getEvaluations, getPeriods, deleteEvaluationById, deleteEvaluationsByEvaluator } from '@/lib/db';
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
    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get('periodId');

    if (!periodId) {
      return NextResponse.json({ error: 'Parameter periodId diperlukan.' }, { status: 400 });
    }

    const staffList = await getStaffList();
    const evaluations = await getEvaluations(periodId);
    
    // Fetch all periods to determine the type of the selected period
    const periods = await getPeriods();
    const period = periods.find((p) => p.id === periodId);
    const isPleno = period?.type === 'pleno';
    
    // 1. Prepare raw evaluations data (Data Rapi) with name lookups
    const rawData = evaluations.map((e) => {
      const evaluator = staffList.find((s) => s.id === e.evaluatorId);
      const target = staffList.find((s) => s.id === e.targetId);
      
      const overallScore = isPleno ? (
        (e.scorePlenoRespect || 0) +
        (e.scorePlenoDisiplin || 0) +
        (e.scorePlenoAktifProker || 0) +
        (e.scorePlenoKepanitiaan || 0) +
        (e.scorePlenoPartisipasiLain || 0) +
        (e.scorePlenoKomunikasiGrup || 0) +
        (e.scorePlenoTanggungJawab || 0)
      ) / 7 : (
        e.scoreSikap +
        e.scoreKomunikasi +
        e.scoreImprovement +
        e.scoreProfesionalisme +
        e.scoreLeadership
      ) / 5;

      return {
        id: e.id,
        evaluatorId: e.evaluatorId,
        targetId: e.targetId,
        evaluatorName: evaluator ? evaluator.name : 'Unknown',
        evaluatorDept: evaluator ? evaluator.department : 'Unknown',
        evaluatorRole: evaluator ? evaluator.role : 'Unknown',
        targetName: target ? target.name : 'Unknown',
        targetDept: target ? target.department : 'Unknown',
        scoreSikap: e.scoreSikap,
        scoreKomunikasi: e.scoreKomunikasi,
        scoreImprovement: e.scoreImprovement,
        scoreProfesionalisme: e.scoreProfesionalisme,
        scoreLeadership: e.scoreLeadership,
        scorePlenoRespect: e.scorePlenoRespect || 0,
        scorePlenoDisiplin: e.scorePlenoDisiplin || 0,
        scorePlenoAktifProker: e.scorePlenoAktifProker || 0,
        scorePlenoKepanitiaan: e.scorePlenoKepanitiaan || 0,
        scorePlenoPartisipasiLain: e.scorePlenoPartisipasiLain || 0,
        scorePlenoKomunikasiGrup: e.scorePlenoKomunikasiGrup || 0,
        scorePlenoTanggungJawab: e.scorePlenoTanggungJawab || 0,
        overallScore: Math.round(overallScore * 100) / 100,
        createdAt: e.createdAt,
      };
    });

    // 2. Calculate rankings
    const targetRolesForRanking = isPleno ? ['staff', 'pht'] : ['staff'];
    const rankings = staffList.filter((s) => targetRolesForRanking.includes(s.role)).map((staff) => {
      // Find all evaluations for this staff member
      const staffEvals = evaluations.filter((e) => e.targetId === staff.id);
      
      const staffEvaluators = staffEvals.map((e) => ({
        eval: e,
        evaluator: staffList.find((s) => s.id === e.evaluatorId),
      })).filter(item => item.evaluator !== undefined);

      // Separate by evaluator roles
      const staffGroup = staffEvaluators.filter(item => item.evaluator!.role === 'staff');
      const phtGroup = staffEvaluators.filter(item => item.evaluator!.role === 'pht');
      const directorGroup = staffEvaluators.filter(item => item.evaluator!.role === 'director_vice');

      const calcGroupAvg = (group: typeof staffEvaluators) => {
        if (group.length === 0) return null;
        const sum = group.reduce((acc, curr) => {
          const evalAvg = isPleno ? (
            (curr.eval.scorePlenoRespect || 0) +
            (curr.eval.scorePlenoDisiplin || 0) +
            (curr.eval.scorePlenoAktifProker || 0) +
            (curr.eval.scorePlenoKepanitiaan || 0) +
            (curr.eval.scorePlenoPartisipasiLain || 0) +
            (curr.eval.scorePlenoKomunikasiGrup || 0) +
            (curr.eval.scorePlenoTanggungJawab || 0)
          ) / 7 : (
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

      // Calculate final score: simple average for pleno, weighted for routine
      let finalScore = 0;
      if (isPleno) {
        if (staffEvals.length > 0) {
          const sumOfEvals = staffEvals.reduce((acc, curr) => {
            const evalAvg = (
              (curr.scorePlenoRespect || 0) +
              (curr.scorePlenoDisiplin || 0) +
              (curr.scorePlenoAktifProker || 0) +
              (curr.scorePlenoKepanitiaan || 0) +
              (curr.scorePlenoPartisipasiLain || 0) +
              (curr.scorePlenoKomunikasiGrup || 0) +
              (curr.scorePlenoTanggungJawab || 0)
            ) / 7;
            return acc + evalAvg;
          }, 0);
          finalScore = sumOfEvals / staffEvals.length;
        }
      } else {
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

        finalScore = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
      }

      // Determine category
      let category = 'Belum Dinilai';
      const hasEvaluations = isPleno ? staffEvals.length > 0 : (avgStaff !== null || avgPht !== null || avgDirector !== null);
      if (hasEvaluations) {
        if (finalScore >= 8.5) category = 'Sangat Baik';
        else if (finalScore >= 7.0) category = 'Baik';
        else if (finalScore >= 5.5) category = 'Cukup';
        else if (finalScore >= 4.0) category = 'Kurang';
        else category = 'Sangat Kurang';
      }

      return {
        staffId: staff.id,
        name: staff.name,
        department: staff.department,
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

    // Sort rankings from highest final score to lowest
    // If scores are equal, sort alphabetically by name
    rankings.sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      return a.name.localeCompare(b.name);
    });

    // Add rank index
    const rankedList = rankings.map((r, index) => ({
      rank: r.totalEvaluations > 0 ? index + 1 : '-',
      ...r,
    }));

    // 3. Calculate evaluator progress (who has/hasn't completed evaluations)
    const evaluatorProgress = staffList
      .filter((evaluator) => {
        // Exclude director/vice director from evaluator progress if pleno
        if (isPleno && evaluator.role === 'director_vice') return false;
        return true;
      })
      .map((evaluator) => {
        let totalTargets = 0;
        if (isPleno) {
          if (evaluator.role === 'pht') {
            totalTargets = staffList.filter(
              (s) => s.department === evaluator.department &&
                (s.role === 'staff' || (s.role === 'pht' && s.id !== evaluator.id))
            ).length;
          } else if (evaluator.role === 'staff') {
            totalTargets = staffList.filter(
              (s) => s.department === evaluator.department &&
                (s.role === 'pht' || (s.role === 'staff' && s.id !== evaluator.id))
            ).length;
          }
        } else {
          if (evaluator.role === 'director_vice') {
            totalTargets = staffList.filter((s) => s.role === 'staff').length;
          } else if (evaluator.role === 'pht') {
            totalTargets = staffList.filter(
              (s) => s.department === evaluator.department && s.role === 'staff'
            ).length;
          } else {
            totalTargets = staffList.filter(
              (s) => s.department === evaluator.department && s.role === 'staff'
            ).length;
          }
        }

        const doneCount = evaluations.filter((e) => e.evaluatorId === evaluator.id).length;

        return {
          id: evaluator.id,
          name: evaluator.name,
          department: evaluator.department,
          role: evaluator.role,
          jabatan: evaluator.jabatan,
          totalTargets,
          doneCount,
          isComplete: doneCount >= totalTargets && totalTargets > 0,
        };
      });

    return NextResponse.json({
      rawEvaluations: rawData,
      rankings: rankedList,
      evaluatorProgress,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const evaluatorId = searchParams.get('evaluatorId');
    const periodId = searchParams.get('periodId');

    if (id) {
      // Opsi A: Hapus data penilaian tunggal
      await deleteEvaluationById(id);
      return NextResponse.json({ success: true, message: 'Penilaian berhasil dihapus.' });
    } else if (evaluatorId && periodId) {
      // Opsi B: Hapus seluruh penilaian dari penilai tersebut
      await deleteEvaluationsByEvaluator(evaluatorId, periodId);
      return NextResponse.json({ success: true, message: 'Seluruh penilaian oleh penilai tersebut berhasil dihapus.' });
    } else {
      return NextResponse.json({ error: 'Parameter tidak valid. Diperlukan id atau kombinasi evaluatorId dan periodId.' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus data.' }, { status: 500 });
  }
}
