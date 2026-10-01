import { PrismaClient, UserStatus } from "@prisma/client"

import bcrypt from "bcryptjs"
import { jwtHelper } from "../../helper/jwtHelper"
import config from "../../../config"
import httpStatus from "http-status"
import ApiError from "../../errors/ApiError"
import { Secret } from "jsonwebtoken"
import emailSender from "./emailSender"
import { IJWTPayload } from "../../types"

const prisma = new PrismaClient()

const login = async (payload: { email: string, password: string }) => {
    const user = await prisma.user.findUnique({
        where: {
            email: payload.email
        }
    })

    if (!user) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Oops! Email Not Registered !")
    }

    const admin = await prisma.admin.findUnique({
        where: {
            email: payload.email
        }
    })

    const isCorrectPassword = await bcrypt.compare(payload.password, user.password as string)
    if (!isCorrectPassword) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Password is incorrect.")
    }
    const jwtPayload = {
        email: user.email,
        role: user.role
    }
    const accessToken = jwtHelper.generateToken(jwtPayload, config.JWT.JWT_ACCESS_SECRET as string, config.JWT.JWT_ACCESS_EXPIRES as string)

    const refreshToken = jwtHelper.generateToken(jwtPayload, config.JWT.JWT_REFRESH_SECRET as string, config.JWT.JWT_REFRESH_EXPIRES as string)


    return {
        accessToken,
        refreshToken
    };
}

const getMe = async (session: any) => {
    const accessToken = session.accessToken;
    const decodedData = jwtHelper.verifyToken(accessToken, config.JWT.JWT_ACCESS_SECRET as Secret);

    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            email: decodedData.email,
            // status: UserStatus.ACTIVE
        },
        select: {
            id: true,
            email: true,
            role: true,
            status: true,
            authtype: true,
            createdAt: true,
            updatedAt: true,

            admin: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    profilePhoto: true,
                    address: true,
                    contactNumber: true,
                    isDeleted: true,
                }
            },

            doctor: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    profilePhoto: true,
                    contactNumber: true,
                    address: true,
                    registrationNumber: true,
                    experience: true,
                    gender: true,
                    appointmentFee: true,
                    qualification: true,
                    currentWorkingPlace: true,
                    designation: true,
                    averageRating: true,
                    isDeleted: true,


                    doctorSpecialties: {
                        include: {
                            specialities: true
                        }
                    }
                }
            },

            patient: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    profilePhoto: true,
                    address: true,
                    contactNumber: true,
                    isDeleted: true,
                }
            }
        }
    });

    return userData;

}

const refreshToken = async (token: string) => {
    let decodedData;
    try {
        decodedData = jwtHelper.verifyToken(token, config.JWT.JWT_REFRESH_SECRET as Secret);
    }
    catch (err) {
        throw new Error("You are not authorized!")
    }

    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            email: decodedData.email,
            status: UserStatus.ACTIVE
        }
    });

    const accessToken = jwtHelper.generateToken({
        email: userData.email,
        role: userData.role
    },
        config.JWT.JWT_ACCESS_SECRET as Secret,
        config.JWT.JWT_ACCESS_EXPIRES as string
    );

    const refreshToken = jwtHelper.generateToken({
        email: userData.email,
        role: userData.role
    },
        config.JWT.JWT_REFRESH_SECRET as Secret,
        config.JWT.JWT_REFRESH_EXPIRES as string
    );

    return {
        accessToken, refreshToken
    };

};

const changePassword = async (user: IJWTPayload, payload: any) => {
    const userData = await prisma.user.findFirst({
        where: {
            email: user.email,
            status: UserStatus.ACTIVE
        }
    });

    if (!userData) {
        throw new ApiError(httpStatus.BAD_REQUEST, "User not found!")
    }

    const isCorrectPassword: boolean = await bcrypt.compare(payload.oldPassword, userData.password as string);

    if (!isCorrectPassword) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Old password is incorrect!");
    }

    const hashedPassword: string = await bcrypt.hash(payload.newPassword, Number(config.bcryptSalt));

    await prisma.user.update({
        where: {
            email: userData.email
        },
        data: {
            password: hashedPassword
        }
    })

    return {
        message: "Password changed successfully!"
    }
};

const forgotPassword = async (payload: { email: string }) => {
    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            email: payload.email,
            status: UserStatus.ACTIVE
        }
    });

    const resetPassToken = jwtHelper.generateToken(
        { email: userData.email, userId: userData.id, role: userData.role },
        config.JWT.RESET_PASS_SECRET as Secret,
        config.JWT.RESET_PASS_TOKEN_EXPIRES as string
    )

    const resetPassLink = config.JWT.RESET_PASS_LINK + `?email=${encodeURIComponent(userData.email)}&token=${resetPassToken}`;

    await emailSender(
        userData.email,
        `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td align="center" style="padding: 40px 0;">
                        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">TailorDesk</h1>
                                </td>
                            </tr>
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px;">
                                    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                                    <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 24px;">
                                        Hello,
                                    </p>
                                    <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 24px;">
                                        We received a request to reset your password for your <b>TailorDesk</b> account. Click the button below to create a new password:
                                    </p>
                                    <!-- Button -->
                                    <table role="presentation" style="margin: 0 auto;">
                                        <tr>
                                            <td style="border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                                <a href="${resetPassLink}" style="border: none; color: #ffffff; padding: 14px 32px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block; border-radius: 6px;">
                                                    Reset Password
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                    <p style="margin: 30px 0 20px 0; color: #666666; font-size: 14px; line-height: 20px;">
                                        Or copy and paste this link into your browser:
                                    </p>
                                    <p style="margin: 0 0 30px 0; color: #667eea; font-size: 14px; line-height: 20px; word-break: break-all;">
                                        ${resetPassLink}
                                    </p>
                                    <div style="border-top: 1px solid #eeeeee; padding-top: 20px; margin-top: 30px;">
                                        <p style="margin: 0 0 10px 0; color: #999999; font-size: 14px; line-height: 20px;">
                                            <strong>Security Notice:</strong>
                                        </p>
                                        <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #999999; font-size: 14px; line-height: 20px;">
                                            <li>This link will expire in 15 minutes</li>
                                            <li>If you didn't request this password reset, please ignore this email</li>
                                            <li>For security reasons, never share this link with anyone</li>
                                        </ul>
                                    </div>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                                    <p style="margin: 0 0 10px 0; color: #999999; font-size: 14px;">
                                        © ${new Date().getFullYear()} TailorDesk. All rights reserved.
                                    </p>
                                    <p style="margin: 0; color: #999999; font-size: 12px;">
                                        This is an automated email. Please do not reply.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `
    )
};

const resetPassword = async (token: string | null, payload: { email?: string, password: string }, user?: { email: string }) => {
    let userEmail: string;

    // Case 1: Token-based reset (from forgot password email)
    if (token) {
        const decodedToken = jwtHelper.verifyToken(token, config.JWT.RESET_PASS_SECRET as Secret)

        if (!decodedToken) {
            throw new ApiError(httpStatus.FORBIDDEN, "Invalid or expired reset token!")
        }

        // Verify email from token matches the email in payload
        if (payload.email && decodedToken.email !== payload.email) {
            throw new ApiError(httpStatus.FORBIDDEN, "Email mismatch! Invalid reset request.")
        }

        userEmail = decodedToken.email;
    }
    // Case 2: Authenticated user with needPasswordChange (newly created admin/doctor)
    else if (user && user.email) {
        const authenticatedUser = await prisma.user.findUnique({
            where: {
                email: user.email
            }
        });

        if (!authenticatedUser) {
            throw new ApiError(httpStatus.BAD_REQUEST, "User not exists")
        }

        userEmail = user.email;
    }
    else {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid request. Either provide a valid token or be authenticated.")
    }

    // hash password
    const password = await bcrypt.hash(payload.password, Number(config.bcryptSalt));

    // update into database
    await prisma.user.update({
        where: {
            email: userEmail
        },
        data: {
            password,
        }
    })
};


export const AuthService = {
    login,
    getMe,
    refreshToken,
    resetPassword,
    forgotPassword,
    changePassword,
}