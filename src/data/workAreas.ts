/**
 * Work areas offered when starting a shift, until an administrator adds the zones of the site (Admin, Zones).
 * Once there is even one zone, only the administrator's zones are offered, so that records use the site's own names.
 */
export const DEFAULT_WORK_AREAS: string[] = [
  'Import Warehouse',
  'Export Warehouse',
  'Cold Chain',
  'Dangerous Goods Store',
  'Build-up Area',
  'Breakdown Area',
  'Transit Shed',
  'Customs Bonded Store',
  'Ramp',
  'Mail and Courier',
  'Equipment Bay',
];

/** Marks the choice "some other area", which the person then types. */
export const OTHER_AREA = '__other__';

/** The area to preselect: the person's own department if it is on the list, otherwise the first one. */
export function preselectArea(names: string[], department: string): string {
  const own = names.find((name) => name.toLowerCase() === department.trim().toLowerCase());
  return own ?? names[0];
}
