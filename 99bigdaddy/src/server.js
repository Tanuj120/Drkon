import "dotenv/config";

import express from "express";
import configViewEngine from "./config/configEngine.js";
import routes from "./routes/web.js";
import cronJobContronler from "./controllers/cronJobContronler.js";
import socketIoController from "./controllers/socketIoController.js";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.join(__dirname, "public");
const viewsPath = path.join(__dirname, "views");

// console.log("Setting up static files path:", publicPath);

const app = express();
import { createServer } from "http";

const server = createServer(app);
import { Server } from "socket.io";

const io = new Server(server);

const port = process.env.PORT || 3000;
const runId = process.env.VERCEL ? "vercel-runtime" : "local-runtime";

// Normalize SKIP_DB for consistent checks
const _SKIP_DB = (process.env.SKIP_DB || "").toString().trim().toLowerCase();

// #region agent log
fetch("http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": "109959",
  },
  body: JSON.stringify({
    sessionId: "109959",
    runId,
    hypothesisId: "H1",
    location: "src/server.js:29",
    message: "Server bootstrap started",
    data: {
      isVercel: !!process.env.VERCEL,
      nodeEnv: process.env.NODE_ENV || null,
      port,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

app.use(cookieParser());
// app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// setup viewEngine
configViewEngine(app);
// Response rewrite middleware: replace rupee sign with dollar, change language label IND -> US and set default phone dropdown to +1
const countryFlags = {
  "+1": "🇺🇸",
  "+66": "🇹🇭",
  "+62": "🇮🇩",
  "+95": "🇲🇲",
  "+971": "🇦🇪",
  "+54": "🇦🇷",
  "+880": "🇧🇩",
  "+975": "🇧🇹",
  "+267": "🇧🇼",
  "+235": "🇹🇩",
  "+269": "🇰🇲",
  "+20": "🇪🇬",
  "+251": "🇪🇹",
  "+33": "🇫🇷",
  "+995": "🇬🇪",
  "+233": "🇬🇭",
  "+91": "🇮🇳",
  "+39": "🇮🇹",
  "+7": "🇷🇺",
  "+254": "🇰🇪",
  "+231": "🇱🇷",
  "+218": "🇱🇾",
  "+212": "🇲🇦",
  "+977": "🇳🇵",
  "+234": "🇳🇬",
  "+92": "🇵🇰",
  "+51": "🇵🇪",
  "+250": "🇷🇼",
  "+27": "🇿🇦",
  "+94": "🇱🇰",
  "+249": "🇸🇩",
  "+255": "🇹🇿",
  "+90": "🇹🇷",
  "+260": "🇿🇲",
  "+263": "🇿🇼",
};

app.use((req, res, next) => {
  const _send = res.send;
  res.send = function (body) {
    try {
      const isHtmlResponse =
        typeof res.get === "function" &&
        ((res.get("Content-Type") || "").includes("text/html") ||
          (res.get("Content-Type") || "").includes("application/xhtml+xml"));

      if (Buffer.isBuffer(body) && isHtmlResponse) {
        body = body.toString("utf8");
      }

      if (typeof body === "string") {
        if (
          body.includes("</head>") &&
          !body.includes("/css/theme-blue.css") &&
          !body.includes('href="/css/theme-blue.css"')
        ) {
          body = body.replace(
            "</head>",
            '  <link rel="stylesheet" href="/css/theme-blue.css">\n</head>',
          );
        }

        if (body.indexOf("â‚¹") !== -1) body = body.replace(/â‚¹/g, "₹");

        if (body.includes("</body>") && !body.includes("data-drakon-currency-normalizer")) {
          body = body.replace(
            "</body>",
            `<script data-drakon-currency-normalizer>
(function () {
  var keepDollarCurrency = /^\\/wallet\\/(?:recharge|withdrawal)(?:$|\\/)/.test(window.location.pathname) || /^\\/wallet\\/paynow\\/manual_usdt(?:$|\\/)/.test(window.location.pathname);
  if (keepDollarCurrency) return;
  var rupee = "\\u20B9";
  var skipSelector = "script,style,textarea,input,code,pre";
  var normalizeTextNode = function (node) {
    if (!node || node.nodeType !== Node.TEXT_NODE || !node.nodeValue) return;
    if (node.parentElement && node.parentElement.closest(skipSelector)) return;
    var nextValue = node.nodeValue.replace(/\\u00e2\\u201a\\u00b9/g, rupee).replace(/\\$/g, rupee);
    if (nextValue !== node.nodeValue) node.nodeValue = nextValue;
  };
  var normalizeRoot = function (root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      normalizeTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) normalizeTextNode(node);
  };
  normalizeRoot(document.body);
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "characterData") normalizeTextNode(mutation.target);
      mutation.addedNodes && mutation.addedNodes.forEach(normalizeRoot);
    });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
</script>
</body>`,
          );
        }

        // Replace India flag emoji with US flag emoji
        body = body.replace(/🇮🇳/g, "🇺🇸");

        // Replace IND->US in lang-text elements
        body = body.replace(
          /<span[^>]*class=["'][^"']*lang-text[^"']*["'][^>]*>IND<\/span>/g,
          '<span class="lang-text">US</span>',
        );

        // Replace default phone code +91 -> +1
        body = body.replace(
          /(<div[^>]*class=["'][^"']*dropdown__value[^"']*["'][^>]*>\s*<span[^>]*>)(\+91)(<\/span>)/g,
          "$1+1$3",
        );

        // Remove active class from any +91 active list item
        body = body.replace(
          /(<div[^>]*class=["']dropdown__list-item active["'][^>]*>\s*<span[^>]*>\+91<\/span>)/g,
          (m) => m.replace(" active", ""),
        );

        // Set USA +1 list item to active (first matching USA)
        body = body.replace(
          /(<div[^>]*class=["']dropdown__list-item["'][^>]*>\s*<span[^>]*>\+1<\/span>\s*(?:USA|Canada)[^<]*<\/div>)/,
          (m) => m.replace("<div", '<div class="dropdown__list-item active"'),
        );

        // Add country flags to dropdown items
        Object.entries(countryFlags).forEach(([code, flag]) => {
          const pattern = new RegExp(
            `(<div[^>]*class=["']dropdown__list-item[^"']*["'][^>]*>\\s*<span[^>]*>)${code.replace(/\+/g, "\\+")}(<\\/span>)`,
            "g",
          );
          body = body.replace(pattern, `$1${flag} ${code}$2`);
        });
      }
    } catch (e) {}
    return _send.call(this, body);
  };
  next();
});

// init Web Routes
routes.initWebRouter(app);

if (!process.env.VERCEL && _SKIP_DB !== "true") {
  // Cron game 1 Phut
  // #region agent log
  fetch("http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "109959",
    },
    body: JSON.stringify({
      sessionId: "109959",
      runId,
      hypothesisId: "H3",
      location: "src/server.js:46",
      message: "Starting cron jobs in non-serverless mode",
      data: { isVercel: !!process.env.VERCEL },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  cronJobContronler.cronJobGame1p(io);

  // Check xem ai connect vao server
  // #region agent log
  fetch("http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "109959",
    },
    body: JSON.stringify({
      sessionId: "109959",
      runId,
      hypothesisId: "H2",
      location: "src/server.js:52",
      message: "Initializing socket admin channel in non-serverless mode",
      data: { isVercel: !!process.env.VERCEL },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  socketIoController.sendMessageAdmin(io);
} else if (_SKIP_DB === "true") {
  console.warn(
    "[dev] SKIP_DB=true — cron jobs and admin socket initialization skipped for local testing",
  );
}

// Rendering the index.ejs view in a route
app.get("/", (req, res) => {
  res.render("home/index"); // Ensure 'home/index' matches the actual path to the view file
});

app.get("/__health", (_req, res) => {
  // #region agent log
  fetch("http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "109959",
    },
    body: JSON.stringify({
      sessionId: "109959",
      runId,
      hypothesisId: "H6",
      location: "src/server.js:63",
      message: "Health route served",
      data: {
        isVercel: !!process.env.VERCEL,
        nodeEnv: process.env.NODE_ENV || null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  console.log("[debug] health route", {
    isVercel: !!process.env.VERCEL,
    nodeEnv: process.env.NODE_ENV || null,
  });
  res.status(200).json({ ok: true, isVercel: !!process.env.VERCEL });
});

// #region agent log
fetch("http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": "109959",
  },
  body: JSON.stringify({
    sessionId: "109959",
    runId,
    hypothesisId: "H4",
    location: "src/server.js:56",
    message: "View path state",
    data: { __dirname, viewsPath, publicPath },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion
console.log("[debug] server view path state", {
  __dirname,
  viewsPath,
  publicPath,
  isVercel: !!process.env.VERCEL,
});

if (!process.env.VERCEL) {
  // #region agent log
  fetch("http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "109959",
    },
    body: JSON.stringify({
      sessionId: "109959",
      runId,
      hypothesisId: "H1",
      location: "src/server.js:69",
      message: "About to call server.listen in non-serverless mode",
      data: { port, isVercel: !!process.env.VERCEL },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  server.listen(port, () => {
    console.log("Connected success port: " + port);
  });
}

export default app;
