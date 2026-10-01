import express, { NextFunction, Request, Response } from 'express';
import { UserController } from './user.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { UserValidation } from './user.validation';
import { multerUpload } from '../../../config/multer.config';

const router = express.Router();


router.post('/create-admin', UserController.createAdmin);

router.post(
    '/create-doctor', multerUpload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = UserValidation.createDoctorValidationSchema.parse(JSON.parse(req.body.data))
        return UserController.createDoctor(req, res, next)
    }
)

router.post(
    '/create-patient', multerUpload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = UserValidation.createPatientValidationSchema.parse(JSON.parse(req.body.data))
        return UserController.createPatient(req, res, next)
    }
)


router.get('/', auth(UserRole.ADMIN), UserController.getAllUsers)
router.patch('/:id/status', auth(UserRole.ADMIN, UserRole.SUPER_ADMIN), UserController.changeProfileStatus);

export const userRoutes = router