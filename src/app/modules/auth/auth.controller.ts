import httpStatus from 'http-status';
import { NextFunction, Request, Response } from "express"
import catchAsync from "../../shared/catchAsync"
import sendResponse from "../../shared/sendResponse"
import { AuthService } from './auth.service';
import ApiError from '../../errors/ApiError';
import { jwtHelper } from '../../helper/jwtHelper';
import config from '../../../config';
import { IJWTPayload } from '../../types';

const login = catchAsync(async (req: Request, res: Response) => {

    const result = await AuthService.login(req.body)
    const { accessToken, refreshToken } = result

    res.cookie("accessToken", accessToken, {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 30
    })
    res.cookie("refreshToken", refreshToken, {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 80
    })

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "User Login successfully",
        data: result
    })
})

const logout = catchAsync(async (req: Request, res: Response) => {

    res.clearCookie("accessToken", {
        httpOnly: true,
        secure: false,
        sameSite: "lax"
    })

    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: false,
        sameSite: "lax"
    })

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'User logged out successfully',
        data: null
    })
})

const getMe = catchAsync(async (req: Request, res: Response) => {
    const userSession = req.cookies;
    const result = await AuthService.getMe(userSession);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User retrive successfully!",
        data: result,
    });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
    const { refreshToken } = req.cookies;

    const result = await AuthService.refreshToken(refreshToken);
    res.cookie("accessToken", result.accessToken, {
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60,
    });
    res.cookie("refreshToken", refreshToken, {
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 80
    })

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Access token generated successfully!",
        data: {
            result,
            message: "Access token generated successfully!",
        },
    });
});

const changePassword = catchAsync(
    async (req: Request & { user?: any }, res: Response) => {
        const user = req.user as IJWTPayload;

        const result = await AuthService.changePassword(user as IJWTPayload, req.body);

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Password Changed successfully",
            data: result,
        });
    }
);

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
    await AuthService.forgotPassword(req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Check your email!",
        data: null,
    });
});

const resetPassword = catchAsync(async (req: Request & { user?: any }, res: Response) => {
    // Extract token from Authorization header (remove "Bearer " prefix)
    const authHeader = req.headers.authorization;
    console.log(authHeader);
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    const user = req.user; // Will be populated if authenticated via middleware

    await AuthService.resetPassword(token, req.body, user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Password Reset!",
        data: null,
    });
});

const googleCallbackController = catchAsync(async (req: Request, res: Response, next: NextFunction) => {

    const user = req.user as any;
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User Not Found")
    }

    const jwtPayload = {
        userId: user.userId,
        email: user.email,
        role: user.role
    };

    const accessToken = jwtHelper.generateToken(jwtPayload, config.JWT.JWT_ACCESS_SECRET as string, config.JWT.JWT_ACCESS_EXPIRES as string)

    const refreshToken = jwtHelper.generateToken(jwtPayload, config.JWT.JWT_REFRESH_SECRET as string, config.JWT.JWT_REFRESH_EXPIRES as string)

    res.cookie("accessToken", accessToken, {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 30
    })
    res.cookie("refreshToken", refreshToken, {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 80
    })

    res.redirect(`${config.FRONTEND_URL}`)
})


export const AuthController = {
    login,
    logout,
    getMe,
    refreshToken,
    resetPassword,
    forgotPassword,
    changePassword,
    googleCallbackController,
}