import { Prisma, Schedule } from "@prisma/client";
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
    const schedules: any[] = [];

    const doctorData = await prisma.doctor.findUniqueOrThrow({
        where: {
            email: user.email,
            isDeleted: false
        }
    });

    const currentDate = new Date(startDate);
    const lastDate = new Date(endDate);

    const result = await prisma.$transaction(async (tx) => {
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
                        doctorId: doctorData.id,
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
                            doctorId: doctorData.id,
                            startDateTime: start,
                            endDateTime: end
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

        return schedules;
    });

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