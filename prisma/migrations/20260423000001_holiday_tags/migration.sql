-- Add greetable, popular, regional tags to holidays

ALTER TABLE "holidays" ADD COLUMN "greetable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "holidays" ADD COLUMN "popular"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "holidays" ADD COLUMN "regional"  BOOLEAN NOT NULL DEFAULT false;
