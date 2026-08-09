/** Icono de cada tipo de trabajo (public/work/*.png). Compartido por la carta TCG (tree y landing). */
import type { WorkType } from './types'

const WORK_ICON_FILE: Record<WorkType, string> = {
  Kindling: 'Kindling',
  Watering: 'Watering',
  Planting: 'Planting',
  GenerateElectricity: 'ElectricityGeneration',
  Handiwork: 'Handiwork',
  Gathering: 'Gathering',
  Lumbering: 'Lumbering',
  Mining: 'Mining',
  MedicineProduction: 'MedicineProduction',
  Cooling: 'Cooling',
  Transporting: 'Transporting',
  Farming: 'Farming',
}

export function workIconUrl(type: WorkType): string {
  return `${import.meta.env.BASE_URL}work/${WORK_ICON_FILE[type]}.png`
}
