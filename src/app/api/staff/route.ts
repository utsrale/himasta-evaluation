import { NextResponse } from 'next/server';
import { getStaffList, getActivePeriod, getEvaluations } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const evaluatorId = searchParams.get('evaluatorId');

    const staffList = await getStaffList();
    const activePeriod = await getActivePeriod();

    if (!activePeriod) {
      return NextResponse.json({ error: 'Tidak ada periode penilaian yang aktif saat ini.' }, { status: 400 });
    }

    // Find evaluator by email or ID
    let evaluator = null;
    if (email) {
      evaluator = staffList.find((s) => s.email === email.trim().toLowerCase());
    } else if (evaluatorId) {
      evaluator = staffList.find((s) => s.id === evaluatorId);
    }

    // If no evaluator found, return all staff (stripped of emails for privacy)
    if (!evaluator) {
      if (email || evaluatorId) {
        return NextResponse.json({ error: 'Penilai tidak ditemukan.' }, { status: 404 });
      }
      const publicStaffList = staffList.map(({ email, ...rest }) => rest);
      return NextResponse.json({ staff: publicStaffList, activePeriod });
    }

    // Get evaluations already completed by this evaluator in the active period
    const allEvals = await getEvaluations(activePeriod.id);
    const doneEvaluations = allEvals.filter(
      (e) => e.evaluatorId === evaluator.id
    );
    const doneTargetIds = new Set(doneEvaluations.map((e) => e.targetId));


    const isPleno = activePeriod.type === 'pleno';

    if (isPleno && evaluator.role === 'director_vice') {
      return NextResponse.json({ error: 'Director & Vice Director tidak melakukan penilaian pada periode Rapat Pleno.' }, { status: 403 });
    }

    let availableStaff = [];

    if (isPleno) {
      if (evaluator.role === 'pht') {
        // PHT evaluates staff and other PHTs in their department (excluding self)
        availableStaff = staffList.filter(
          (s) => s.department === evaluator.department &&
            (s.role === 'staff' || (s.role === 'pht' && s.id !== evaluator.id)) &&
            !doneTargetIds.has(s.id)
        );
      } else {
        // Staff evaluates other staff (excl self) + PHT in their department
        availableStaff = staffList.filter(
          (s) => s.department === evaluator.department &&
            (s.role === 'pht' || (s.role === 'staff' && s.id !== evaluator.id)) &&
            !doneTargetIds.has(s.id)
        );
      }
    } else {
      if (evaluator.role === 'director_vice') {
        // Directors and Vice Directors can evaluate staff in any department
        availableStaff = staffList.filter((s) => s.role === 'staff' && !doneTargetIds.has(s.id));
      } else if (evaluator.role === 'pht') {
        // PHT evaluates staff and other PHTs in their department (excluding self)
        availableStaff = staffList.filter(
          (s) => s.department === evaluator.department &&
            (s.role === 'staff' || (s.role === 'pht' && s.id !== evaluator.id)) &&
            !doneTargetIds.has(s.id)
        );
      } else {
        // Staff can evaluate staff in their department, including themselves
        availableStaff = staffList.filter(
          (s) => s.department === evaluator.department && s.role === 'staff' && !doneTargetIds.has(s.id)
        );
      }
    }

    // Hitung total target yang seharusnya bisa dinilai (tanpa filter "sudah selesai")
    let totalTargets = 0;
    if (isPleno) {
      if (evaluator.role === 'pht') {
        totalTargets = staffList.filter(
          (s) => s.department === evaluator.department &&
            (s.role === 'staff' || (s.role === 'pht' && s.id !== evaluator.id))
        ).length;
      } else {
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
          (s) => s.department === evaluator.department &&
            (s.role === 'staff' || (s.role === 'pht' && s.id !== evaluator.id))
        ).length;
      } else {
        totalTargets = staffList.filter(
          (s) => s.department === evaluator.department && s.role === 'staff'
        ).length;
      }
    }

    // Strip emails from response objects to prevent leakage
    const safeAvailableStaff = availableStaff.map(({ email, ...rest }) => rest);
    const { email: evaluatorEmail, ...safeEvaluator } = evaluator;

    return NextResponse.json({
      staff: safeAvailableStaff,
      evaluator: safeEvaluator,
      activePeriod,
      progress: {
        done: doneEvaluations.length,
        total: totalTargets,
        isFinished: doneEvaluations.length >= totalTargets && totalTargets > 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
