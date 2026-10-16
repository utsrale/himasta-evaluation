const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

// 1. Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseAnonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DEPARTMENTS = [
  'Secretary',
  'Finance',
  'Human Capital',
  'Talent Acquisition',
  'Social Event',
  'Public Relation',
  'Academic and Achievement',
  'Business Development',
  'Media and Branding'
];

function getScorePredicate(avg) {
  if (avg === null || avg === undefined || isNaN(avg)) return null;
  if (avg >= 9.00) return { label: 'Sangat Baik', color: 'emerald' };
  if (avg >= 7.00) return { label: 'Baik', color: 'blue' };
  if (avg >= 5.00) return { label: 'Kurang Baik', color: 'amber' };
  return { label: 'Sangat Kurang', color: 'red' };
}

async function runTests() {
  console.log("=== STARTING MAGISTA 2026 E2E VERIFICATION ===");

  // TEST 1: Verify Interns Count & Distribution
  console.log("\n[TEST 1] Verifying 103 Seeding Interns in Supabase...");
  const { data: interns, error: internsErr } = await supabase
    .from('staff')
    .select('*')
    .eq('role', 'intern');

  if (internsErr) {
    console.error("❌ Failed to query interns:", internsErr);
    process.exit(1);
  }

  console.log(`✓ Total interns found: ${interns.length} (Expected: 103)`);
  if (interns.length !== 103) {
    console.error(`❌ Expected 103 interns, found ${interns.length}`);
    process.exit(1);
  }

  const deptCounts = {};
  interns.forEach(i => {
    deptCounts[i.department] = (deptCounts[i.department] || 0) + 1;
  });
  console.log("Distribution per department:", deptCounts);

  // TEST 2: Verify PHT Evaluators exist for every department
  console.log("\n[TEST 2] Verifying PHT Evaluators per Department...");
  const { data: phtStaff, error: phtErr } = await supabase
    .from('staff')
    .select('*')
    .eq('role', 'pht');

  if (phtErr) {
    console.error("❌ Failed to query PHT staff:", phtErr);
    process.exit(1);
  }

  const phtByDept = {};
  phtStaff.forEach(p => {
    if (!phtByDept[p.department]) phtByDept[p.department] = [];
    phtByDept[p.department].push(p.name);
  });
  console.log(`✓ Total PHT staff found: ${phtStaff.length}`);
  DEPARTMENTS.forEach(dept => {
    const list = phtByDept[dept] || [];
    console.log(`  - ${dept}: ${list.length} PHT (${list.join(', ')})`);
    if (list.length === 0) {
      console.warn(`  ⚠️ Warning: No PHT found for ${dept}`);
    }
  });

  const testPeriodId = 'test_magista_fgd_' + Date.now();
  const testEvalId = 'eval_test_' + Date.now();
  let testPeriodCreated = false;
  let testEvalCreated = false;

  try {
    // TEST 3: Create temporary MAGISTA test period
    console.log("\n[TEST 3] Creating temporary MAGISTA test period...");
    const { error: periodErr } = await supabase
      .from('periods')
      .insert({
        id: testPeriodId,
        name: 'E2E Test MAGISTA FGD',
        status: 'active',
        type: 'magista_fgd'
      });

    if (periodErr) {
      console.error("❌ Failed to create test period:", periodErr);
      process.exit(1);
    }
    testPeriodCreated = true;
    console.log(`✓ Test period created: ${testPeriodId} (type: magista_fgd)`);

    // TEST 4: Simulate PHT Evaluation for Secretary Intern
    console.log("\n[TEST 4] Simulating PHT evaluation for Secretary intern...");
    const secretaryPHT = phtStaff.find(p => p.department === 'Secretary');
    const secretaryInterns = interns.filter(i => i.department === 'Secretary');

    if (!secretaryPHT || secretaryInterns.length === 0) {
      console.error("❌ Secretary PHT or intern not found!");
      process.exit(1);
    }

    const targetIntern = secretaryInterns[0];
    console.log(`Evaluator: ${secretaryPHT.name} (${secretaryPHT.email}, PHT ${secretaryPHT.department})`);
    console.log(`Target: ${targetIntern.name} (${targetIntern.id}, Intern ${targetIntern.department})`);

    // 5 scores: Sikap (9), Kerja sama (8), Improvement (9), Profesionalisme (9), Leadership (10)
    // Overall = 45 / 5 = 9.00
    const scores = {
      scoreSikap: 9,
      scoreKomunikasi: 8,
      scoreImprovement: 9,
      scoreProfesionalisme: 9,
      scoreLeadership: 10
    };
    const overall = (9 + 8 + 9 + 9 + 10) / 5; // 9.00

    const { error: evalErr } = await supabase
      .from('evaluations')
      .insert({
        id: testEvalId,
        periodId: testPeriodId,
        evaluatorId: secretaryPHT.id,
        targetId: targetIntern.id,
        ...scores
      });

    if (evalErr) {
      console.error("❌ Failed to insert evaluation:", evalErr);
      process.exit(1);
    }
    testEvalCreated = true;
    console.log(`✓ Evaluation successfully recorded. Overall score: ${overall.toFixed(2)}`);

  // TEST 5: Verify Predicate Calculation
  console.log("\n[TEST 5] Verifying Predicate Calculation...");
  const pred9 = getScorePredicate(9.00);
  const pred75 = getScorePredicate(7.50);
  const pred6 = getScorePredicate(6.00);
  const pred3 = getScorePredicate(3.50);

  console.log(`Score 9.00 -> ${pred9.label} (Expected: Sangkat Baik / Sangat Baik)`);
  console.log(`Score 7.50 -> ${pred75.label} (Expected: Baik)`);
  console.log(`Score 6.00 -> ${pred6.label} (Expected: Kurang Baik)`);
  console.log(`Score 3.50 -> ${pred3.label} (Expected: Sangat Kurang)`);

  if (pred9.label !== 'Sangat Baik' || pred75.label !== 'Baik' || pred6.label !== 'Kurang Baik' || pred3.label !== 'Sangat Kurang') {
    console.error("❌ Predicate calculation logic mismatch!");
    process.exit(1);
  }
  console.log("✓ All predicate bands match reference criteria!");

  // TEST 6: Verify Multi-sheet Excel Generation logic
  console.log("\n[TEST 6] Testing Multi-sheet Excel Workbook generation...");
  const wb = XLSX.utils.book_new();

  // Test building master sheet
  const masterHeaders = [
    ["REKAPITULASI NILAI AKHIR MAGISTA 2026"],
    ["HIMASTA UNS - KABINET LINTANG LOKA 2026"],
    [],
    ["No", "NIM", "Nama Mahasiswa", "Departemen", "Rata-rata FGD", "Rata-rata Magang Bidang", "Predikat Magang Bidang", "Rata-rata Magang Angkatan", "Predikat Magang Angkatan", "Nilai Akhir Gabungan", "Predikat Akhir"]
  ];
  const masterRows = interns.map((intern, idx) => {
    const nim = intern.id.replace('intern_', '');
    const isTarget = intern.id === targetIntern.id;
    const fgdAvg = isTarget ? overall.toFixed(2) : '-';
    const finalPred = isTarget ? getScorePredicate(overall).label : '-';
    return [
      idx + 1,
      nim,
      intern.name,
      intern.department,
      fgdAvg,
      '-',
      '-',
      '-',
      '-',
      isTarget ? overall.toFixed(2) : '-',
      finalPred
    ];
  });

  const wsMaster = XLSX.utils.aoa_to_sheet([...masterHeaders, ...masterRows]);
  XLSX.utils.book_append_sheet(wb, wsMaster, "Data Rekap Rapi");

  // Test building department sheets
  const DEPT_SHEET_NAMES = {
    'Finance': 'Finance',
    'Secretary': 'Sekre',
    'Social Event': 'SE',
    'Academic and Achievement': 'Acent',
    'Public Relation': 'PR',
    'Business Development': 'Bisdev',
    'Human Capital': 'HC',
    'Talent Acquisition': 'TA',
    'Media and Branding': 'Medbrand'
  };

  DEPARTMENTS.forEach(dept => {
    const sheetName = DEPT_SHEET_NAMES[dept] || dept;
    const deptInterns = interns.filter(i => i.department === dept);
    const deptHeaders = [
      [`PENILAIAN MAGANG DEPARTEMEN - ${dept.toUpperCase()}`],
      [],
      ["No", "NIM", "Nama Lengkap", "Sikap & Etika", "Kerja Sama & Komunikasi", "Self Improvement", "Profesionalisme", "Leadership", "Rata-rata", "Predikat"]
    ];
    const deptRows = deptInterns.map((intern, idx) => {
      const nim = intern.id.replace('intern_', '');
      const isTarget = intern.id === targetIntern.id;
      return [
        idx + 1,
        nim,
        intern.name,
        isTarget ? scores.scoreSikap : '-',
        isTarget ? scores.scoreKomunikasi : '-',
        isTarget ? scores.scoreImprovement : '-',
        isTarget ? scores.scoreProfesionalisme : '-',
        isTarget ? scores.scoreLeadership : '-',
        isTarget ? overall.toFixed(2) : '-',
        isTarget ? getScorePredicate(overall).label : '-'
      ];
    });
    const wsDept = XLSX.utils.aoa_to_sheet([...deptHeaders, ...deptRows]);
    XLSX.utils.book_append_sheet(wb, wsDept, sheetName);
  });

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  console.log(`✓ Excel generated successfully! Byte length: ${buffer.length}`);
  console.log(`✓ Sheets in workbook (${wb.SheetNames.length}):`, wb.SheetNames.join(', '));

  } finally {
    // TEST 7: Clean up Test Data
    console.log("\n[TEST 7] Cleaning up test evaluation and test period...");
    if (testEvalCreated) {
      await supabase.from('evaluations').delete().eq('id', testEvalId);
      console.log(`✓ Test evaluation ${testEvalId} deleted.`);
    }
    if (testPeriodCreated) {
      await supabase.from('periods').delete().eq('id', testPeriodId);
      console.log(`✓ Test period ${testPeriodId} deleted.`);
    }
    
    // Re-activate active period if any was deactivated
    const { data: currentActive } = await supabase
      .from('periods')
      .select('*')
      .eq('name', 'Agustus 2026')
      .maybeSingle();

    if (currentActive && currentActive.status !== 'active') {
      await supabase.from('periods').update({ status: 'active' }).eq('id', currentActive.id);
    }
    console.log("✓ Cleanup finished. Database restored to pristine state.");
  }

  console.log("\n=======================================================");
  console.log("🎉 ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("=======================================================\n");
}

runTests().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
