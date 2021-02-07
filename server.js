require("dotenv").config({ path: __dirname + "/.env" });
const puppeteer = require("puppeteer");
const express = require("express");
const deepai = require("deepai");
const { checkSingleCleanURL } = require("./clean-url/index.js");
deepai.setApiKey(process.env.DEEPAI);
const app = express();
app.use(express.json());

(async () => {
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
        puppeteer.launch({
            headless: true, defaultViewport: {
                width: parseInt(process.env.WIDTH),
                height: parseInt(process.env.HEIGHT)
            }, args: ["--disable-gpu", "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            executablePath: process.env.CHROME_BIN || null
        }).then(async (browser) => {
            try {
                if (!req.body.url) return res.status(400).send("Oye manda un URL primero");
                if (!/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()!@:%_\+.~#?&\/\/=]*)/gm.test(req.body.url)) return res.status(400).send("This is a invalid URL.");
                if (!req.body.nsfw) {
                    if (await checkSingleCleanURL(req.body.url)) return res.status(401).send("NSFW content has been detected in the generated image. If you want to see it, ask for it on a NSFW channel.");
                }
                const page = await browser.newPage();
                await page.goto(req.body.url, { waitUntil: "networkidle2" });
                const options = { x: req.body.x, y: req.body.y };
                if (options && !isNaN(options.x) && !isNaN(options.y)) {
                    screenshot = await page.screenshot({
                        clip: { x: parseInt(options.x), y: parseInt(options.y), width: parseInt(process.env.WIDTH), height: parseInt(process.env.HEIGHT) },
                        type: "png"
                    });
                } else {
                    screenshot = await page.screenshot({ type: "png" });
                }

                if (!req.body.nsfw) {
                    const results = await deepai.callStandardApi("nsfw-detector", { image: screenshot });
                    if (results.output.nsfw_score > 0.5) return res.status(401).send("NSFW content has been detected in the generated image. If you want to see it, ask for it on a NSFW channel.");
                }
                res.set({ 'Content-Type': 'image/png' });
                res.send(screenshot);
            }
            finally {
                browser.close();
            }
        }).catch(err => {
            res.status(500).send(err.toString());
        });
    });

    app.use("/ss", (req, res) => res.status(405).send("Oye no seas loco es con un POST"));

    const listener = app.listen(process.env.PORT, () => {
        console.log("Listening on port " + listener.address().port);
    });
})();