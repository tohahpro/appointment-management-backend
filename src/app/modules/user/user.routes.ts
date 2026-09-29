import express from 'express';
import { UserController } from './user.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();


router.post('/create-admin', UserController.createAdmin);
router.get('/', auth(UserRole.ADMIN), UserController.getAllUsers)
router.patch('/:id/status', auth(UserRole.ADMIN, UserRole.SUPER_ADMIN), UserController.changeProfileStatus);

export const userRoutes = router