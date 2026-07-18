-- DropIndex
DROP INDEX IF EXISTS "ScriptIntelligenceField_clientId_fieldKey_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ScriptIntelligenceField_clientId_fieldKey_key" ON "ScriptIntelligenceField"("clientId", "fieldKey");
