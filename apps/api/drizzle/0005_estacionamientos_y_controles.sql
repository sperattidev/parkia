CREATE TYPE "public"."estado_de_estacionamiento" AS ENUM('activo', 'finalizado');--> statement-breakpoint
CREATE TYPE "public"."resultado_de_control" AS ENUM('habilitado', 'fuera_de_horario', 'sin_estacionamiento', 'vencido', 'otra_zona', 'fuera_de_zona');--> statement-breakpoint
CREATE TABLE "controles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipio_id" uuid NOT NULL,
	"agente_id" uuid NOT NULL,
	"patente" text NOT NULL,
	"zona_id" uuid,
	"estacionamiento_id" uuid,
	"ubicacion" geometry(Point, 4326) NOT NULL,
	"resultado" "resultado_de_control" NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estacionamientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipio_id" uuid NOT NULL,
	"zona_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"patente" text NOT NULL,
	"regla_aplicada" jsonb NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"vence_en" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone,
	"importe" bigint,
	"estado" "estado_de_estacionamiento" DEFAULT 'activo' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estacionamientos_finalizado_completo" CHECK ("estacionamientos"."estado" = 'activo' OR ("estacionamientos"."fin" IS NOT NULL AND "estacionamientos"."importe" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "controles" ADD CONSTRAINT "controles_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controles" ADD CONSTRAINT "controles_agente_id_usuarios_id_fk" FOREIGN KEY ("agente_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controles" ADD CONSTRAINT "controles_zona_id_zonas_id_fk" FOREIGN KEY ("zona_id") REFERENCES "public"."zonas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controles" ADD CONSTRAINT "controles_estacionamiento_id_estacionamientos_id_fk" FOREIGN KEY ("estacionamiento_id") REFERENCES "public"."estacionamientos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estacionamientos" ADD CONSTRAINT "estacionamientos_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estacionamientos" ADD CONSTRAINT "estacionamientos_zona_id_zonas_id_fk" FOREIGN KEY ("zona_id") REFERENCES "public"."zonas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estacionamientos" ADD CONSTRAINT "estacionamientos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "controles_municipio_creado" ON "controles" USING btree ("municipio_id","creado_en");--> statement-breakpoint
CREATE INDEX "controles_patente" ON "controles" USING btree ("patente");--> statement-breakpoint
CREATE UNIQUE INDEX "estacionamientos_patente_activa_unica" ON "estacionamientos" USING btree ("municipio_id","patente") WHERE "estacionamientos"."estado" = 'activo';--> statement-breakpoint
CREATE UNIQUE INDEX "estacionamientos_usuario_activo_unico" ON "estacionamientos" USING btree ("usuario_id","municipio_id") WHERE "estacionamientos"."estado" = 'activo';--> statement-breakpoint
CREATE INDEX "estacionamientos_activos_por_vencimiento" ON "estacionamientos" USING btree ("vence_en") WHERE "estacionamientos"."estado" = 'activo';--> statement-breakpoint
CREATE INDEX "estacionamientos_usuario_inicio" ON "estacionamientos" USING btree ("usuario_id","inicio");