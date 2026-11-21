import { Prisma, Schedule } from "@prisma/client";
import { addDays, addHours, addMinutes, format } from "date-fns";
import { paginationHelper } from "../../helper/paginationHelper";
import { IAuthUser } from "../../interfaces/common";
import { IPaginationOptions } from "../../interfaces/pagination";
import { prisma } from "../../shared/prisma";
import { IJWTPayload } from "../../types";
import { IDoctorScheduleFilterRequest } from "./doctorSchedule.interface";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";



// const convertDateTime = async (date: Date) => {
//     const offset = date.getTimezoneOffset() * 60000;
//     return new Date(date.getTime() + offset);
// }

// const createDoctorSchedule = async (user: IJWTPayload, payload: any) => {
//     const { startDate, endDate, startTime, endTime } = payload;

//     const intervalTime = 20;
//     const schedules: any[] = [];

//     const doctorData = await prisma.doctor.findUniqueOrThrow({
//         where: {
//             email: user.email,
//             isDeleted: false
//         }
//     });

//     const currentDate = new Date(startDate);
//     const lastDate = new Date(endDate);

//     const result = await prisma.$transaction(async (tx) => {
//         while (currentDate <= lastDate) {
//             const startDateTime = new Date(
//                 addMinutes(
//                     addHours(
//                         `${format(currentDate, "yyyy-MM-dd")}`,
//                         Number(startTime.split(":")[0])
//                     ),
//                     Number(startTime.split(":")[1])
//                 )
//             );

//             const endDateTime = new Date(
//                 addMinutes(
//                     addHours(
//                         `${format(currentDate, "yyyy-MM-dd")}`,
//                         Number(endTime.split(":")[0])
//                     ),
//                     Number(endTime.split(":")[1])
//                 )
//             );

//             while (addMinutes(startDateTime, intervalTime) <= endDateTime) {
//                 const start = await convertDateTime(startDateTime);
//                 const end = await convertDateTime(
//                     addMinutes(startDateTime, intervalTime)
//                 );

//                 const existingSchedule = await tx.schedule.findFirst({
//                     where: {
//                         doctorId: doctorData.id,
//                         startDateTime: {
//                             lt: end
//                         },
//                         endDateTime: {
//                             gt: start
//                         }
//                     }
//                 });

//                 if (!existingSchedule) {
//                     const schedule = await tx.schedule.create({
//                         data: {
//                             doctorId: doctorData.id,
//                             startDateTime: start,
//                             endDateTime: end
//                         }
//                     });

//                     schedules.push(schedule);
//                 }

//                 startDateTime.setMinutes(
//                     startDateTime.getMinutes() + intervalTime
//                 );
//             }

//             currentDate.setDate(currentDate.getDate() + 1);
//         }

//         return schedules;
//     });

//     return result;
// };


const convertDateTime = async (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + offset);
};

const createDoctorSchedule = async (
    user: IJWTPayload,
    payload: {
        startDate: string;
        endDate: string;
        startTime: string;
        endTime: string;
    }
) => {
    const { startDate, endDate, startTime, endTime } = payload;
    const intervalTime = 20;
    const schedules: any[] = [];

    const doctorData = await prisma.doctor.findUniqueOrThrow({
        where: {
            email: user.email,
            isDeleted: false
        }
    });

    const parseTime = (time: string): number => {
        const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);

        if (!match) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                "Invalid time format. Use HH:mm format."
            );
        }

        return Number(match[1]) * 60 + Number(match[2]);
    };

    const startMinutes = parseTime(startTime);
    const endMinutes = parseTime(endTime);

    if (startMinutes >= endMinutes) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "End time must be greater than start time."
        );
    }

    if (endMinutes - startMinutes < intervalTime) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Schedule duration must be at least 20 minutes."
        );
    }

    const parseDate = (date: string): Date => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                "Invalid date format. Use yyyy-MM-dd."
            );
        }

        const parsedDate = new Date(`${date}T00:00:00.000Z`);

        if (
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== date
        ) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                "Invalid schedule date."
            );
        }

        return parsedDate;
    };

    const firstDate = parseDate(startDate);
    const lastDate = parseDate(endDate);

    if (firstDate > lastDate) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "End date must be greater than or equal to start date."
        );
    }

    const currentDate = new Date(firstDate);

    while (currentDate <= lastDate) {
        const dateString = currentDate.toISOString().slice(0, 10);

        let slotStart = new Date(
            `${dateString}T${startTime}:00.000Z`
        );

        const scheduleEnd = new Date(
            `${dateString}T${endTime}:00.000Z`
        );

        while (addMinutes(slotStart, intervalTime) <= scheduleEnd) {
            const slotEnd = addMinutes(slotStart, intervalTime);

            const start = await convertDateTime(slotStart);
            const end = await convertDateTime(slotEnd);

            schedules.push({
                doctorId: doctorData.id,
                startDateTime: start,
                endDateTime: end
            });

            slotStart = slotEnd;
        }

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    if (schedules.length === 0) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "No valid schedule slots found."
        );
    }

    const result = await prisma.$transaction(
        async (tx) => {
            for (const schedule of schedules) {
                const existingSchedule = await tx.schedule.findFirst({
                    where: {
                        doctorId: doctorData.id,
                        startDateTime: {
                            lt: schedule.endDateTime
                        },
                        endDateTime: {
                            gt: schedule.startDateTime
                        }
                    },
                    select: {
                        id: true,
                        startDateTime: true,
                        endDateTime: true
                    }
                });

                if (existingSchedule) {
                    throw new ApiError(
                        httpStatus.CONFLICT,
                        `A schedule already exists during the selected time on ${format(
                            schedule.startDateTime,
                            "dd MMM yyyy"
                        )}. Please choose another time.`
                    );
                }
            }

            const createdSchedules = [];

            for (const schedule of schedules) {
                const createdSchedule = await tx.schedule.create({
                    data: schedule
                });

                createdSchedules.push(createdSchedule);
            }

            return createdSchedules;
        },
        {
            maxWait: 10000,
            timeout: 30000
        }
    );

    return result;
};


const getMySchedule = async (
    filters: any,
    options: IPaginationOptions,
    user: IAuthUser
) => {
    const { limit, page, skip } = paginationHelper.calculatePagination(options);
    const { startDate, endDate, isBooked } = filters;

    const doctorData = await prisma.doctor.findUniqueOrThrow({
        where: {
            email: user?.email,
            isDeleted: false
        },
        select: {
            id: true
        }
    });

    const whereConditions: Prisma.ScheduleWhereInput = {
        doctorId: doctorData.id
    };

    if (startDate || endDate) {
        const dateFilter: Prisma.DateTimeFilter = {};

        if (startDate) {
            dateFilter.gte = new Date(startDate);
        }

        if (endDate) {
            const nextDay = new Date(endDate);
            nextDay.setUTCDate(nextDay.getUTCDate() + 1);
            dateFilter.lt = nextDay;
        }

        whereConditions.startDateTime = dateFilter;
    }

    if (isBooked !== undefined) {
        whereConditions.isBooked =
            isBooked === true || isBooked === "true";
    }

    const [schedules, total] = await prisma.$transaction([
        prisma.schedule.findMany({
            where: whereConditions,
            skip,
            take: limit,
            orderBy: {
                startDateTime: "asc"
            }
        }),
        prisma.schedule.count({
            where: whereConditions
        })
    ]);

    return {
        meta: {
            total,
            page,
            limit
        },
        data: schedules
    };
};

const getScheduleById = async (id: string): Promise<Schedule | null> => {
    const result = await prisma.schedule.findUnique({
        where: {
            id,
        },
    });

    return result;
};


const deleteFromDB = async (user: IAuthUser, scheduleId: string) => {
    const doctorData = await prisma.doctor.findUniqueOrThrow({
        where: {
            email: user?.email
        }
    });

    const schedule = await prisma.schedule.findFirst({
        where: {
            id: scheduleId,
            doctorId: doctorData.id
        }
    });

    if (!schedule) {
        throw new ApiError(
            httpStatus.NOT_FOUND,
            "Schedule not found!"
        );
    }

    if (schedule.isBooked) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "You cannot delete this schedule because it is already booked!"
        );
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
    getScheduleById,
    getMySchedule,
    deleteFromDB
}