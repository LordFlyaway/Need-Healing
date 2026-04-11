import puppeteer from 'puppeteer-core';
import path from 'path';

(async () => {
    try {
        console.log("Launching system Chrome...");
        const browser = await puppeteer.launch({
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            headless: 'new',
            defaultViewport: { width: 1280, height: 800 }
        });
        
        const page = await browser.newPage();
        
        // 1. Capture Dashboard Screenshot
        console.log("Navigating to Dashboard...");
        try {
            await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 2000)); // wait for animations
            await page.screenshot({ path: 'screenshot_dashboard.png' });
            console.log("Saved dashboard screenshot.");
        } catch(e) { console.error("Error on dashboard:", e); }

        // 2. Capture Ambulance Screenshot
        console.log("Navigating to Ambulance Mode...");
        try {
            await page.goto('http://localhost:5173/ambulance', { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 2000));
            await page.screenshot({ path: 'screenshot_ambulance.png' });
            console.log("Saved ambulance mode screenshot.");
        } catch(e) { console.error("Error on ambulance:", e); }
        
        // 3. Generate PDF
        const filePath = `file://${path.resolve('report.html')}`;
        console.log(`Loading HTML for PDF: ${filePath}`);
        
        await page.goto(filePath, { waitUntil: 'networkidle0' });
        
        console.log("Waiting for mermaid to render in HTML...");
        await page.waitForSelector('#render-done', { timeout: 10000 }).catch(() => console.log('Timeout waiting for mermaid'));
        
        const outputPath = path.resolve('MediVault_Technical_Report.pdf');
        
        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            margin: { top: '30px', bottom: '30px', left: '30px', right: '30px' }
        });
        
        await browser.close();
        console.log("PDF generated successfully with screenshots included!");
    } catch (e) {
        console.error("Error:", e);
    }
})();
