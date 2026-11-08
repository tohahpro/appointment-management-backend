import { UserRole } from '@prisma/client';
import auth from '../../middlewares/auth';
import { DoctorScheduleController } from './doctorSchedule.controller';
import express from "express";
import validateRequest from '../../middlewares/validateRequest';
import { DoctorScheduleValidation } from './doctorSchedule.validation';

const router = express.Router();

router.post("/", auth(UserRole.DOCTOR), validateRequest(DoctorScheduleValidation.createDoctorScheduleValidation), DoctorScheduleController.createDoctorSchedule)
router.get('/my-schedule', auth(UserRole.DOCTOR), DoctorScheduleController.getMySchedule);
router.delete('/:id', auth(UserRole.DOCTOR), DoctorScheduleController.deleteFromDB);


export const DoctorScheduleRoutes = router;