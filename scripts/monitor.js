// Monitor progress penilaian setiap staff di periode aktif.
// Usage: node scripts/monitor.js              -> ringkasan
//        node scripts/monitor.js detail       -> detail lengkap per orang
//        node scripts/monitor.js dept Finance -> filter satu departemen

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const dotenvContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
dotenvContent.split('\n').forEach((line) => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const mode = (process.argv[2] || 'summary').toLowerCase();
const filterDept = process.argv[3] || null;

async function main() {
    const { data: periods } = await supabase.from('periods').select('*');
    const activePeriod = periods.find((p) => p.status === 'active');
    if (!activePeriod) return console.error('Tidak ada periode aktif!');

    const { data: staff } = await supabase.from('staff').select('*');
    const { data: evals } = await supabase.from('evaluations').select('*').eq('periodId', activePeriod.id);

    console.log(`\n📊 MONITORING PENILAIAN | Periode: ${activePeriod.name}`);
    console.log(`   Total staf: ${staff.length} | Total submit: ${evals.length}\n`);

    // Hitung expected target tiap evaluator
    const calcExpected = (ev) => {
        if (ev.role === 'director_vice') {
            return staff.filter((s) => s.role === 'staff').length;
        }
        return staff.filter((s) => s.department === ev.department && s.role === 'staff').length;
    };

    // Group hasil per orang
    const rows = staff.map((s) => {
        const done = evals.filter((e) => e.evaluatorId === s.id).length;
        const expected = calcExpected(s);
        const pct = expected === 0 ? 0 : Math.round((done / expected) * 100);
        return {
            name: s.name,
            dept: s.department,
            role: s.role,
            jabatan: s.jabatan,
            done,
            expected,
            pct,
            status:
                expected === 0 ? '—' :
                    done === 0 ? '❌ BELUM' :
                        done >= expected ? '✅ SELESAI' :
                            '🟡 SEBAGIAN',
        };
    });

    // Filter
    let view = rows;
    if (filterDept) view = view.filter((r) => r.dept.toLowerCase().includes(filterDept.toLowerCase()));

    if (mode === 'detail') {
        // Print all rows
        const byDept = {};
        view.forEach((r) => {
            if (!byDept[r.dept]) byDept[r.dept] = [];
            byDept[r.dept].push(r);
        });
        Object.keys(byDept).sort().forEach((dept) => {
            console.log(`\n── ${dept} ──`);
            byDept[dept].forEach((r) => {
                console.log(
                    `   ${r.status.padEnd(12)} ${r.name.padEnd(40)} ${r.jabatan.padEnd(35)} ${r.done}/${r.expected} (${r.pct}%)`
                );
            });
        });
    } else if (mode === 'dept') {
        // Same as detail but only one dept (already filtered)
        view.forEach((r) => {
            console.log(`${r.status.padEnd(12)} ${r.name.padEnd(40)} ${r.jabatan.padEnd(35)} ${r.done}/${r.expected} (${r.pct}%)`);
        });
    } else {
        // Summary
        const total = view.length;
        const selesai = view.filter((r) => r.status === '✅ SELESAI').length;
        const sebagian = view.filter((r) => r.status === '🟡 SEBAGIAN').length;
        const belum = view.filter((r) => r.status === '❌ BELUM').length;
        const nilai0 = view.filter((r) => r.status === '—').length;

        console.log('━━ RINGKASAN ━━');
        console.log(`  ✅ Sudah menilai SEMUA target  : ${selesai}/${total}`);
        console.log(`  🟡 Baru menilai sebagian       : ${sebagian}/${total}`);
        console.log(`  ❌ BELUM menilai sama sekali   : ${belum}/${total}`);
        console.log(`  —  Tidak punya target (BPH dll): ${nilai0}/${total}`);

        console.log('\n━━ YANG BELUM MENILAI SAMA SEKALI ━━');
        const byDept = {};
        view.filter((r) => r.status === '❌ BELUM').forEach((r) => {
            if (!byDept[r.dept]) byDept[r.dept] = [];
            byDept[r.dept].push(r);
        });
        Object.keys(byDept).sort().forEach((dept) => {
            console.log(`\n  ${dept}:`);
            byDept[dept].forEach((r) => console.log(`    - ${r.name} (${r.jabatan})`));
        });

        console.log('\nTip: jalankan `node scripts/monitor.js detail` untuk lihat semua orang.');
        console.log('     jalankan `node scripts/monitor.js dept Finance` untuk satu departemen.');
    }
}

main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
});
