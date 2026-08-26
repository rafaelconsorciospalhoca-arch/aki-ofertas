-- CreateTable
CREATE TABLE "_BusinessServiceCities" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BusinessServiceCities_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_BusinessServiceCities_B_index" ON "_BusinessServiceCities"("B");

-- AddForeignKey
ALTER TABLE "_BusinessServiceCities" ADD CONSTRAINT "_BusinessServiceCities_A_fkey" FOREIGN KEY ("A") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BusinessServiceCities" ADD CONSTRAINT "_BusinessServiceCities_B_fkey" FOREIGN KEY ("B") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing business keeps serving its own headquarters city
INSERT INTO "_BusinessServiceCities" ("A", "B")
SELECT b.id, c.id
FROM "businesses" b
JOIN "cities" c ON c.name = b.city AND c.state = b.state
ON CONFLICT DO NOTHING;
