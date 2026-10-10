import { Doctor, Prisma, PrismaClient, UserStatus } from "@prisma/client"
import { IOptions, paginationHelper } from "../../helper/paginationHelper"
import { doctorSearchableFields } from "./doctor.constant"

import { IDoctorUpdateInput } from "./doctor.interface"
import ApiError from "../../errors/ApiError"
import httpStatus from "http-status"


export const prisma = new PrismaClient();



const getAllDoctors = async (options: IOptions, filters: any) => {

  const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options)

  const { searchTerm, specialties, ...filterData } = filters

  const andConditions: Prisma.DoctorWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: doctorSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive"
        }
      }))
    })
  }

  if (specialties && specialties.length > 0) {
    // Convert to array if single string
    const specialtiesArray = Array.isArray(specialties) ? specialties : [specialties];

    andConditions.push({
      doctorSpecialties: {
        some: {
          specialities: {
            title: {
              in: specialtiesArray,
              mode: "insensitive"
            }
          }
        }
      }
    })
  }

  if (Object.keys(filterData).length > 0) {
    const filterConditions = Object.keys(filterData).map((key) => ({
      [key]: {
        equals: (filterData as any)[key]
      }
    }))

    andConditions.push(...filterConditions)
  }

  andConditions.push({
    isDeleted: false,
  });

  const whereConditions: Prisma.DoctorWhereInput = andConditions.length > 0 ? { AND: andConditions } : {}


  const result = await prisma.doctor.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy:
      options.sortBy && options.sortOrder
        ? { [options.sortBy]: options.sortOrder }
        : { averageRating: "desc" },
    include: {
      user: {
        select: {
          id: true,
          status: true,
        },
      },
      doctorSpecialties: {
        include: {
          specialities: {
            select: {
              title: true,
            }
          }
        }
      }
    }
  })

  const total = await prisma.doctor.count({
    where: whereConditions
  })

  return {
    meta: {
      total, page, limit
    },
    data: result
  }
}

const updateDoctorProfile = async (id: string, payload: IDoctorUpdateInput) => {
  const { specialties, removeSpecialties, ...doctorData } = payload;

  const doctorInfo = await prisma.doctor.findUniqueOrThrow({
    where: {
      id,
      isDeleted: false,
    },
  });

  await prisma.$transaction(async (transactionClient) => {
    // Step 1: Update doctor basic data
    if (Object.keys(doctorData).length > 0) {
      await transactionClient.doctor.update({
        where: {
          id,
        },
        data: doctorData,
      });
    }

    // Step 2: Remove specialties if provided
    if (
      removeSpecialties &&
      Array.isArray(removeSpecialties) &&
      removeSpecialties.length > 0
    ) {
      // Validate that specialties to remove exist for this doctor
      const existingDoctorSpecialties =
        await transactionClient.doctorSpecialties.findMany({
          where: {
            doctorId: doctorInfo.id,
            specialitiesId: {
              in: removeSpecialties,
            },
          },
        });

      if (existingDoctorSpecialties.length !== removeSpecialties.length) {
        const foundIds = existingDoctorSpecialties.map(
          (ds) => ds.specialitiesId
        );
        const notFound = removeSpecialties.filter(
          (id) => !foundIds.includes(id)
        );
        throw new Error(
          `Cannot remove non-existent specialties: ${notFound.join(", ")}`
        );
      }

      // Delete the specialties
      await transactionClient.doctorSpecialties.deleteMany({
        where: {
          doctorId: doctorInfo.id,
          specialitiesId: {
            in: removeSpecialties,
          },
        },
      });
    }

    // Step 3: Add new specialties if provided
    if (specialties && Array.isArray(specialties) && specialties.length > 0) {
      // Verify all specialties exist in Specialties table
      const existingSpecialties = await transactionClient.specialties.findMany({
        where: {
          id: {
            in: specialties,
          },
        },
        select: {
          id: true,
        },
      });

      const existingSpecialtyIds = existingSpecialties.map((s) => s.id);
      const invalidSpecialties = specialties.filter(
        (id) => !existingSpecialtyIds.includes(id)
      );

      if (invalidSpecialties.length > 0) {
        throw new Error(
          `Invalid specialty IDs: ${invalidSpecialties.join(", ")}`
        );
      }

      // Check for duplicates - don't add specialties that already exist
      const currentDoctorSpecialties =
        await transactionClient.doctorSpecialties.findMany({
          where: {
            doctorId: doctorInfo.id,
            specialitiesId: {
              in: specialties,
            },
          },
          select: {
            specialitiesId: true,
          },
        });

      const currentSpecialtyIds = currentDoctorSpecialties.map(
        (ds) => ds.specialitiesId
      );
      const newSpecialties = specialties.filter(
        (id) => !currentSpecialtyIds.includes(id)
      );

      // Only create new specialties that don't already exist
      if (newSpecialties.length > 0) {
        const doctorSpecialtiesData = newSpecialties.map((specialtyId) => ({
          doctorId: doctorInfo.id,
          specialitiesId: specialtyId,
        }));

        await transactionClient.doctorSpecialties.createMany({
          data: doctorSpecialtiesData,
        });
      }
    }
  });

  // Step 4: Return updated doctor with specialties
  const result = await prisma.doctor.findUnique({
    where: {
      id: doctorInfo.id,
    },
    include: {
      doctorSpecialties: {
        include: {
          specialities: true,
        },
      },
    },
  });

  return result;
};

const getDoctorById = async (id: string): Promise<Doctor | null> => {

  const result = await prisma.doctor.findUnique({
    where: {
      id,
      isDeleted: false,
    },
    include: {
      doctorSpecialties: {
        include: {
          specialities: true,
        },
      },
      doctorSchedules: {
        include: {
          schedule: true
        }
      },
      reviews: true
    },
  });
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Doctor not found");
  }
  return result;
};

const deleteDoctorFromDB = async (id: string): Promise<Doctor> => {
  return await prisma.$transaction(async (transactionClient) => {
    const deleteDoctor = await transactionClient.doctor.delete({
      where: {
        id,
      },
    });

    await transactionClient.user.delete({
      where: {
        email: deleteDoctor.email,
      },
    });

    return deleteDoctor;
  });
};

const softDelete = async (id: string): Promise<Doctor> => {
  return await prisma.$transaction(async (transactionClient) => {
    const deleteDoctor = await transactionClient.doctor.update({
      where: { id },
      data: {
        isDeleted: true,
      },
    });

    await transactionClient.user.update({
      where: {
        email: deleteDoctor.email,
      },
      data: {
        status: UserStatus.DELETED,
      },
    });

    return deleteDoctor;
  });
};


export const DoctorService = {
  getAllDoctors,
  getDoctorById,
  updateDoctorProfile,
  deleteDoctorFromDB,
  softDelete

}