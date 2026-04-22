-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('resolved', 'inferred', 'unknown');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('national', 'religious', 'cultural');

-- CreateEnum
CREATE TYPE "HolidaySource" AS ENUM ('nager', 'openholidays');

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "hs_object_id" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "country_iso" CHAR(2),
    "company" TEXT,
    "owner_id" TEXT,
    "last_activity_at" TIMESTAMPTZ,
    "location_status" "LocationStatus" NOT NULL DEFAULT 'unknown',
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "country_iso" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "HolidayType" NOT NULL,
    "source" "HolidaySource" NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_matches" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "holiday_id" TEXT NOT NULL,
    "alert_7d" BOOLEAN NOT NULL DEFAULT false,
    "alert_1d" BOOLEAN NOT NULL DEFAULT false,
    "week_of" DATE NOT NULL,
    "notified_at" TIMESTAMPTZ,

    CONSTRAINT "holiday_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "greetings" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,

    CONSTRAINT "greetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "hs_owner_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "timezone" TEXT,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("hs_owner_id")
);

-- CreateTable
CREATE TABLE "oauth_tokens" (
    "id" SERIAL NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_hs_object_id_key" ON "contacts"("hs_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_country_iso_name_date_source_key" ON "holidays"("country_iso", "name", "date", "source");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_matches_contact_id_holiday_id_key" ON "holiday_matches"("contact_id", "holiday_id");

-- CreateIndex
CREATE UNIQUE INDEX "greetings_match_id_key" ON "greetings"("match_id");

-- AddForeignKey
ALTER TABLE "holiday_matches" ADD CONSTRAINT "holiday_matches_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_matches" ADD CONSTRAINT "holiday_matches_holiday_id_fkey" FOREIGN KEY ("holiday_id") REFERENCES "holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "greetings" ADD CONSTRAINT "greetings_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "holiday_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
