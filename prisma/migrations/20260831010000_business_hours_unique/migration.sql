-- AddUniqueConstraint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_businessId_weekday_key" UNIQUE ("businessId", "weekday");
