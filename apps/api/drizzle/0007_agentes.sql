CREATE TYPE "public"."motivo_de_cierre" AS ENUM('conductor', 'saldo_agotado', 'duracion_maxima');--> statement-breakpoint
DROP INDEX "controles_patente";--> statement-breakpoint
ALTER TABLE "controles" ADD COLUMN "precision_metros" integer;--> statement-breakpoint
ALTER TABLE "estacionamientos" ADD COLUMN "motivo_de_cierre" "motivo_de_cierre";--> statement-breakpoint
CREATE INDEX "controles_cuadra_creado" ON "controles" USING btree ("cuadra_id","creado_en");--> statement-breakpoint
CREATE INDEX "controles_agente_creado" ON "controles" USING btree ("agente_id","creado_en");--> statement-breakpoint
CREATE INDEX "estacionamientos_patente_fin" ON "estacionamientos" USING btree ("municipio_id","patente","fin");--> statement-breakpoint
CREATE INDEX "estacionamientos_vencidos_recientes" ON "estacionamientos" USING btree ("municipio_id","fin") WHERE "estacionamientos"."motivo_de_cierre" = 'saldo_agotado';--> statement-breakpoint
CREATE INDEX "controles_patente" ON "controles" USING btree ("municipio_id","patente","creado_en");--> statement-breakpoint
-- Estacionamientos ya finalizados: el que terminó en su vencimiento se cerró por saldo agotado.
UPDATE "estacionamientos" SET "motivo_de_cierre" = CASE
  WHEN "fin" >= "inicio" + interval '7 days' THEN 'duracion_maxima'::"motivo_de_cierre"
  WHEN "fin" >= "vence_en" THEN 'saldo_agotado'::"motivo_de_cierre"
  ELSE 'conductor'::"motivo_de_cierre"
END WHERE "estado" = 'finalizado';--> statement-breakpoint
ALTER TABLE "estacionamientos" ADD CONSTRAINT "estacionamientos_motivo_de_cierre" CHECK (("estacionamientos"."estado" = 'activo') = ("estacionamientos"."motivo_de_cierre" IS NULL));