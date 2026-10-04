const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface = require("./addon");

serveHTTP(addonInterface, { port: process.env.PORT || 7000 });
console.log("السيرفر يعمل الآن بنجاح جاهز للاستضافة!");
