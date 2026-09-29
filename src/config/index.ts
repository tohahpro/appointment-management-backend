import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export default {
    node_env: process.env.NODE_ENV,
    port: process.env.PORT,
    database_url: process.env.DATABASE_URL,
    bcryptSalt: process.env.BCRYPT_SALT,
    superAdmin: {
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD
    },
    cloudinary: {
        cloud_name: process.env.CLOUD_NAME,
        api_key: process.env.API_KEY,
        api_secret: process.env.API_SECRET
    },
    FRONTEND_URL: process.env.FRONTEND_URL,
    JWT: {
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
        JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES,

        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES,

        RESET_PASS_SECRET: process.env.RESET_PASS_SECRET,
        RESET_PASS_TOKEN_EXPIRES: process.env.RESET_PASS_TOKEN_EXPIRES_IN,
        RESET_PASS_LINK: process.env.RESET_PASS_LINK,
    },
    emailSender: {
        email: process.env.EMAIL,
        app_pass: process.env.APP_PASS
    },
    resend: {
        reply_email: process.env.REPLY_EMAIL,
        resend_email: process.env.RESEND_EMAIL,
        resend_api_key: process.env.RESEND_API_KEY
    },
    open_router_api_key: process.env.ROUTER_API_KEY,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebHookSecret: process.env.STRIPE_WEB_HOOK_SECRET,
}