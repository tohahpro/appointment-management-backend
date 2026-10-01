import express from 'express';
import { userRoutes } from '../modules/user/user.routes';
import { AuthRoutes } from '../modules/auth/auth.route';
import { SpecialtiesRoutes } from '../modules/specialties/specialties.routes';


const router = express.Router();

const moduleRoutes = [
    {
        path: '/users',
        route: userRoutes
    },
    {
        path: '/auth',
        route: AuthRoutes
    },
    {
        path: '/speciality',
        route: SpecialtiesRoutes
    },
];

moduleRoutes.forEach(route => router.use(route.path, route.route))

export default router;