-- CreateEnum
CREATE TYPE "HolidaySignificance" AS ENUM ('major', 'cultural', 'minor');

-- AlterTable
ALTER TABLE "holidays" ADD COLUMN     "significance" "HolidaySignificance" NOT NULL DEFAULT 'minor';
