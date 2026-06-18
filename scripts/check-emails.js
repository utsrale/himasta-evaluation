const xlsx = require('xlsx');
const path = require('path');

const wb1 = xlsx.readFile(path.join(__dirname, '..', '..', 'Nama - Jabatan.xlsx'));
const sheet1 = wb1.Sheets[wb1.SheetNames[0]];
const staffRows = xlsx.utils.sheet_to_json(sheet1);

const wb2 = xlsx.readFile(path.join(__dirname, '..', '..', 'PENDATAAN E-MAIL SSO HIMASTA 2026.xlsx'));
const sheet2 = wb2.Sheets[wb2.SheetNames[0]];
const emailRows = xlsx.utils.sheet_to_json(sheet2);

const normalize = (name) => name.toLowerCase().replace(/[^a-z]/g, '');

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

// Build email map from email Excel
const emailMap = {};
emailRows.forEach(row => {
  if (row.NAMA && row['E-MAIL SSO']) {
    const norm = normalize(row.NAMA.toString().trim());
    const key = manualMap[norm] || norm;
    emailMap[key] = row['E-MAIL SSO'].toString().trim().toLowerCase();
  }
});

console.log('=== ANALISIS EMAIL STAFF ===\n');

let unmatched = [];
let problems = [];
let matched = [];

staffRows.forEach(row => {
  const name = row['Nama'] ? row['Nama'].toString().trim().replace(/\uFFFD/g, "'") : null;
  if (!name) return;
  const nameNorm = normalize(name);
  const email = emailMap[nameNorm];

  if (!email) {
    const generated = name.toLowerCase().replace(/\s+/g, '') + '@student.uns.ac.id';
    unmatched.push({ name, nameNorm, email: generated, source: 'auto-generated' });
  } else {
    // Check for problems
    const issues = [];
    if (!email.endsWith('@student.uns.ac.id')) {
      issues.push('WRONG DOMAIN: ' + email.split('@')[1]);
    }
    if (email.includes(' ')) {
      issues.push('CONTAINS SPACE');
    }
    if (issues.length > 0) {
      problems.push({ name, email, issues: issues.join(', ') });
    } else {
      matched.push({ name, email });
    }
  }
});

console.log(`Total staff di Excel: ${staffRows.length}`);
console.log(`Email matched OK: ${matched.length}`);
console.log(`Email bermasalah: ${problems.length}`);
console.log(`Nama tidak cocok (auto-generated): ${unmatched.length}`);

if (problems.length > 0) {
  console.log('\n--- EMAIL BERMASALAH ---');
  problems.forEach(p => {
    console.log(`  ${p.name} -> ${p.email} (${p.issues})`);
  });
}

if (unmatched.length > 0) {
  console.log('\n--- NAMA TIDAK COCOK (email auto-generated, mungkin salah) ---');
  unmatched.forEach(u => {
    console.log(`  ${u.name} -> ${u.email}`);
  });
}

// Also check for Alyssa specifically
console.log('\n--- CEK KHUSUS: Alyssa Divania ---');
const alyssaEmail = emailMap[normalize('Alyssa Divania')];
console.log('Email dari Excel:', alyssaEmail || 'TIDAK DITEMUKAN');
console.log('Email yang benar: alyssadivania23@student.uns.ac.id');
