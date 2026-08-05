/** Marca de Palaxis: un nodo central conectado a tres satelites, evocando el
 * arbol de cruces que genera el planner. Usa currentColor para heredar el
 * color del contenedor, igual que los iconos de lucide a los que reemplaza. */
export function PalaxisMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <circle cx="16" cy="16" r="13.6" stroke="currentColor" strokeOpacity=".28" strokeWidth="1.4" />
      <line x1="16" y1="16" x2="16" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16" y1="16" x2="24.7" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16" y1="16" x2="7.3" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="6" r="2.7" fill="currentColor" />
      <circle cx="24.7" cy="21" r="2.7" fill="currentColor" />
      <circle cx="7.3" cy="21" r="2.7" fill="currentColor" />
      <circle cx="16" cy="16" r="4.4" fill="currentColor" />
    </svg>
  )
}
