-- Add project-local tags without changing testcase UUIDs or existing relations.
ALTER TABLE "TestCase" ADD COLUMN "tags" TEXT;
