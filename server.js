//dotenv
require("dotenv").config({ path: __dirname + "/.env" });
//dependencies
const { chromium } = require("playwright");
const express = require("express");
const deepai = require("deepai");
deepai.setApiKey(process.env.DEEPAI);
const checkCleanURL = require("./clean-url/index.js");

//app
const app = express();
app.use(express.json());

(async () => {

    const defaultBrowser = await chromium.launch({
        headless: true,
        chromiumSandbox: false,
        args: ["--disable-dev-shm-usage"],
        executablePath: process.env.CHROME_BIN || null,
    });

    defaultBrowser.on("disconnected", process.exit);

    app.use((req, res, next) => {
        if (req.headers["auth-token"] === process.env.TOKEN) next();
        else res.status(403).send({ code: 43, message: "unauthorized" });
    })

    app.get("/", (req, res) => {
        res.status(200).json({
            "author": "AndreMor#0008",
            "method": "/ss"
        });
    });

    app.post("/ss", (req, res) => {
        if (req.body.waitUntil && !(['load', 'domcontentloaded', 'networkidle', 'commit'].includes(req.body.waitUntil))) return res.status(400).send({ code: 400, message: "invalid wait time" });
        if (!req.body.url) return res.status(400).send({ code: 400, message: "invalid uri" });
        const url = getURL(req.body.url);
        if (!url) return res.status(400).send({ code: 400, message: "invalid uri" });
        if (!req.body.nsfw) {
            if (checkCleanURL(url)) return res.status(401).send({ code: 401, message: "unappropiate content detected, run again in safe channel" });
        }
        defaultBrowser.newContext({ acceptDownloads: false, colorScheme: 'dark', viewport: { width: parseInt(process.env.WIDTH), height: parseInt(process.env.HEIGHT) } }).then(async (context) => {
            try {
                const page = await context.newPage();
                const response = await page.goto(req.body.url, { waitUntil: req.body.waitUntil || 'load' });
                if (!req.body.nsfw) {
                    if (checkCleanURL(response.url())) return res.status(401).send({ code: 401, message: "unappropiate content detected, run again in safe channel" });
                }
                if (req.body.delay) await page.waitForTimeout(req.body.delay * 1000 || 0);
                const screenshot = await page.screenshot({
                    animations: "disabled",
                    clip: { x: parseInt(req.body.x), y: parseInt(req.body.y), width: parseInt(process.env.WIDTH), height: parseInt(process.env.HEIGHT) },
                    type: "png",
                    fullPage: true
                });;
                if (!req.body.nsfw) {
                    const results = await deepai.callStandardApi("nsfw-detector", { image: screenshot });
                    if (results.output.nsfw_score > 0.4) return res.status(401).send({ code: 401, message: "unappropiate content detected, run again in safe channel" });
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

    app.use("/ss", (req, res) => res.status(405).send({ code: 405, message: "invalid method" }));

    const listener = app.listen(process.env.PORT, () => {
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
