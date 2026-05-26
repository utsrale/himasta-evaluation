// Diagnostic script to inspect Supabase data for the evaluation system.
// Usage: node scripts/diagnose.js [email]

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
    console.error('Error: .env.local file not found!');
    process.exit(1);
}
const dotenvContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
dotenvContent.split('\n').forEach((line) => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
    const filterEmail = (process.argv[2] || '').toLowerCase().trim();

    console.log('===== DIAGNOSIS: Sistem Penilaian HIMASTA =====\n');

    // 1. Active period
    const { data: periods, error: pErr } = await supabase.from('periods').select('*');
    if (pErr) return console.error('Error periods:', pErr);
    console.log('--- PERIODS ---');
    periods.forEach((p) => console.log(`  [${p.status.toUpperCase()}] ${p.id}  |  ${p.name}`));
    const activePeriod = periods.find((p) => p.status === 'active');
    console.log(`\n  Active period: ${activePeriod ? activePeriod.name : '(none!)'}\n`);

    // 2. Staff stats per department & role
    const { data: staff, error: sErr } = await supabase.from('staff').select('*');
    if (sErr) return console.error('Error staff:', sErr);

    console.log(`--- STAFF TOTAL: ${staff.length} ---`);
    const byDept = {};
    staff.forEach((s) => {
        if (!byDept[s.department]) byDept[s.department] = { director_vice: 0, pht: 0, staff: 0, other: 0, _list: [] };
        const bucket = byDept[s.department];
        if (bucket[s.role] !== undefined) bucket[s.role]++;
        else bucket.other++;
        bucket._list.push(s);
    });
    Object.keys(byDept).sort().forEach((dept) => {
        const b = byDept[dept];
        console.log(`  ${dept}: director_vice=${b.director_vice}, pht=${b.pht}, staff=${b.staff}, other=${b.other}`);
    });

    // 3. Show null/missing emails
    console.log('\n--- STAFF WITH MISSING / AUTO-GENERATED EMAILS ---');
    const auto = staff.filter((s) => s.email && s.email.endsWith('@student.uns.ac.id') && !/[0-9]/.test(s.email));
    // Auto generated have no numbers (from our seed); real SSO emails commonly contain numbers.
    // We'll just show emails that look auto-generated (no dot before @)
    const looksAuto = staff.filter((s) => {
        if (!s.email) return true;
        const local = s.email.split('@')[0];
        return !local.includes('.') && !local.includes('_'); // SSO emails biasanya ada titik
    });
    console.log(`  Total staf dengan email yang kemungkinan AUTO-GENERATED (bukan SSO asli): ${looksAuto.length}`);
    looksAuto.slice(0, 20).forEach((s) => console.log(`    - ${s.name} [${s.role}/${s.department}] => ${s.email}`));
    if (looksAuto.length > 20) console.log(`    ... (+${looksAuto.length - 20} more)`);

    // 4. Evaluations count
    const { data: evals, error: eErr } = await supabase.from('evaluations').select('*');
    if (eErr) return console.error('Error evals:', eErr);
    console.log(`\n--- EVALUATIONS TOTAL: ${evals.length} ---`);
    if (activePeriod) {
        const inPeriod = evals.filter((e) => e.periodId === activePeriod.id);
        console.log(`  Di periode aktif (${activePeriod.name}): ${inPeriod.length}`);
    }

    // 5. Simulasi: jika user memberikan email, simulasikan apa yang akan terlihat
    if (filterEmail) {
        console.log(`\n===== SIMULASI LOGIN: ${filterEmail} =====`);
        const evaluator = staff.find((s) => (s.email || '').toLowerCase() === filterEmail);
        if (!evaluator) {
            console.log('  ❌ Email TIDAK DITEMUKAN di tabel staff!');
            console.log('     Sistem akan menampilkan error: "Penilai tidak ditemukan."');
            // Suggest closest match
            const partial = staff.filter((s) => (s.email || '').toLowerCase().includes(filterEmail.split('@')[0].slice(0, 5)));
            if (partial.length) {
                console.log('     Kandidat mirip:');
                partial.slice(0, 5).forEach((s) => console.log(`        ${s.name} => ${s.email}`));
            }
            return;
        }
        console.log(`  ✅ Ditemukan: ${evaluator.name} | role=${evaluator.role} | dept=${evaluator.department}`);

        const done = evals
            .filter((e) => e.evaluatorId === evaluator.id && (!activePeriod || e.periodId === activePeriod.id))
            .map((e) => e.targetId);
        console.log(`     Sudah menilai ${done.length} orang di periode aktif.`);

        let available = [];
        if (evaluator.role === 'director_vice') {
            available = staff.filter((s) => s.role === 'staff' && !done.includes(s.id));
        } else if (evaluator.role === 'pht') {
            available = staff.filter((s) => s.department === evaluator.department && s.role === 'staff' && !done.includes(s.id));
        } else {
            available = staff.filter((s) => s.department === evaluator.department && s.role === 'staff' && !done.includes(s.id));
        }
        console.log(`     Target yang BISA dinilai (logika sekarang): ${available.length} orang`);
        available.forEach((s) => console.log(`        - ${s.name} (${s.jabatan})`));

        if (available.length === 0) {
            console.log('\n  ⚠️ INILAH PENYEBAB tampilan "Tidak ada staf tersedia".');
            console.log('     Karena filter mengharuskan target ber-role "staff" di departemen yang sama.');
            // Show all dept members regardless of role
            const allDept = staff.filter((s) => s.department === evaluator.department && s.id !== evaluator.id);
            console.log(`\n     Padahal di departemen ${evaluator.department} sebenarnya ada ${allDept.length} anggota lain:`);
            allDept.forEach((s) => console.log(`        - ${s.name} (${s.jabatan}) [role=${s.role}]`));
        }
    } else {
        console.log('\nTip: jalankan `node scripts/diagnose.js email@anda` untuk simulasi 1 user.');
    }
}

main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
});
