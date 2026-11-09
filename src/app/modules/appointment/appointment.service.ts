import httpStatus from 'http-status';
import { AppointmentStatus, PaymentStatus, Prisma, UserRole } from "@prisma/client";
import { paginationHelper } from "../../helper/paginationHelper";
import { stripe } from "../../helper/stripe";
import { prisma } from "../../shared/prisma";
import { IJWTPayload } from "../../types";
import { v4 as uuidv4 } from "uuid";
import ApiError from "../../errors/ApiError";
import { IAuthUser } from '../../interfaces/common';



const createAppointment = async (user: IJWTPayload, payload: { doctorId: string; scheduleId: string; }) => {

    const { doctorId, scheduleId } = payload;

    // 1. Check patient
    const patientData = await prisma.patient.findUnique({
        where: {
            email: user.email,
            isDeleted: false
        }
    });

    if (!patientData) {
        throw new Error("PATIENT not found");
    }

    // 2. Check doctor
    const doctorData = await prisma.doctor.findUnique({
        where: {
            id: doctorId,
            isDeleted: false
        }
    });

    if (!doctorData) {
        throw new Error("Doctor not found");
    }

    // 3. Check schedule
    const scheduleData = await prisma.schedule.findUnique({
        where: {
            id: scheduleId
        }
    });

    if (!scheduleData) {
        throw new Error("Schedule not found");
    }

    // 4. Validate schedule ownership
    if (scheduleData.doctorId !== doctorId) {
        throw new Error("This schedule does not belong to the selected doctor");
    }

    // 5. Check booking status
    if (scheduleData.isBooked) {
        throw new Error("Schedule is already booked");
    }

    // 6. Validate schedule time
    if (scheduleData.startDateTime <= new Date()) {
        throw new Error("Cannot book a past schedule");
    }

    // 7. Generate video calling ID
    const videoCallingID = uuidv4();


    // 8. Create appointment using transaction
    const result = await prisma.$transaction(async (tx) => {

        // Reserve schedule atomically
        const reservedSchedule = await tx.schedule.updateMany({
            where: {
                id: scheduleId,
                doctorId,
                isBooked: false,
                startDateTime: {
                    gt: new Date()
                }
            },
            data: {
                isBooked: true
            }
        });

        if (reservedSchedule.count !== 1) {
            throw new Error("Schedule is already booked or unavailable");
        }

        // Create appointment
        const appointmentData = await tx.appointment.create({
            data: {
                patientId: patientData.id,
                doctorId: doctorData.id,
                scheduleId,
                videoCallingID
            }
        });

        // Create payment
        const paymentData = await tx.payment.create({
            data: {
                appointmentId: appointmentData.id,
                amount: doctorData.appointmentFee,
            }
        });

        return {
            appointmentData,
            paymentData
        };
    });

    return result;
};

const getMyAppointments = async (user: IJWTPayload, filters: any, options: any) => {

    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
    const { ...filterData } = filters;

    const andConditions: Prisma.AppointmentWhereInput[] = [];

    if (user.role === UserRole.PATIENT) {
        andConditions.push({
            patient: {
                email: user.email
            }
        })
    }
    else if (user.role === UserRole.DOCTOR) {
        andConditions.push({
            doctor: {
                email: user.email
            }
        })
    }

    if (Object.keys(filterData).length > 0) {
        const filterCondition = Object.keys(filterData).map((key) => ({
            [key]: {
                equals: (filterData as any)[key]
            }
        }))
        andConditions.push(...filterCondition);
    }

    const whereCondition: Prisma.AppointmentWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.appointment.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: {
            [sortBy]: sortOrder
        },
        include: user.role === UserRole.DOCTOR ?
            {
                patient: true,
                schedule: true,
                prescription: true,
                payment: true,
                doctor: {
                    include: {
                        doctorSpecialties: {
                            include: {
                                specialities: true
                            }
                        }
                    }
                },

            } : {
                doctor: {
                    include: {
                        doctorSpecialties: {
                            include: {
                                specialities: true
                            }
                        }
                    }
                },
                schedule: true,
                payment: true,
                patient: true
            }
    })

    const total = await prisma.appointment.count({
        where: whereCondition
    })

    return {
        meta: {
            page, limit, total
        },
        data: result
    }

};

const getAllAppointments = async (filters: any, options: any) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
    const { ...filterData } = filters;

    const andConditions: Prisma.AppointmentWhereInput[] = [];


    if (Object.keys(filterData).length > 0) {
        const filterCondition = Object.keys(filterData).map((key) => ({
            [key]: {
                equals: (filterData as any)[key]
            }
        }))
        andConditions.push(...filterCondition);
    }

    const whereCondition: Prisma.AppointmentWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.appointment.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: {
            [sortBy]: sortOrder
        },
        include: {
            patient: true,
            doctor: true
        },
    })

    const total = await prisma.appointment.count({
        where: whereCondition
    })

    return {
        meta: {
            page, limit, total
        },
        data: result
    }

};

const getAppointmentsById = async (id: string) => {

    const result = await prisma.appointment.findUniqueOrThrow({
        where: { id },
        include: {
            patient: true,
            doctor: true
        },
    })
    return result;
};

const updateAppointmentStatus = async (user: IJWTPayload, appointmentId: string, status: AppointmentStatus) => {

    const appointmentData = await prisma.appointment.findUnique({
        where: {
            id: appointmentId
        },
        include: {
            doctor: true
        }
    });

    if (!appointmentData) {
        throw new Error("Appointment not found");
    }

    if (user.role === UserRole.DOCTOR) {
        if (!(user.email === appointmentData.doctor.email)) {
            throw new ApiError(httpStatus.BAD_REQUEST, "You are not authorized to update this appointment");
        }

        const updatedAppointment = await prisma.appointment.update({
            where: {
                id: appointmentId
            },
            data: {
                status: status
            }
        })
        return updatedAppointment;
    }
}

const cancelUnpaidAppointments = async () => {

    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {

        // 1. Find unpaid appointments older than 20 minutes
        const unpaidAppointments = await tx.appointment.findMany({
            where: {
                createdAt: {
                    lte: twentyMinutesAgo
                },
                payment: {
                    is: {
                        status: PaymentStatus.Unpaid
                    }
                }
            },
            select: {
                id: true,
                scheduleId: true
            }
        });

        if (unpaidAppointments.length === 0) {
            return {
                cancelledAppointments: 0,
                releasedSchedules: 0
            };
        }

        const appointmentIds = unpaidAppointments.map(appointment => appointment.id);

        const scheduleIds = unpaidAppointments.map(appointment => appointment.scheduleId);

        // 2. Delete unpaid payments
        await tx.payment.deleteMany({
            where: {
                appointmentId: { in: appointmentIds },
                status: PaymentStatus.Unpaid
            }
        });

        // 3. Delete appointments
        const deletedAppointments = await tx.appointment.deleteMany({
            where: {
                id: { in: appointmentIds }
            }
        });

        // 4. Release booked schedules
        const releasedSchedules = await tx.schedule.updateMany({
            where: {
                id: {
                    in: scheduleIds
                },
                isBooked: true
            },
            data: {
                isBooked: false
            }
        });

        return {
            cancelledAppointments: deletedAppointments.count,
            releasedSchedules: releasedSchedules.count
        };
    });

    return result;
};


const initiatePaymentForAppointment = async (
    appointmentId: string,
    user: IAuthUser
) => {
    const patientData = await prisma.patient.findUniqueOrThrow({
        where: {
            email: user?.email
        }
    });

    const appointment = await prisma.appointment.findFirst({
        where: {
            id: appointmentId,
            patientId: patientData.id
        },
        include: {
            payment: true
        }
    });

    if (!appointment) {
        throw new ApiError(httpStatus.NOT_FOUND, "Appointment not found or unauthorized");
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Cannot pay for a cancelled appointment");
    }

    if (!appointment.payment) {
        throw new ApiError(httpStatus.NOT_FOUND, "Payment record not found");
    }

    if (
        appointment.paymentStatus !== PaymentStatus.Unpaid ||
        appointment.payment.status !== PaymentStatus.Unpaid
    ) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Payment already completed");
    }

    const result = await prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.updateMany({
            where: {
                id: appointment.payment!.id,
                status: PaymentStatus.Unpaid
            },
            data: {
                status: PaymentStatus.Paid
            }
        });

        if (updatedPayment.count !== 1) {
            throw new ApiError(httpStatus.CONFLICT, "Payment already processed");
        }

        return await tx.appointment.update({
            where: {
                id: appointmentId
            },
            data: {
                paymentStatus: PaymentStatus.Paid
            },
            include: {
                payment: true
            }
        });
    });

    return result;
};

export const AppointmentService = {
    createAppointment,
    getMyAppointments,
    getAllAppointments,
    getAppointmentsById,
    updateAppointmentStatus,
    cancelUnpaidAppointments,
    initiatePaymentForAppointment
};