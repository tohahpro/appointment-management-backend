import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { AppointmentService } from "./appointment.service";
import sendResponse from "../../shared/sendResponse";
import { IJWTPayload } from "../../types";
import { pick } from "../../helper/pick";
import { appointmentFilterableFields } from "./appointment.constant";
import httpStatus from "http-status";
import { IAuthUser } from "../../interfaces/common";


const createAppointment = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const result = await AppointmentService.createAppointment(user as IJWTPayload, req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Appointment created successfully!",
        data: result
    })
});

const getMyAppointments = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"])
    const filters = pick(req.query, ["status", "paymentStatus"])

    const user = req.user;
    const result = await AppointmentService.getMyAppointments(user as IJWTPayload, filters, options);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Fetched my appointments successfully!",
        meta: result.meta,
        data: result.data
    })
});

const getAppointmentsById = catchAsync(async (req: Request, res: Response) => {

    const id = req.params.id;
    const result = await AppointmentService.getAppointmentsById(id as string);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Fetched appointment by Id successfully!",
        data: result
    })
});

const getAllAppointments = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"])
    const filters = pick(req.query, appointmentFilterableFields)

    const user = req.user;
    const result = await AppointmentService.getAllAppointments(filters, options);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Fetched all appointments successfully!",
        meta: result.meta,
        data: result.data
    })
});

const updateAppointmentStatus = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;
    const result = await AppointmentService.updateAppointmentStatus(user as IJWTPayload, id as string, status);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Appointment updated successfully!",
        data: result
    })
});


const initiatePayment = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const { id } = req.params;

    const result = await AppointmentService.initiatePaymentForAppointment(id as string, user as IAuthUser);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payment session created successfully",
        data: result
    })
});


export const AppointmentController = {
    createAppointment,
    getMyAppointments,
    getAllAppointments,
    updateAppointmentStatus,
    getAppointmentsById,
    initiatePayment
}