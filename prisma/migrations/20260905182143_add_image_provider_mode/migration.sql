-- CreateEnum
CREATE TYPE "ImageProviderMode" AS ENUM ('UNSPLASH', 'RTX');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "imageProviderMode" "ImageProviderMode" NOT NULL DEFAULT 'UNSPLASH';
