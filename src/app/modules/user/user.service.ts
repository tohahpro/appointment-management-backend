import httpStatus from "http-status";
import { Request } from "express";
import bcrypt from "bcryptjs";
import ApiError from "../../errors/ApiError";
import { paginationHelper } from "../../helper/paginationHelper";
import { Admin, Doctor, Patient, Prisma, PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { userSearchableFields } from "./user.constant";


export const prisma = new PrismaClient();


const createAdmin = async (req: Request): Promise<Admin> => {

    const hashedPassword: string = await bcrypt.hash(req.body.password, 10)
    if (!hashedPassword) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Password is required !!")
    }

    const email = req.body.admin.email;
    if (!email) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Email is required !!")
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new ApiError(httpStatus.CONFLICT, "Email already in use! Please use another email.");
    }

    const userData = {
        email: req.body.admin.email,
        password: hashedPassword,
        role: UserRole.ADMIN
    }

    const result = await prisma.$transaction(async (transactionClient) => {
        await transactionClient.user.create({
            data: userData
        });

        const createdAdminData = await transactionClient.admin.create({
            data: req.body.admin
        });

        return createdAdminData;
    });

    return result;
};

const createDoctor = async (req: Request): Promise<Doctor> => {
    const password = req.body.password;
    if (!password) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Password is required !!");
    }

    const doctorData = req.body.doctor;
    if (!doctorData?.email) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Email is required !!");
    }

    const existingUser = await prisma.user.findUnique({
        where: {
            email: doctorData.email
        }
    });

    if (existingUser) {
        throw new ApiError(httpStatus.CONFLICT, "Email already in use! Please use another email.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
        email: doctorData.email,
        password: hashedPassword,
        role: UserRole.DOCTOR,
        status: UserStatus.INACTIVE
    };

    const result = await prisma.$transaction(async (transactionClient) => {
        await transactionClient.user.create({
            data: userData
        });

        const createdDoctor = await transactionClient.doctor.create({
            data: doctorData
        });

        return createdDoctor;
    });

    return result;
};

const createPatient = async (req: Request): Promise<Patient> => {

    const password = req.body.password;
    if (!password) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Password is required !!");
    }

    const patientData = req.body.patient;
    if (!patientData?.email) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Email is required !!");
    }

    const existingUser = await prisma.user.findUnique({
        where: {
            email: patientData.email
        }
    });

    if (existingUser) {
        throw new ApiError(httpStatus.CONFLICT, "Email already in use! Please use another email.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
        email: patientData.email,
        password: hashedPassword,
        role: UserRole.PATIENT,
        status: UserStatus.ACTIVE
    };

    const result = await prisma.$transaction(async (transactionClient) => {
        await transactionClient.user.create({
            data: userData
        });

        const createdPatient = await transactionClient.patient.create({
            data: patientData
        });

        return createdPatient;
    });

    return result;
};

const getAllUsers = async (params: any, options: any) => {

    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options)
    const { searchValue, ...filterData } = params;


    const andConditions: Prisma.UserWhereInput[] = []

    if (searchValue) {
        andConditions.push({
            OR: userSearchableFields.map(field => ({
                [field]: {
                    contains: options.searchValue,
                    mode: "insensitive"
                }
            }))
        })
    }

    // filter 
    if (Object.keys(filterData).length > 0) {
        andConditions.push({
            AND: Object.keys(filterData).map(key => ({
                [key]: {
                    equals: (filterData as any)[key]
                }
            }))
        })
    }
    const whereConditions = andConditions.length > 0 ? { AND: andConditions } : {}

    const result = await prisma.user.findMany({
        skip,
        take: limit,

        where: whereConditions,
        orderBy: { [sortBy]: sortOrder }
    });

    const total = await prisma.user.count({
        where: whereConditions
    })

    return {
        meta: {
            page,
            limit,
            total
        },
        data: result
    }
}

const changeProfileStatus = async (id: string, payload: { status: UserStatus }) => {
    const userData = await prisma.user.findUnique({
        where: { id }
    })

    if (!userData) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'User is not exists')
    }

    const updateUserStatus = await prisma.user.update({
        where: { id },
        data: payload,
        select: {
            id: true,
            email: true,
            role: true,
            status: true,
            authtype: true,
            createdAt: true,
            updatedAt: true
        }
    })

    return updateUserStatus;
};



export const UserService = {
    createAdmin,
    createDoctor,
    createPatient,
    getAllUsers,
    changeProfileStatus
}