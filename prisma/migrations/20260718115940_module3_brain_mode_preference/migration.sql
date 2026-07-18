-- CreateEnum
CREATE TYPE "BrainModePreference" AS ENUM ('GUIDED', 'EXPERT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "brainModePreference" "BrainModePreference" NOT NULL DEFAULT 'GUIDED';
