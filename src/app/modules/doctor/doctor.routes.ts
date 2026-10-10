import express from 'express';
import { DoctorController } from './doctor.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';


const router = express.Router();


router.get('/', DoctorController.getAllDoctors)
router.get('/:id', DoctorController.getDoctorById);
router.patch('/:id', DoctorController.updateDoctorProfile)
router.delete('/:id', DoctorController.deleteDoctorFromDB);
router.delete('/soft/:id', auth(UserRole.ADMIN), DoctorController.softDelete);


export const DoctorRoutes = router;