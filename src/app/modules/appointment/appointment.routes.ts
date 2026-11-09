import express from "express";
import { AppointmentController } from "./appointment.controller";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import validateRequest from "../../middlewares/validateRequest";
import { AppointmentValidation } from "./appointment.validation";
import { paymentLimiter } from "../../middlewares/rateLimiter";

const router = express.Router();

router.post("/", auth(UserRole.PATIENT), validateRequest(AppointmentValidation.createAppointment), AppointmentController.createAppointment);

router.get("/", auth(UserRole.ADMIN), AppointmentController.getAllAppointments);

router.get("/my-appointments", auth(UserRole.PATIENT, UserRole.DOCTOR), AppointmentController.getMyAppointments);

router.get("/:id", auth(UserRole.ADMIN), AppointmentController.getAppointmentsById);

router.post('/:id/initiate-payment', auth(UserRole.PATIENT), paymentLimiter, AppointmentController.initiatePayment);

router.patch("/status/:id", auth(UserRole.DOCTOR, UserRole.ADMIN), AppointmentController.updateAppointmentStatus);

export const AppointmentRoutes = router;
