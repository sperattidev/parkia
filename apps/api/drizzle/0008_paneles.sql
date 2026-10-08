CREATE TABLE "registro_de_auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipio_id" uuid,
	"usuario_id" uuid NOT NULL,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" text NOT NULL,
	"antes" jsonb,
	"despues" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membresias" ADD COLUMN "activa" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "debe_cambiar_contrasena" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "administrador_de_parkia" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "registro_de_auditoria" ADD CONSTRAINT "registro_de_auditoria_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro_de_auditoria" ADD CONSTRAINT "registro_de_auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_municipio_creado" ON "registro_de_auditoria" USING btree ("municipio_id","creado_en");--> statement-breakpoint
-- La auditoría es solo de inserción, como el libro de movimientos.
CREATE FUNCTION auditoria_inmutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'El registro de auditoría no se puede modificar ni eliminar'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER auditoria_solo_insercion
  BEFORE UPDATE OR DELETE ON registro_de_auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();
--> statement-breakpoint
CREATE TRIGGER auditoria_sin_truncate
  BEFORE TRUNCATE ON registro_de_auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_inmutable();
