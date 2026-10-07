CREATE TYPE "public"."tipo_de_movimiento" AS ENUM('carga', 'consumo', 'reintegro', 'ajuste');--> statement-breakpoint
CREATE TABLE "billeteras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"municipio_id" uuid NOT NULL,
	"saldo" bigint DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billeteras_saldo_no_negativo" CHECK ("billeteras"."saldo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billetera_id" uuid NOT NULL,
	"tipo" "tipo_de_movimiento" NOT NULL,
	"importe" bigint NOT NULL,
	"saldo_resultante" bigint NOT NULL,
	"referencia" text NOT NULL,
	"descripcion" text NOT NULL,
	"registrado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimientos_importe_no_cero" CHECK ("movimientos"."importe" <> 0),
	CONSTRAINT "movimientos_saldo_no_negativo" CHECK ("movimientos"."saldo_resultante" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vehiculos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"patente" text NOT NULL,
	"alias" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billeteras" ADD CONSTRAINT "billeteras_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billeteras" ADD CONSTRAINT "billeteras_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_billetera_id_billeteras_id_fk" FOREIGN KEY ("billetera_id") REFERENCES "public"."billeteras"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billeteras_usuario_municipio_unico" ON "billeteras" USING btree ("usuario_id","municipio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movimientos_tipo_referencia_unico" ON "movimientos" USING btree ("tipo","referencia");--> statement-breakpoint
CREATE INDEX "movimientos_billetera_creado" ON "movimientos" USING btree ("billetera_id","creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "vehiculos_usuario_patente_unico" ON "vehiculos" USING btree ("usuario_id","patente");