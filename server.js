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
        defaultViewport: {
            width: parseInt(process.env.WIDTH),
            height: parseInt(process.env.HEIGHT)
        },
        chromiumSandbox: false,
        args: ["--disable-dev-shm-usage"],
        executablePath: process.env.CHROME_BIN || null,
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
        defaultBrowser.newContext({ acceptDownloads: false, colorScheme: 'dark' }).then(async (context) => {
            try {
                const page = await context.newPage();
                const response = await page.goto(req.body.url, { waitUntil: req.body.waitUntil || 'domcontentloaded' });
                if (!req.body.nsfw) {
                    if (checkCleanURL(response.url())) return res.status(401).send("NSFW content has been detected in the generated image. If you want to see it, ask for it on a NSFW channel.");
                }
                if (req.body.delay) await page.waitForTimeout(req.body.delay * 1000 || 0);
                let screenshot;
                const options = { x: req.body.x, y: req.body.y };
                if (options && !isNaN(options.x) && !isNaN(options.y)) {
                    screenshot = await page.screenshot({
                        animations: "disabled",
                        clip: { x: parseInt(options.x), y: parseInt(options.y), width: parseInt(process.env.WIDTH), height: parseInt(process.env.HEIGHT) },
                        type: "png"
                    });
                } else {
                    screenshot = await page.screenshot({ animations: "disabled", type: "png" });
                }
                if (!req.body.nsfw) {
                    const results = await deepai.callStandardApi("nsfw-detector", { image: screenshot });
                    if (results.output.nsfw_score > 0.4) return res.status(401).send("NSFW content has been detected in the generated image. If you want to see it, ask for it on a NSFW channel.");
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