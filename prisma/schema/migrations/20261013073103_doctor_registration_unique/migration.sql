/*
  Warnings:

  - A unique constraint covering the columns `[registrationNumber]` on the table `doctors` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "doctors_registrationNumber_key" ON "doctors"("registrationNumber");
