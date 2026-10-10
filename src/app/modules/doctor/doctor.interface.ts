import { Gender } from "@prisma/client";

export type IDoctorUpdateInput = {
  name?: string;
  profilePhoto?: string;
  contactNumber?: string;
  address?: string;
  registrationNumber?: string;
  experience?: number;
  gender?: Gender;
  appointmentFee?: number;
  qualification?: string;
  currentWorkingPlace?: string;
  designation?: string;
  // NEW: Simplified specialty management
  specialties?: string[]; // Array of specialty IDs to add
  removeSpecialties?: string[]; // Array of specialty IDs to remove
};

export type ISpecialties = {
  specialtiesId: string;
  isDeleted?: null;
};
