-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "roundId" TEXT,
ADD COLUMN     "timeOverride" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Item_roundId_idx" ON "Item"("roundId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;
