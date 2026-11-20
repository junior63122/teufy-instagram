// Rend les visuels du concours (node rendre.cjs) : 01..04.jpg (carrousel de 4 images, règlement dans la légende) et stories/*.jpg.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const exe = ['/opt/pw-browsers/chromium', process.env.CHROME_BIN].find((x) => x && fs.existsSync(x));
  const b = await chromium.launch(exe ? { executablePath: exe } : {}); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + path.join(__dirname, 'visuels.html')); await p.evaluate(() => document.fonts.ready);
  const D = path.join(__dirname, '..'); fs.mkdirSync(path.join(D, 'stories'), { recursive: true });
  const sorties = [['s1', '01.jpg'], ['s2', '02.jpg'], ['s3', '03.jpg'], ['s4', '04.jpg'], ['st-phaphane', 'stories/phaphane.jpg'], ['st-tekno', 'stories/tekno.jpg'], ['st-rappel', 'stories/rappel.jpg']];
  for (const [id, f] of sorties) {
    await p.evaluate((id) => { document.querySelectorAll('.v').forEach((v) => v.classList.toggle('on', v.id === id)); }, id);
    await p.waitForTimeout(150);
    await p.locator('#' + id).screenshot({ path: path.join(D, f), type: 'jpeg', quality: 92 });
  }
  await b.close(); console.log('ok');
})();
