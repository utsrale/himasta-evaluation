const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log('Memulai proses pengambilan screenshot dari LOCALHOST...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 850 });

  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }

  // Fungsi pembantu untuk menyamarkan nama di halaman
  const anonymizeNames = async (pageInstance) => {
    await pageInstance.evaluate(() => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      const fakeNames = [
        'Aditya Nugroho', 'Budi Santoso', 'Citra Lestari', 'Dewi Sartika', 
        'Eko Prasetyo', 'Farhan Ramadhan', 'Gita Permata', 'Hendra Wijaya',
        'Indah Cahyani', 'Joko Susilo', 'Kartika Putri', 'Lukman Hakim'
      ];
      let nameIndex = 0;
      const nameMap = {};

      while (node = walk.nextNode()) {
        const text = node.nodeValue.trim();
        if (text.length < 3 || text.includes('©') || text.includes('HIMASTA') || text.includes('Step') || text.includes('Nilai') || text.includes('Keluar') || text.includes('Admin') || text.includes('Periode') || text.includes('Departemen') || text.includes('Staf') || text.includes('Submit') || text.includes('Kirim')) {
          continue;
        }

        const nameRegex = /^[A-Z][a-z’']+(?:\s+[A-Z][a-z’'\s]+){1,3}$/;
        if (nameRegex.test(text)) {
          if (!nameMap[text]) {
            nameMap[text] = fakeNames[nameIndex % fakeNames.length] + ' (Samaran)';
            nameIndex++;
          }
          node.nodeValue = nameMap[text];
        }
      }
    });
  };

  // 1. Screenshot Halaman Login User
  console.log('1. Membuka halaman login user...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(publicDir, 'ss_staf_login.png') });

  // 2. Login sebagai Staff & Screenshot Form Penilaian 1-10 Aktif
  console.log('2. Mencoba login sebagai staff...');
  try {
    await page.type('input[type="email"]', 'ardanadhifa22@student.uns.ac.id');
    await page.click('button[type="submit"]');
    
    // TUNGGU DENGAN PASTI: Tunggu sampai form penilaian (Step 3) termuat di DOM
    await page.waitForSelector('form.space-y-6', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));
    
    // Pastikan posisi halaman ter-scroll ke paling atas sebelum difoto
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 500));

    // Sensor nama asli staf di form penilaian sebelum difoto
    await anonymizeNames(page);
    
    console.log('Berhasil memuat form penilaian (Step 3). Mengambil screenshot...');
    await page.screenshot({ path: path.join(publicDir, 'ss_staf_form.png') });
  } catch (err) {
    console.log('Info: Gagal memuat form penilaian aktif.', err.message);
  }

  // 3. Halaman Login Admin
  console.log('3. Membuka halaman login admin...');
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(publicDir, 'ss_admin_login.png') });

  // 4. Login Admin & Screenshot Dashboard
  console.log('4. Mencoba login sebagai admin...');
  try {
    await page.type('input[type="password"]', 'himasta2026');
    await page.click('button[type="submit"]');
    
    await page.waitForSelector('a[href*="/api/admin/export"]', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
    
    await page.evaluate(() => window.scrollTo(0, 0));
    await anonymizeNames(page);
    
    console.log('Berhasil memuat dashboard admin. Mengambil screenshot...');
    await page.screenshot({ path: path.join(publicDir, 'ss_admin_dash.png') });
  } catch (err) {
    console.log('Gagal login ke dashboard admin:', err.message);
  }

  await browser.close();
  console.log('Proses selesai!');
}

run().catch(err => {
  console.error('Terjadi kesalahan fatal:', err);
});
