import httpStatus from 'http-status';
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { Request, Response } from 'express';
import { SpecialtiesService } from './specialties.service';


const insertSpecialtiesIntoDB = catchAsync(async (req: Request, res: Response) => {
    const result = await SpecialtiesService.insertSpecialtiesIntoDB(req);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Specialties created successfully!",
        data: result
    });
});

const getAllSpecialties = catchAsync(async (req: Request, res: Response) => {
    const result = await SpecialtiesService.getAllSpecialties();
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Specialties data fetched successfully',
        data: result,
    });
});

const deleteSpecialties = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await SpecialtiesService.deleteSpecialties(id as string);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Specialty deleted successfully',
        data: result,
    });
});

export const SpecialtiesController = {
    insertSpecialtiesIntoDB,
    getAllSpecialties,
    deleteSpecialties
}