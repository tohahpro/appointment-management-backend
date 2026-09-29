import { AuthType, PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import config from "../../config";


const prisma = new PrismaClient();


export const createSuperAdmin = async () => {
    try {
        const existingAdmin = await prisma.user.findFirst({
            where: { role: UserRole.ADMIN },
        });

        if (existingAdmin) {
            console.log("✅ Super Admin already exists");
            return;
        }

        const hashedPassword = await bcrypt.hash(config.superAdmin.password!, Number(config.bcryptSalt));

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name: "Admin",
                    email: config.superAdmin.email!,
                    password: hashedPassword,
                    role: UserRole.ADMIN,
                    status: UserStatus.ACTIVE,
                    authtype: AuthType.LOCAL,
                },
            });

            await tx.admin.create({
                data: { email: user.email },
            });
        });

        console.log("✅ Super Admin Created");
    } catch (error) {
        console.log("❌ Failed to create Super Admin", error);
    }
};