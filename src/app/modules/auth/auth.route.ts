import express, { NextFunction, Request, Response } from 'express'
import { AuthController } from './auth.controller';
import passport from "passport";
import config from '../../../config';
import { UserRole } from '@prisma/client';
import auth from '../../middlewares/auth';

const router = express.Router();

router.post('/login', AuthController.login)
router.post('/logout', AuthController.logout)
router.get("/me", AuthController.getMe)
router.post('/refresh-token', AuthController.refreshToken)
router.post('/change-password', auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.PATIENT), AuthController.changePassword);
router.post('/forgot-password', AuthController.forgotPassword);
router.post(
    '/reset-password',
    (req: Request, res: Response, next: NextFunction) => {
        //user is resetting password without token and logged in newly created admin or doctor
        if (!req.headers.authorization && req.cookies.accessToken) {
            auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.PATIENT)(req, res, next);
        } else {
            //user is resetting password via email link with token
            next();
        }
    },
    AuthController.resetPassword
)

router.get('/google', passport.authenticate("google", { scope: ["profile", "email"] }))
router.get('/google/callback', passport.authenticate('google', { failureRedirect: `${config.FRONTEND_URL}/login?error=There is some issues with your account. Please contact with our support team!` }), AuthController.googleCallbackController)


export const AuthRoutes = router