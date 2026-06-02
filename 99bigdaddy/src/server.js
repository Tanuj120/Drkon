import 'dotenv/config';

import express from 'express';
import configViewEngine from './config/configEngine.js';
import routes from './routes/web.js';
import cronJobContronler from './controllers/cronJobContronler.js';
import socketIoController from './controllers/socketIoController.js';
import path from 'path';
import cookieParser from 'cookie-parser';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const publicPath = path.join(__dirname, 'public');
const viewsPath = path.join(__dirname, 'views');

// console.log("Setting up static files path:", publicPath);

const app = express();
import { createServer } from 'http';

const server = createServer(app);
import { Server } from 'socket.io';

const io = new Server(server);

const port = process.env.PORT || 3000;
const runId = process.env.VERCEL ? 'vercel-runtime' : 'local-runtime';

// #region agent log
fetch('http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'109959'},body:JSON.stringify({sessionId:'109959',runId,hypothesisId:'H1',location:'src/server.js:29',message:'Server bootstrap started',data:{isVercel:!!process.env.VERCEL,nodeEnv:process.env.NODE_ENV||null,port},timestamp:Date.now()})}).catch(()=>{});
// #endregion

app.use(cookieParser());
// app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// setup viewEngine
configViewEngine(app);
// init Web Routes
routes.initWebRouter(app);

if (!process.env.VERCEL) {
    // Cron game 1 Phut
    // #region agent log
    fetch('http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'109959'},body:JSON.stringify({sessionId:'109959',runId,hypothesisId:'H3',location:'src/server.js:46',message:'Starting cron jobs in non-serverless mode',data:{isVercel:!!process.env.VERCEL},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    cronJobContronler.cronJobGame1p(io);

    // Check xem ai connect vào sever
    // #region agent log
    fetch('http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'109959'},body:JSON.stringify({sessionId:'109959',runId,hypothesisId:'H2',location:'src/server.js:52',message:'Initializing socket admin channel in non-serverless mode',data:{isVercel:!!process.env.VERCEL},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    socketIoController.sendMessageAdmin(io);
}

// Rendering the index.ejs view in a route
app.get('/', (req, res) => {
    res.render('home/index'); // Ensure 'home/index' matches the actual path to the view file
});

app.get('/__health', (_req, res) => {
    // #region agent log
    fetch('http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'109959'},body:JSON.stringify({sessionId:'109959',runId,hypothesisId:'H6',location:'src/server.js:63',message:'Health route served',data:{isVercel:!!process.env.VERCEL,nodeEnv:process.env.NODE_ENV||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.log('[debug] health route', { isVercel: !!process.env.VERCEL, nodeEnv: process.env.NODE_ENV || null });
    res.status(200).json({ ok: true, isVercel: !!process.env.VERCEL });
});

// #region agent log
fetch('http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'109959'},body:JSON.stringify({sessionId:'109959',runId,hypothesisId:'H4',location:'src/server.js:56',message:'View path state',data:{__dirname,viewsPath,publicPath},timestamp:Date.now()})}).catch(()=>{});
// #endregion
console.log('[debug] server view path state', { __dirname, viewsPath, publicPath, isVercel: !!process.env.VERCEL });

if (!process.env.VERCEL) {
    // #region agent log
    fetch('http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'109959'},body:JSON.stringify({sessionId:'109959',runId,hypothesisId:'H1',location:'src/server.js:69',message:'About to call server.listen in non-serverless mode',data:{port,isVercel:!!process.env.VERCEL},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    server.listen(port, () => {
        console.log("Connected success port: " + port);
    });
}

export default app;

