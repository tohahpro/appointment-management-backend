import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { DoctorService } from "./doctor.service";
import { pick } from "../../helper/pick";
import { doctorFilterableFields } from "./doctor.constant";


const getAllDoctors = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"])
    const filters = pick(req.query, doctorFilterableFields)

    const result = await DoctorService.getAllDoctors(options, filters);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Doctor retrieved successfully!",
        meta: result.meta,
        data: result.data
    })
});

const updateDoctorProfile = catchAsync(async (req: Request, res: Response) => {

    const { id } = req.params;
    const payload = req.body;

    const result = await DoctorService.updateDoctorProfile(id as string, payload);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Profile update successfully!",
        data: result
    })
});

const getDoctorById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await DoctorService.getDoctorById(id as string);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Doctor retrieval successfully',
        data: result,
    });
});

const deleteDoctorFromDB = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await DoctorService.deleteDoctorFromDB(id as string);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Doctor deleted successfully',
        data: result,
    });
});


const softDelete = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await DoctorService.softDelete(id as string);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Doctor soft deleted successfully',
        data: result,
    });
});

export const DoctorController = {
    getAllDoctors,
    getDoctorById,
    updateDoctorProfile,
    deleteDoctorFromDB,
    softDelete
}