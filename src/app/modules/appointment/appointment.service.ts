import httpStatus from 'http-status';
import { AppointmentStatus, PaymentStatus, Prisma, UserRole } from "@prisma/client";
import { paginationHelper } from "../../helper/paginationHelper";
import { stripe } from "../../helper/stripe";
import { prisma } from "../../shared/prisma";
import { IJWTPayload } from "../../types";
import { v4 as uuidv4 } from "uuid";
import ApiError from "../../errors/ApiError";
import { IAuthUser } from '../../interfaces/common';



const createAppointment = async (user: IJWTPayload, payload: { doctorId: string, scheduleId: string }) => {
    // Check if patient exists
    const patientData = await prisma.patient.findUnique({
        where: {
            email: user.email,
        },
    });
    if (!patientData) {
        throw new Error("Patient not found");
    }

    // Check if doctor exists
    const doctorData = await prisma.doctor.findUnique({
        where: {
            id: payload.doctorId,
            isDeleted: false
        },
    });
    if (!doctorData) {
        throw new Error("Doctor not found");
    }

    // Check if schedule exists
    const isBookedOrNot = await prisma.schedule.findFirstOrThrow({
        where: {
            doctorId: payload.doctorId,
            id: payload.scheduleId,
            isBooked: false,
        },
    });
    if (isBookedOrNot.isBooked === true) {
        throw new Error("Schedule is already booked");
    }

    // Create video call link
    const videoCallLink = uuidv4();

    const result = await prisma.$transaction(async (tnx) => {
        const appointmentData = await tnx.appointment.create({
            data: {
                patientId: patientData.id,
                doctorId: doctorData.id,
                scheduleId: payload.scheduleId,
                videoCallingID: videoCallLink
            }
        })

        await tnx.schedule.update({
            where: {
                id: payload.scheduleId
            },
            data: {
                isBooked: true
            }
        })
        const transactionId = uuidv4();
        // for strip payment
        const paymentData = await tnx.payment.create({
            data: {
                appointmentId: appointmentData.id,
                amount: doctorData.appointmentFee,
                transactionId: transactionId,

            }
        })


        // strip payment integration will be here
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: user.email,
            line_items: [
                {
                    price_data: {
                        currency: "bdt",
                        product_data: {
                            name: `Appointment with ${doctorData.name}`,
                        },
                        unit_amount: doctorData.appointmentFee * 100,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                appointmentId: appointmentData.id,
                paymentId: paymentData.id
            },
            success_url: `http://localhost:3000/payment/success`,
            cancel_url: `http://localhost:3000/payment-failed`,
        });

        return { paymentUrl: session.url };

    })


    return result;

}

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

    const twentyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

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


const initiatePaymentForAppointment = async (appointmentId: string, user: IAuthUser) => {
    const patientData = await prisma.patient.findUniqueOrThrow({
        where: {
            email: user?.email
        }
    });

    const appointment = await prisma.appointment.findUnique({
        where: {
            id: appointmentId,
            patientId: patientData.id
        },
        include: {
            payment: true,
            doctor: true
        }
    });

    if (!appointment) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Appointment not found or unauthorized");
    }

    if (appointment.paymentStatus !== PaymentStatus.Unpaid) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Payment already completed for this appointment");
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Cannot pay for cancelled appointment");
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: user?.email || '',
        line_items: [
            {
                price_data: {
                    currency: "bdt",
                    product_data: {
                        name: `Appointment with ${appointment.doctor.name}`,
                    },
                    unit_amount: appointment.payment!.amount * 100,
                },
                quantity: 1,
            },
        ],
        metadata: {
            appointmentId: appointment.id,
            paymentId: appointment.payment!.id
        },
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/my-appointments`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/my-appointments`,
    });

    return { paymentUrl: session.url };
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