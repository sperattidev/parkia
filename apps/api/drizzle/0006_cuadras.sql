CREATE TYPE "public"."lado_de_cuadra" AS ENUM('par', 'impar');--> statement-breakpoint
CREATE TABLE "cuadras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipio_id" uuid NOT NULL,
	"zona_id" uuid,
	"calle" text NOT NULL,
	"altura_desde" integer NOT NULL,
	"altura_hasta" integer NOT NULL,
	"geometria" geometry(LineString, 4326) NOT NULL,
	"pares_a_la_derecha" boolean DEFAULT true NOT NULL,
	"lugares_par" integer NOT NULL,
	"lugares_impar" integer NOT NULL,
	"lugares_numerados" boolean DEFAULT false NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cuadras_alturas_validas" CHECK ("cuadras"."altura_hasta" > "cuadras"."altura_desde"),
	CONSTRAINT "cuadras_lugares_no_negativos" CHECK ("cuadras"."lugares_par" >= 0 AND "cuadras"."lugares_impar" >= 0)
);
--> statement-breakpoint
DROP INDEX "zonas_area_gist";--> statement-breakpoint
ALTER TABLE "controles" ADD COLUMN "cuadra_id" uuid;--> statement-breakpoint
ALTER TABLE "estacionamientos" ADD COLUMN "cuadra_id" uuid;--> statement-breakpoint
ALTER TABLE "estacionamientos" ADD COLUMN "lado" "lado_de_cuadra";--> statement-breakpoint
ALTER TABLE "estacionamientos" ADD COLUMN "altura" integer;--> statement-breakpoint
ALTER TABLE "estacionamientos" ADD COLUMN "lugar" integer;--> statement-breakpoint
ALTER TABLE "cuadras" ADD CONSTRAINT "cuadras_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuadras" ADD CONSTRAINT "cuadras_zona_id_zonas_id_fk" FOREIGN KEY ("zona_id") REFERENCES "public"."zonas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cuadras_municipio_calle_altura_unica" ON "cuadras" USING btree ("municipio_id","calle","altura_desde");--> statement-breakpoint
CREATE INDEX "cuadras_geometria_gist" ON "cuadras" USING gist ("geometria");--> statement-breakpoint
CREATE INDEX "cuadras_zona" ON "cuadras" USING btree ("zona_id");--> statement-breakpoint
ALTER TABLE "controles" ADD CONSTRAINT "controles_cuadra_id_cuadras_id_fk" FOREIGN KEY ("cuadra_id") REFERENCES "public"."cuadras"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estacionamientos" ADD CONSTRAINT "estacionamientos_cuadra_id_cuadras_id_fk" FOREIGN KEY ("cuadra_id") REFERENCES "public"."cuadras"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estacionamientos_activos_por_cuadra" ON "estacionamientos" USING btree ("cuadra_id","lado") WHERE "estacionamientos"."estado" = 'activo';--> statement-breakpoint
CREATE UNIQUE INDEX "estacionamientos_lugar_activo_unico" ON "estacionamientos" USING btree ("cuadra_id","lado","lugar") WHERE "estacionamientos"."estado" = 'activo' AND "estacionamientos"."lugar" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "zonas" DROP COLUMN "area";--> statement-breakpoint
ALTER TABLE "estacionamientos" ADD CONSTRAINT "estacionamientos_ubicacion_completa" CHECK ("estacionamientos"."cuadra_id" IS NULL OR ("estacionamientos"."lado" IS NOT NULL AND "estacionamientos"."altura" IS NOT NULL));