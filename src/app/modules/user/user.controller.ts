import httpStatus from 'http-status';
import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { UserService } from './user.service';
import { pick } from '../../helper/pick';
import { userFilterableFields } from './user.constant';


const createAdmin = catchAsync(async (req: Request, res: Response) => {

    const result = await UserService.createAdmin(req);
    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Admin Created successfuly!",
        data: result
    })
});


const getAllUsers = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, userFilterableFields)
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"])

    const result = await UserService.getAllUsers(filters, options)

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Data retrieved successfully",
        meta: result.meta,
        data: result.data
    })
})

const changeProfileStatus = catchAsync(async (req: Request, res: Response) => {

    const { id } = req.params;
    const result = await UserService.changeProfileStatus(id as string, req.body)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Users profile status changed!",
        data: result
    })
});



export const UserController = {
    createAdmin,
    getAllUsers,
    changeProfileStatus
}