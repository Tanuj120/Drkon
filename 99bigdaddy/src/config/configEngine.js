import express from 'express';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const viewsDir = path.resolve(__dirname, '..', 'views');
const publicDir = path.resolve(__dirname, '..', 'public');

const configViewEngine = (app) => {
    // #region agent log
    fetch('http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'109959'},body:JSON.stringify({sessionId:'109959',runId:process.env.VERCEL?'vercel-runtime':'local-runtime',hypothesisId:'H4',location:'src/config/configEngine.js:9',message:'Configuring view engine paths',data:{viewsDir,publicDir,isVercel:!!process.env.VERCEL},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.log('[debug] configEngine paths', { viewsDir, publicDir, isVercel: !!process.env.VERCEL });
    app.use(express.static(publicDir));
    app.set('view engine', "ejs");
    app.set('views', viewsDir);
}

export default configViewEngine;