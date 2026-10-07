/** Código SQLSTATE de PostgreSQL, buscándolo también en la causa (Drizzle envuelve los errores). */
function codigoSql(error: unknown): string | undefined {
  for (
    let actual = error;
    actual instanceof Object;
    actual = (actual as { cause?: unknown }).cause
  ) {
    const { code } = actual as { code?: unknown };
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

export const esViolacionDeUnicidad = (error: unknown): boolean => codigoSql(error) === '23505';
