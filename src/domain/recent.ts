/**
 * Lista de "seleccionados recientemente" para los buscadores (Pal objetivo,
 * pasivas...), al estilo de la paleta de comandos de VSCode. Persistida en
 * localStorage con el mismo patron que src/domain/projects.ts. Es puramente
 * de interfaz: no afecta al calculo ni se mezcla con el estado del plan.
 */
const MAX_RECENT = 6

function keyFor(namespace: string): string {
  return `pbp:recent:${namespace}`
}

export function getRecentIds(namespace: string): string[] {
  try {
    const raw = localStorage.getItem(keyFor(namespace))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Mueve `id` al frente de la lista de recientes (sin duplicados), recortada a MAX_RECENT. */
export function pushRecentId(namespace: string, id: string): string[] {
  const current = getRecentIds(namespace)
  const next = [id, ...current.filter((x) => x !== id)].slice(0, MAX_RECENT)
  try {
    localStorage.setItem(keyFor(namespace), JSON.stringify(next))
  } catch {
    // localStorage lleno o bloqueado: los recientes son un extra, no algo critico.
  }
  return next
}
