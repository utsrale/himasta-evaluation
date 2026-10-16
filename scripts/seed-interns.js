const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env.local file not found!");
  process.exit(1);
}

const dotenvContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
dotenvContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const jsonPath = path.join(__dirname, 'interns_extracted.json');
if (!fs.existsSync(jsonPath)) {
  console.error("Error: interns_extracted.json not found!");
  process.exit(1);
}

const internsData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

async function seedInterns() {
  try {
    console.log(`Loaded ${internsData.length} interns from JSON.`);

    // 1. Remove existing intern records from staff table
    console.log("Removing any existing interns from 'staff' table...");
    const { error: delErr } = await supabase.from('staff').delete().eq('role', 'intern');
    if (delErr) {
      console.warn("Warning during deletion:", delErr);
    }

    // 2. Prepare staff rows
    const rows = internsData.map((intern, idx) => ({
      id: `intern_${intern.nim}`,
      name: intern.name,
      jabatan: `Peserta Magang (${intern.nim})`,
      department: intern.department,
      role: 'intern',
      email: `${intern.nim}@student.uns.ac.id`,
    }));

    // 3. Insert in batches of 50
    console.log(`Inserting ${rows.length} interns into Supabase 'staff' table...`);
    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error: insErr } = await supabase.from('staff').insert(chunk);
      if (insErr) {
        console.error(`Error inserting batch ${i / chunkSize + 1}:`, insErr);
        process.exit(1);
      }
    }

    // 4. Verification count
    const { data: countData, error: countErr } = await supabase
      .from('staff')
      .select('id, department')
      .eq('role', 'intern');

    if (countErr) {
      console.error("Error counting interns:", countErr);
    } else {
      console.log(`\n✅ BERHASIL SEEDING ${countData.length} PESERTA MAGANG KE DATABASE SUPABASE!`);
      const byDept = {};
      countData.forEach(item => {
        byDept[item.department] = (byDept[item.department] || 0) + 1;
      });
      console.log("Rincian per Departemen:");
      Object.keys(byDept).sort().forEach(d => {
        console.log(`  - ${d}: ${byDept[d]} peserta`);
      });
    }

  } catch (err) {
    console.error("Fatal seed error:", err);
    process.exit(1);
  }
}

seedInterns();
