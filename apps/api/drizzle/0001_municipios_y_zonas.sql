CREATE TABLE "municipios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"provincia" text NOT NULL,
	"zona_horaria" text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "municipios_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "zonas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"color" text NOT NULL,
	"area" geometry(MultiPolygon, 4326) NOT NULL,
	"regla_tarifaria" jsonb NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zonas" ADD CONSTRAINT "zonas_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "zonas_municipio_nombre_unico" ON "zonas" USING btree ("municipio_id","nombre");--> statement-breakpoint
CREATE INDEX "zonas_area_gist" ON "zonas" USING gist ("area");