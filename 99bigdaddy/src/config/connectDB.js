//const mysql = require('mysql2/promise');
import mysql from 'mysql2/promise';

// const connection = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'lawra',
// });
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
};

const connection = mysql.createPool(dbConfig);

async function testConnection() {
    try {
        // #region agent log
        fetch('http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'109959'},body:JSON.stringify({sessionId:'109959',runId:process.env.VERCEL?'vercel-runtime':'local-runtime',hypothesisId:'H5',location:'src/config/connectDB.js:30',message:'Testing database connectivity',data:{isVercel:!!process.env.VERCEL,hasHost:!!dbConfig.host,hasUser:!!dbConfig.user,hasDatabase:!!dbConfig.database,port:dbConfig.port},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const [rows, fields] = await connection.query('SELECT 1 + 1 AS solution');
        console.log('Database connection successful. Test query result:', rows[0].solution); // Should log: 2
    } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'109959'},body:JSON.stringify({sessionId:'109959',runId:process.env.VERCEL?'vercel-runtime':'local-runtime',hypothesisId:'H5',location:'src/config/connectDB.js:36',message:'Database connection failed',data:{isVercel:!!process.env.VERCEL,errorCode:error?.code||null,errorMessage:error?.message||null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        console.error('Error connecting to the database:', error);
    }
}

if (!process.env.VERCEL) {
    testConnection();
}

export default connection;
