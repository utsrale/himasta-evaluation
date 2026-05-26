const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
console.log("Loading env variables from:", envPath);
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const excelPath = path.join(__dirname, '..', '..', 'Nama - Jabatan.xlsx');
const emailExcelPath = path.join(__dirname, '..', '..', 'PENDATAAN E-MAIL SSO HIMASTA 2026.xlsx');

console.log("Looking for Excel file at:", excelPath);
if (!fs.existsSync(excelPath)) {
  console.error("Error: Excel file not found!");
  process.exit(1);
}

async function runSeed() {
  try {
    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log(`Found ${rows.length} rows in the excel sheet.`);

    // Load email mapping
    const emailMap = {};
    if (fs.existsSync(emailExcelPath)) {
      const emailWorkbook = xlsx.readFile(emailExcelPath);
      const emailSheet = emailWorkbook.Sheets[emailWorkbook.SheetNames[0]];
      const emailRows = xlsx.utils.sheet_to_json(emailSheet);
      console.log(`Found ${emailRows.length} rows in the email excel sheet.`);
      
      const normalize = (name) => name.toLowerCase().replace(/[^a-z]/g, '');
      const getMatchedName = (rawNameFromEmailExcel) => {
        const norm = normalize(rawNameFromEmailExcel);
        const manualMap = {
          'annisaaulia': 'annisaauliasholihah',
          'himmatuss': 'himmatussaadah',
          'aishasyiffania': 'aishasyiffaniazzahra',
          'azzahrairfanbadiuzzaman': 'azzahrairfanbadiuzzam',
          'alvin': 'muhammadalvinthoriqpurnamaputra',
          'sanianiwa': 'sanianiwaningrum',
          'laia': 'laiarafasulistyadi',
          'bryanstevendamarasinaga': 'bryanstevendsinaga'
        };
        return manualMap[norm] || norm;
      };

      emailRows.forEach(row => {
        if (row.NAMA && row['E-MAIL SSO']) {
          const key = getMatchedName(row.NAMA.toString().trim());
          emailMap[key] = row['E-MAIL SSO'].toString().trim().toLowerCase();
        }
      });
    }

    const staff = [];
    let idCounter = 1;

    for (const row of rows) {
      const name = row['Nama'] ? row['Nama'].toString().trim() : null;
      const position = row['Jabatan'] ? row['Jabatan'].toString().trim() : null;
      
      if (!name || !position) continue;
      
      const cleanName = name.replace(/\uFFFD/g, "'");
      
      let dept = '';
      let role = 'staff';
      const posLower = position.toLowerCase();
      
      if (posLower === 'director' || posLower === 'vice director') {
        dept = 'BPH';
        role = 'director_vice';
      } else if (posLower === 'secretary') {
        dept = 'Secretary';
        role = 'pht';
      } else if (posLower === 'staff of secretary') {
        dept = 'Secretary';
        role = 'staff';
      } else if (posLower === 'finance') {
        dept = 'Finance';
        role = 'pht';
      } else if (posLower === 'staff of finance') {
        dept = 'Finance';
        role = 'staff';
      } else if (position.startsWith('Head of ')) {
        dept = position.replace('Head of ', '');
        role = 'pht';
      } else if (position.startsWith('Vice Head of ')) {
        dept = position.replace('Vice Head of ', '');
        role = 'pht';
      } else if (position.startsWith('Staff of ')) {
        dept = position.replace('Staff of ', '');
        role = 'staff';
      } else {
        dept = 'Other';
        role = 'staff';
      }
      
      const normalize = (name) => name.toLowerCase().replace(/[^a-z]/g, '');
      const nameNorm = normalize(cleanName);
      const email = emailMap[nameNorm] || `${cleanName.toLowerCase().replace(/\s+/g, '')}@student.uns.ac.id`;

      staff.push({
        id: `staff_${idCounter++}`,
        name: cleanName,
        jabatan: position,
        department: dept.trim(),
        role: role,
        email: email
      });
    }

    console.log("Connecting to Supabase and clearing old database rows...");
    
    // 1. Delete old evaluations, staff, and periods
    const { error: evalDeleteErr } = await supabase.from('evaluations').delete().neq('id', '');
    if (evalDeleteErr) console.warn("Warning deleting evaluations:", evalDeleteErr);

    const { error: staffDeleteErr } = await supabase.from('staff').delete().neq('id', '');
    if (staffDeleteErr) {
      console.error("Error clearing staff table in Supabase:", staffDeleteErr);
      process.exit(1);
    }

    const { error: periodDeleteErr } = await supabase.from('periods').delete().neq('id', '');
    if (periodDeleteErr) {
      console.error("Error clearing periods table in Supabase:", periodDeleteErr);
      process.exit(1);
    }

    // 2. Insert new staff rows
    console.log(`Inserting ${staff.length} staff members into Supabase...`);
    const { error: staffInsertErr } = await supabase.from('staff').insert(staff);
    if (staffInsertErr) {
      console.error("Error inserting staff into Supabase:", staffInsertErr);
      process.exit(1);
    }

    // 3. Insert default period (Mei 2026, status active)
    console.log("Inserting default period 'Mei 2026' into Supabase...");
    const { error: periodInsertErr } = await supabase.from('periods').insert([
      {
        id: 'period_mei_2026',
        name: 'Mei 2026',
        status: 'active'
      }
    ]);
    if (periodInsertErr) {
      console.error("Error inserting period into Supabase:", periodInsertErr);
      process.exit(1);
    }

    console.log("\nSuccess: Database seeded successfully on Supabase!");
    console.log(`- Seeded ${staff.length} staff rows.`);
    console.log(`- Seeded active period: Mei 2026.`);
  } catch (error) {
    console.error("Failed to seed database:", error);
    process.exit(1);
  }
}

runSeed();
