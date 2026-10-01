import httpStatus from "http-status";
import { Request } from "express";
import bcrypt from "bcryptjs";
import ApiError from "../../errors/ApiError";
import { paginationHelper } from "../../helper/paginationHelper";
import { Admin, Doctor, Patient, Prisma, PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { userSearchableFields } from "./user.constant";
import { fileUploader } from "../../helper/fileUploader";


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

    const file = req.file;

    if (file) {
        const uploadToCloudinary = await fileUploader.uploadToCloudinary(file);
        req.body.doctor.profilePhoto = uploadToCloudinary?.secure_url
    }
    const hashedPassword: string = await bcrypt.hash(req.body.password, 10)

    const userData = {
        email: req.body.doctor.email,
        password: hashedPassword,
        role: UserRole.DOCTOR
    }

    // Extract specialties from doctor data
    const { specialties, ...doctorData } = req.body.doctor;

    const result = await prisma.$transaction(async (transactionClient) => {
        // Step 1: Create user
        await transactionClient.user.create({
            data: userData
        });

        // Step 2: Create doctor
        const createdDoctorData = await transactionClient.doctor.create({
            data: doctorData
        });

        // Step 3: Create doctor specialties if provided
        if (specialties && Array.isArray(specialties) && specialties.length > 0) {
            // Verify all specialties exist
            const existingSpecialties = await transactionClient.specialties.findMany({
                where: {
                    id: {
                        in: specialties,
                    },
                },
                select: {
                    id: true,
                },
            });

            const existingSpecialtyIds = existingSpecialties.map((s) => s.id);
            const invalidSpecialties = specialties.filter(
                (id) => !existingSpecialtyIds.includes(id)
            );

            if (invalidSpecialties.length > 0) {
                throw new Error(
                    `Invalid specialty IDs: ${invalidSpecialties.join(", ")}`
                );
            }

            // Create doctor specialties relations
            const doctorSpecialtiesData = specialties.map((specialtyId) => ({
                doctorId: createdDoctorData.id,
                specialitiesId: specialtyId,
            }));

            await transactionClient.doctorSpecialties.createMany({
                data: doctorSpecialtiesData,
            });
        }

        // Step 4: Return doctor with specialties
        const doctorWithSpecialties = await transactionClient.doctor.findUnique({
            where: {
                id: createdDoctorData.id,
            },
            include: {
                doctorSpecialties: {
                    select: {
                        specialities: {
                            select: {
                                id: true,
                                title: true
                            }
                        }
                    }
                }
            },
        });

        return doctorWithSpecialties!;
    });

    return result;
}

const createPatient = async (req: Request): Promise<Patient> => {

    if (req.file) {
        const uploadResult = await fileUploader.uploadToCloudinary(req.file)
        req.body.patient.profilePhoto = uploadResult?.secure_url

    }
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

    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
    const { searchValue, ...filterData } = params;

    const andConditions: Prisma.UserWhereInput[] = [];

    // Search
    if (searchValue) {
        andConditions.push({
            OR: userSearchableFields.map((field) => ({
                [field]: {
                    contains: searchValue,
                    mode: "insensitive"
                }
            }))
        });
    }

    // Filter
    if (Object.keys(filterData).length > 0) {
        andConditions.push({
            AND: Object.keys(filterData).map((key) => ({
                [key]: {
                    equals: filterData[key]
                }
            }))
        });
    }

    const whereConditions: Prisma.UserWhereInput = {
        AND: andConditions
    };

    const result = await prisma.user.findMany({
        skip,
        take: limit,

        where: whereConditions,

        orderBy: {
            [sortBy]: sortOrder
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
                    email: true,
                    name: true,
                    profilePhoto: true,
                    contactNumber: true,
                    address: true,
                    isDeleted: true,
                    createdAt: true,
                    updatedAt: true
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
                    createdAt: true,
                    updatedAt: true,
                    doctorSpecialties: {
                        select: {
                            specialities: {
                                select: {
                                    id: true,
                                    title: true
                                }
                            }
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
                    createdAt: true,
                    updatedAt: true
                }
            }
        }
    });

    const total = await prisma.user.count({
        where: whereConditions
    });

    return {
        meta: {
            page,
            limit,
            total
        },
        data: result
    };
};

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