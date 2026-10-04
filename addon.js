const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const SITES = {
    topcima: "https://topcima.info",
    egydead: "https://egydead.live"
};

const AXIOS_CONFIG = {
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ar,en-US;q=0.9,en;q=0.8"
    },
    timeout: 8000
};

const manifest = {
    id: "community.arabicmultisite",
    version: "1.2.0",
    name: "إضافة توب سينما و إيجي ديد",
    description: "مكتبة مشتركة تعرض المحتوى من موقعي TopCima و EgyDead مباشرة",
    resources: ["catalog", "stream"],
    types: ["movie", "series", "anime"],
    idPrefixes: ["arb_"],
    catalogs: [
        {
            type: "movie",
            id: "arb_all_movies",
            name: "المكتبة المشتركة - أحدث الأفلام",
            extra: [{ name: "search",自由: true }]
        },
        {
            type: "series",
            id: "arb_all_series",
            name: "المكتبة المشتركة - أحدث المسلسلات والأنمي",
            extra: [{ name: "search",自由: true }]
        }
    ]
};

const builder = new addonBuilder(manifest);

async function scrapeTopCima(url) {
    const results = [];
    try {
        const response = await axios.get(url, AXIOS_CONFIG);
        const \$ = cheerio.load(response.data);
        \$(".post-item, .movie-box, article").each((i, el) => {
            const title = \$(el).find("h3, .title, .post-title").text().trim();
            const poster = \$(el).find("img").attr("src") || \$(el).find("img").attr("data-src");
            const pageUrl = \$(el).find("a").attr("href");
            if (title && pageUrl) {
                const customId = "arb_topcima_" + Buffer.from(pageUrl).toString('base64');
                let type = "movie";
                if (title.includes("مسلسل") || title.includes("الحلقة") || title.includes("الموسم")) type = "series";
                if (title.includes("انمي") || title.includes("أنمي")) type = "anime";
                results.push({ id: customId, name: `🎬 [TopCima] ${title}`, poster, type });
            }
        });
    } catch (e) { console.error("خطأ في قشط TopCima:", e.message); }
    return results;
}

async function scrapeEgyDead(url) {
    const results = [];
    try {
        const response = await axios.get(url, AXIOS_CONFIG);
        const \$ = cheerio.load(response.data);
        \$("article, .mov-box, .post-card, .subject").each((i, el) => {
            const title = \$(el).find("h1, h2, h3, .title").text().trim();
            const poster = \$(el).find("img").attr("src") || \$(el).find("img").attr("data-src");
            const pageUrl = \$(el).find("a").attr("href");
            if (title && pageUrl) {
                const customId = "arb_egydead_" + Buffer.from(pageUrl).toString('base64');
                let type = "movie";
                if (title.includes("مسلسل") || title.includes("حلقه") || title.includes("الموسم") || title.includes("الحلقة")) type = "series";
                if (title.includes("انمي") || title.includes("أنمي")) type = "anime";
                results.push({ id: customId, name: `💀 [EgyDead] ${title}`, poster, type });
            }
        });
    } catch (e) { console.error("خطأ في قشط EgyDead:", e.message); }
    return results;
}

builder.defineCatalogHandler(async (args) => {
    let topCimaUrl = SITES.topcima;
    let egyDeadUrl = SITES.egydead;
    if (args.extra && args.extra.search) {
        const query = encodeURIComponent(args.extra.search);
        topCimaUrl = `${SITES.topcima}?s=${query}`;
        egyDeadUrl = `${SITES.egydead}?s=${query}`;
    } else {
        if (args.id === "arb_all_movies") {
            topCimaUrl = `${SITES.topcima}category/movies/`;
            egyDeadUrl = `${SITES.egydead}category/movies/`;
        } else if (args.id === "arb_all_series") {
            topCimaUrl = `${SITES.topcima}category/series/`;
            egyDeadUrl = `${SITES.egydead}category/series/`;
        }
    }
    const [topCimaData, egyDeadData] = await Promise.all([
        scrapeTopCima(topCimaUrl),
        scrapeEgyDead(egyDeadUrl)
    ]);
    return { metas: [...topCimaData, ...egyDeadData] };
});

builder.defineStreamHandler(async (args) => {
    const streams = [];
    if (args.id.startsWith("arb_")) {
        let pageUrl = "";
        let siteLabel = "";
        if (args.id.includes("_topcima_")) {
            const base64Url = args.id.replace("arb_topcima_", "");
            pageUrl = Buffer.from(base64Url, 'base64').toString('ascii');
            siteLabel = "TopCima";
        } else if (args.id.includes("_egydead_")) {
            const base64Url = args.id.replace("arb_egydead_", "");
            pageUrl = Buffer.from(base64Url, 'base64').toString('ascii');
            siteLabel = "EgyDead";
        }
        if (pageUrl) {
            try {
                const response = await axios.get(pageUrl, AXIOS_CONFIG);
                const \$ = cheerio.load(response.data);
                \$("iframe, video, source").each((index, element) => {
                    let streamUrl = \$(element).attr("src") || \$(element).attr("data-src");
                    if (streamUrl) {
                        if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
                        if (!streamUrl.includes("youtube.com") && !streamUrl.includes("googleads")) {
                            streams.push({
                                title: `سيرفر [${siteLabel}] - خيار ${index + 1}`,
                                url: streamUrl
                            });
                        }
                    }
                });
            } catch (error) { console.error(`خطأ في جلب السيرفرات من ${siteLabel}:`, error.message); }
        }
    }
    return { streams: streams };
});

module.exports = builder.getInterface();
      
