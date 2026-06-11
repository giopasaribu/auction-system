-- CreateEnum
CREATE TYPE "TimerMode" AS ENUM ('hard', 'antisnipe');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('scheduled', 'active', 'ended');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('active', 'outbid', 'cancelled', 'won');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minBid" INTEGER NOT NULL DEFAULT 0,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timerMode" "TimerMode" NOT NULL DEFAULT 'hard',
    "antiSnipeMinutes" INTEGER,
    "status" "AuctionStatus" NOT NULL DEFAULT 'scheduled',
    "winnerId" TEXT,
    "winningBid" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCurrentHighest" BOOLEAN NOT NULL DEFAULT false,
    "status" "BidStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");

-- CreateIndex
CREATE INDEX "Bid_itemId_idx" ON "Bid"("itemId");

-- CreateIndex
CREATE INDEX "Bid_playerId_idx" ON "Bid"("playerId");

-- CreateIndex
CREATE INDEX "Bid_itemId_isCurrentHighest_idx" ON "Bid"("itemId", "isCurrentHighest");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
