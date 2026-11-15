-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EVENT_CREATED', 'TIER_CREATED', 'EVENT_CANCELLED', 'STAFF_UPDATED', 'PURCHASE', 'LISTED', 'LISTING_CANCELLED', 'RESOLD', 'CHECKED_IN', 'REFUNDED', 'WITHDRAWN', 'ROLE_GRANTED', 'ROLE_REVOKED');

-- CreateTable
CREATE TABLE "Event" (
    "id" INTEGER NOT NULL,
    "organizer" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "metadataURI" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "maxPerWallet" INTEGER NOT NULL,
    "resaleCapPercent" INTEGER NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "revenue" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "createdTx" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tier" (
    "eventId" INTEGER NOT NULL,
    "tierIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(78,0) NOT NULL,
    "supply" INTEGER NOT NULL,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "metadataURI" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Tier_pkey" PRIMARY KEY ("eventId","tierIndex")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "tokenId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "tierIndex" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "pricePaid" DECIMAL(78,0) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "burned" BOOLEAN NOT NULL DEFAULT false,
    "listed" BOOLEAN NOT NULL DEFAULT false,
    "listPrice" DECIMAL(78,0),
    "mintedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("tokenId")
);

-- CreateTable
CREATE TABLE "Staff" (
    "eventId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("eventId","address")
);

-- CreateTable
CREATE TABLE "Organizer" (
    "address" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organizer_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "type" "ActivityType" NOT NULL,
    "eventId" INTEGER,
    "tokenId" INTEGER,
    "from" TEXT,
    "to" TEXT,
    "amount" DECIMAL(78,0),
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "deployBlockHash" TEXT NOT NULL,
    "lastBlock" INTEGER NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_organizer_idx" ON "Event"("organizer");

-- CreateIndex
CREATE INDEX "Event_startTime_idx" ON "Event"("startTime");

-- CreateIndex
CREATE INDEX "Ticket_owner_idx" ON "Ticket"("owner");

-- CreateIndex
CREATE INDEX "Ticket_eventId_listed_idx" ON "Ticket"("eventId", "listed");

-- CreateIndex
CREATE INDEX "Staff_address_idx" ON "Staff"("address");

-- CreateIndex
CREATE INDEX "Activity_eventId_idx" ON "Activity"("eventId");

-- CreateIndex
CREATE INDEX "Activity_tokenId_idx" ON "Activity"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_txHash_logIndex_key" ON "Activity"("txHash", "logIndex");

-- AddForeignKey
ALTER TABLE "Tier" ADD CONSTRAINT "Tier_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_tierIndex_fkey" FOREIGN KEY ("eventId", "tierIndex") REFERENCES "Tier"("eventId", "tierIndex") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
