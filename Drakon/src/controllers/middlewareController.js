import connection from '../config/connectDB.js';

const isLocalBypass = (process.env.SKIP_DB || '').toString().trim().toLowerCase() === 'true';

const middlewareController = async (req, res, next) => {
    if (isLocalBypass) {
        return next();
    }

    const auth = req.cookies.auth;
    if (!auth) return res.redirect('/login');

    try {
        const [rows] = await connection.execute('SELECT `token`, `status` FROM `users` WHERE `token` = ? AND `veri` = 1', [auth]);
        if (!rows || rows.length === 0) {
            res.clearCookie('auth');
            res.clearCookie('token');
            return res.redirect('/login');
        }

        if (auth == rows[0].token && rows[0].status == '1') {
            return next();
        }

        res.clearCookie('auth');
        res.clearCookie('token');
        return res.redirect('/login');
    } catch (error) {
        res.clearCookie('auth');
        res.clearCookie('token');
        return res.redirect('/login');
    }
};

export default middlewareController;
