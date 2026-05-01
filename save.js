const { chromium } = require('playwright');
const path = require('path');
const readline = require('readline/promises');
const fs = require('fs');

require('dotenv').config();

(async () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // File mapping
    const fileMap = {
        '1': 'rules-tm.html',
        '2': 'rules-clean.html',
        '3': 'chores-table.html'
    };

    console.log("Which file do you want to use?");
    console.log("1) rules-tm.html");
    console.log("2) rules-clean.html");
    console.log("3) chores-table.html");
    console.log("4) ALL FILES");

    let fileChoice = '';
    let selectedFiles = [];

    while (selectedFiles.length === 0) {
        fileChoice = await rl.question("Enter 1, 2, 3, or 4: ");

        if (fileChoice === '4') {
            selectedFiles = Object.values(fileMap);
        } else if (fileMap[fileChoice]) {
            selectedFiles = [fileMap[fileChoice]];
        } else {
            console.log("Invalid choice, please enter 1, 2, 3, or 4.");
        }
    }

    const padChoice = await rl.question("Do you want the extra padding adjustments? (y/n): ");
    const usePadding = padChoice.trim().toLowerCase().startsWith('y');

    rl.close();

    const padSuffix = usePadding ? '+' : '';

    const outputDir = path.resolve('pdfs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    const basePath = __dirname;
    const viewWidth = usePadding ? 1000 : 900;
    const TB_PADDING = usePadding ? 40 : 2;

    const browser = await chromium.launch();

    for (const fileName of selectedFiles) {
        let outputFileName = '';

        if (fileName === 'rules-tm.html') outputFileName = `chore-rules-tm${padSuffix}.pdf`;
        else if (fileName === 'rules-clean.html') outputFileName = `chore-rules-cln${padSuffix}.pdf`;
        else if (fileName === 'chores-table.html') outputFileName = `chores-table${padSuffix}.pdf`;

        const outputPath = path.join(outputDir, outputFileName);
        const filePath = 'file:///' + path.resolve(basePath, fileName).replace(/\\/g, '/');

        console.log(`\nProcessing ${fileName}...`);
        console.log(`Using Width: ${viewWidth}px, Top/Bottom Padding: ${TB_PADDING}px`);

        const context = await browser.newContext({
            viewport: { width: viewWidth, height: 800 },
        });

        const page = await context.newPage();

        await page.emulateMedia({ media: 'screen' });
        await page.goto(filePath, { waitUntil: 'networkidle' });

        // Replace placeholder text with .env values
        await page.evaluate((env) => {
            document.querySelectorAll('.pn').forEach(el => {
                if (env.name) el.textContent = env.name;
            });
            document.querySelectorAll('.ppn').forEach(el => {
                if (env.phone) el.textContent = env.phone;
            });
        }, { name: process.env.name, phone: process.env.phone });

        const contentHeight = await page.evaluate(() => {
            return Math.ceil(document.documentElement.scrollHeight);
        });

        await page.evaluate((padding) => {
            const spacer = document.createElement('div');
            spacer.style.height = `${padding}px`;
            spacer.style.display = 'block';
            document.body.insertBefore(spacer, document.body.firstChild);
        }, TB_PADDING);

        await page.addStyleTag({
            content: `
                * { break-inside: avoid !important; }
                html, body { height: auto !important; overflow: visible !important; }
            `
        });

        const finalHeight = contentHeight + TB_PADDING + TB_PADDING;

        await page.pdf({
            path: outputPath,
            width: `${viewWidth}px`,
            height: `${finalHeight}px`,
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        await context.close();

        console.log(`Saved to ${outputPath} (height: ${finalHeight}px)`);
    }

    await browser.close();
})();