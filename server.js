//dotenv
import 'dotenv/config.js';
//dependencies
import path from 'path';
import { chromium } from "playwright";
import express from 'express';
import checkCleanURL from "./clean-url/index.js";
//nsfw
import tf from '@tensorflow/tfjs-node';
import nsfwjs from 'nsfwjs';

//app
const app = express();
app.use(express.json());

(async () => {
    const model = await nsfwjs.load(`https://nsfwjs.com/model/`, { size: 299 });;

    const defaultBrowser = await chromium.launch({
        headless: true,
        chromiumSandbox: false,
        args: ["--disable-dev-shm-usage"],
        executablePath: process.env.CHROME_BIN || undefined,
    });

    defaultBrowser.on("disconnected", process.exit);

    app.use((req, res, next) => {
        if (req.headers["auth-token"] === process.env.TOKEN) next();
        else res.status(403).send("Nope no puedes usar esta API");
    })

    app.get("/", (req, res) => {
        res.status(200).json({
            "author": "AndreMor#0008",
            "method": "/ss"
        });
    });

    app.post("/ss", (req, res) => {
        if (req.body.waitUntil && !(['load', 'domcontentloaded', 'networkidle', 'commit'].includes(req.body.waitUntil))) return res.status(400).send("manda bien cuando esperar pue");
        if (!req.body.url) return res.status(400).send("Oye manda un URL primero");
        const url = getURL(req.body.url);
        if (!url) return res.status(400).send("This is a invalid URL.");
        if (!req.body.nsfw) {
            if (checkCleanURL(url)) return res.status(401).send("NSFW content has been detected in the generated image. If you want to see it, ask for it on a NSFW channel.");
        }
        defaultBrowser.newContext({ acceptDownloads: false, colorScheme: 'dark', viewport: { width: parseInt(process.env.WIDTH), height: parseInt(process.env.HEIGHT) } }).then(async (context) => {
            try {
                const page = await context.newPage();
                const response = await page.goto(req.body.url, { waitUntil: req.body.waitUntil || 'load' });
                if (!req.body.nsfw) {
                    if (checkCleanURL(response.url())) return res.status(401).send("NSFW content has been detected in the generated image. If you want to see it, ask for it on a NSFW channel.");
                }
                if (req.body.delay) await page.waitForTimeout(req.body.delay * 1000 || 0);
                const screenshot = await page.screenshot({
                    animations: "disabled",
                    clip: { x: parseInt(req.body.x), y: parseInt(req.body.y), width: parseInt(process.env.WIDTH), height: parseInt(process.env.HEIGHT) },
                    type: "png",
                    fullPage: true
                });

                if (!req.body.nsfw) {
                    const tocheck = await tf.node.decodeImage(screenshot, 3);
                    const predictions = await model.classify(tocheck);
                    tocheck.dispose();
                    const score = predictions.find(e => e.className === 'Porn').probability + predictions.find(e => e.className === 'Hentai').probability + predictions.find(e => e.className === 'Sexy').probability;
                    if (score >= 0.2) return res.status(401).send("NSFW content has been detected in the generated image. If you want to see it, ask for it on a NSFW channel.");
                }
                res.setHeader("Content-Type", "image/png");
                res.status(200).send(screenshot);
            }
            finally {
                await context.close();
            }
        }).catch(err => {
            res.status(500).send(err.message || err.toString?.() || err || "Unknown error");
        });
    });

    app.use("/ss", (req, res) => res.status(405).send("Oye no seas loco es con un POST"));

    const listener = app.listen(process.env.PORT, async () => {
        console.log("Listening on port " + listener.address().port);
    });
})();

function getURL(url) {
    try {
        const final = new URL(url);
        if (!(["http:", "https:"].includes(final.protocol))) return null;
        return final.href;
    } catch {
        return null;
    }
}
