-- El libro de movimientos es solo de inserción: una corrección se registra
-- como un nuevo movimiento (ajuste o reintegro), nunca editando el historial.
CREATE FUNCTION movimientos_inmutables() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Los movimientos de billetera no se pueden modificar ni eliminar'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER movimientos_solo_insercion
  BEFORE UPDATE OR DELETE ON movimientos
  FOR EACH ROW EXECUTE FUNCTION movimientos_inmutables();
--> statement-breakpoint
CREATE TRIGGER movimientos_sin_truncate
  BEFORE TRUNCATE ON movimientos
  FOR EACH STATEMENT EXECUTE FUNCTION movimientos_inmutables();
