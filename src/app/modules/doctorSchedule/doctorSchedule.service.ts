import { Prisma } from "@prisma/client";
import { addHours, addMinutes, format } from "date-fns";
import { paginationHelper } from "../../helper/paginationHelper";
import { IAuthUser } from "../../interfaces/common";
import { IPaginationOptions } from "../../interfaces/pagination";
import { prisma } from "../../shared/prisma";
import { IJWTPayload } from "../../types";
import { IDoctorScheduleFilterRequest } from "./doctorSchedule.interface";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";



const convertDateTime = async (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + offset);
}

const createDoctorSchedule = async (user: IJWTPayload, payload: any) => {
    const { startDate, endDate, startTime, endTime } = payload;

    const intervalTime = 20;
    const schedules = [];

    const doctorData = await prisma.doctor.findUniqueOrThrow({
        where: {
            email: user.email,
            isDeleted: false
        }
    });

    const currentDate = new Date(startDate);
    const lastDate = new Date(endDate);

    const result = await prisma.$transaction(async (tx) => {
        const doctorSchedule = await tx.doctorSchedules.create({
            data: {
                doctorId: doctorData.id
            }
        });

        while (currentDate <= lastDate) {
            const startDateTime = new Date(
                addMinutes(
                    addHours(
                        `${format(currentDate, "yyyy-MM-dd")}`,
                        Number(startTime.split(":")[0])
                    ),
                    Number(startTime.split(":")[1])
                )
            );

            const endDateTime = new Date(
                addMinutes(
                    addHours(
                        `${format(currentDate, "yyyy-MM-dd")}`,
                        Number(endTime.split(":")[0])
                    ),
                    Number(endTime.split(":")[1])
                )
            );

            while (addMinutes(startDateTime, intervalTime) <= endDateTime) {
                const start = await convertDateTime(startDateTime);
                const end = await convertDateTime(
                    addMinutes(startDateTime, intervalTime)
                );

                const existingSchedule = await tx.schedule.findFirst({
                    where: {
                        doctorSchedules: {
                            doctorId: doctorData.id
                        },
                        startDateTime: {
                            lt: end
                        },
                        endDateTime: {
                            gt: start
                        }
                    }
                });

                if (!existingSchedule) {
                    const schedule = await tx.schedule.create({
                        data: {
                            startDateTime: start,
                            endDateTime: end,
                            doctorScheduleId: doctorSchedule.id
                        }
                    });

                    schedules.push(schedule);
                }

                startDateTime.setMinutes(
                    startDateTime.getMinutes() + intervalTime
                );
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return {
            doctorSchedule
        }
    });

    return result;
};


const getAllFromDB = async (
    filters: IDoctorScheduleFilterRequest,
    options: IPaginationOptions,
) => {
    const { limit, page, skip } = paginationHelper.calculatePagination(options);
    const { searchTerm, ...filterData } = filters;
    const andConditions = [];

    if (searchTerm) {
        andConditions.push({
            doctor: {
                name: {
                    contains: searchTerm,
                    mode: 'insensitive'
                },
            },
        });
    }

    if (Object.keys(filterData).length > 0) {
        if (typeof filterData.isBooked === 'string' && filterData.isBooked === 'true') {
            filterData.isBooked = true;
        }
        else if (typeof filterData.isBooked === 'string' && filterData.isBooked === 'false') {
            filterData.isBooked = false;
        }
        andConditions.push({
            AND: Object.keys(filterData).map((key) => ({
                [key]: {
                    equals: (filterData as any)[key]
                }
            }))
        });
    }

    const whereConditions: any = andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.doctorSchedules.findMany({
        include: {
            doctor: true,
            schedules: true
        },
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            options.sortBy && options.sortOrder ? { [options.sortBy]: options.sortOrder } : {}
    })

    const total = await prisma.doctorSchedules.count({
        where: whereConditions
    })

    return {
        meta: {
            total,
            page,
            limit,
        },
        data: result,
    };

}

const getMySchedule = async (
    filters: any,
    options: IPaginationOptions,
    user: IAuthUser
) => {
    const { limit, page, skip } = paginationHelper.calculatePagination(options);
    const { startDate, endDate, isBooked } = filters;

    const doctorData = await prisma.doctor.findUniqueOrThrow({
        where: {
            email: user?.email
        },
        select: {
            id: true
        }
    });

    const andConditions: Prisma.DoctorSchedulesWhereInput[] = [
        {
            doctorId: doctorData.id
        }
    ];

    const scheduleConditions: Prisma.ScheduleWhereInput = {};

    if (startDate || endDate) {
        if (startDate) {
            scheduleConditions.startDateTime = {
                gte: new Date(startDate)
            };
        }

        if (endDate) {
            scheduleConditions.endDateTime = {
                lte: new Date(endDate)
            };
        }
    }

    if (isBooked !== undefined) {
        scheduleConditions.isBooked =
            isBooked === true || isBooked === "true";
    }

    if (Object.keys(scheduleConditions).length > 0) {
        andConditions.push({
            schedules: {
                some: scheduleConditions
            }
        });
    }

    const whereConditions: Prisma.DoctorSchedulesWhereInput = {
        AND: andConditions
    };

    const result = await prisma.doctorSchedules.findMany({
        where: whereConditions,
        skip,
        take: limit,
        include: {
            doctor: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    contactNumber: true,
                    // specialty: true
                }
            },
            schedules: {
                where: scheduleConditions,
                orderBy: {
                    startDateTime: "asc"
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    const total = await prisma.doctorSchedules.count({
        where: whereConditions
    });

    return {
        meta: {
            total,
            page,
            limit
        },
        data: result
    };
};

// const deleteFromDB = async (user: IAuthUser, scheduleId: string) => {

//     const doctorData = await prisma.doctor.findUniqueOrThrow({
//         where: {
//             email: user?.email
//         }
//     });

//     const isBookedSchedule = await prisma.doctorSchedules.findFirst({
//         where: {
//             doctorId: doctorData.id,
//             scheduleId: scheduleId,
//             isBooked: true
//         }
//     });

//     if (isBookedSchedule) {
//         throw new ApiError(httpStatus.BAD_REQUEST, "You can not delete the schedule because of the schedule is already booked!")
//     }

//     const result = await prisma.doctorSchedules.deleteMany({
//         where: {
//             doctorId: doctorData.id,
//             scheduleId: scheduleId
//         }
//     })
//     return result;

// }

const deleteFromDB = async (user: IAuthUser, scheduleId: string) => {
    const doctorData = await prisma.doctor.findUniqueOrThrow({
        where: {
            email: user?.email
        }
    });

    const schedule = await prisma.schedule.findFirst({
        where: {
            id: scheduleId,
            doctorSchedules: {
                doctorId: doctorData.id
            }
        }
    });

    if (!schedule) {
        throw new ApiError(httpStatus.NOT_FOUND, "Schedule not found!");
    }

    if (schedule.isBooked) {
        throw new ApiError(httpStatus.BAD_REQUEST, "You cannot delete this schedule because it is already booked!");
    }

    const result = await prisma.schedule.delete({
        where: {
            id: schedule.id
        }
    });

    return result;
};


export const DoctorScheduleService = {
    createDoctorSchedule,
    getAllFromDB,
    getMySchedule,
    deleteFromDB
}