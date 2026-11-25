/**
 * Ready-made wording for the four SBAR parts, for cargo and warehouse handovers. A person picks one from a list and
 * adds only what is unusual, so a routine update takes a few taps instead of four paragraphs of typing.
 * All wording is general; it names no customer, flight or person.
 */

export interface SbarTemplate {
  id: string;
  /** Short name shown in the list. */
  label: string;
  /** The sentence that is saved in the update. */
  text: string;
}

export type SbarPart = 'situation' | 'background' | 'assessment' | 'recommendation';

export const SITUATION_TEMPLATES: SbarTemplate[] = [
  { id: 's-routine', label: 'Routine, nothing unusual', text: 'Routine shift. Nothing unusual to report in this area.' },
  { id: 's-customs', label: 'Shipment held for customs', text: 'A shipment is on hold, waiting for customs clearance.' },
  { id: 's-docs', label: 'Documents missing or wrong', text: 'A shipment is held because its documents are missing or do not match the cargo.' },
  { id: 's-damaged', label: 'Damaged cargo', text: 'Cargo was found damaged and has been set aside.' },
  { id: 's-dg', label: 'Dangerous goods in the area', text: 'Dangerous goods are in the area and need special handling.' },
  { id: 's-cold', label: 'Cold room or perishables', text: 'A cold room or a perishable shipment needs close monitoring.' },
  { id: 's-equipment', label: 'Equipment fault', text: 'A piece of equipment is faulty or out of service.' },
  { id: 's-delay', label: 'Flight or delivery delayed', text: 'A flight or a cargo delivery is delayed and work is waiting.' },
  { id: 's-backlog', label: 'Backlog waiting', text: 'A backlog of cargo is waiting to be processed.' },
  { id: 's-staff', label: 'Short of staff', text: 'The area is short of staff for the workload.' },
  { id: 's-hazard', label: 'Safety hazard in the area', text: 'There is a safety hazard in the area, such as a spill, a blocked path or an unsafe stack.' },
  { id: 's-seal', label: 'Seal or security check open', text: 'A seal or security check on a shipment is still outstanding.' },
];

export const BACKGROUND_TEMPLATES: SbarTemplate[] = [
  { id: 'b-none', label: 'No known cause', text: 'No known cause. Nothing similar happened earlier today.' },
  { id: 'b-previous', label: 'Started on the last shift', text: 'It started during the previous shift and is not yet resolved.' },
  { id: 'b-recurring', label: 'Has happened before', text: 'This has happened before and a report or ticket is already open.' },
  { id: 'b-agent', label: 'Waiting for the agent', text: 'The agent or forwarder has not yet supplied what is needed.' },
  { id: 'b-late', label: 'Cargo arrived late', text: 'The cargo arrived later than planned.' },
  { id: 'b-maintenance', label: 'Maintenance informed', text: 'Maintenance has been told and is expected to attend.' },
  { id: 'b-incident', label: 'Reported earlier today', text: 'It was reported earlier today in an incident report.' },
  { id: 'b-weather', label: 'Weather or airport delay', text: 'Weather or airport delays contributed.' },
  { id: 'b-system', label: 'System or scanner problem', text: 'A system or scanner problem contributed.' },
  { id: 'b-newstaff', label: 'New or temporary staff', text: 'A new or temporary staff member is working in this area.' },
];

export const ASSESSMENT_TEMPLATES: SbarTemplate[] = [
  { id: 'a-stable', label: 'Under control', text: 'Under control. No risk to people, cargo or flights at the moment.' },
  { id: 'a-monitor', label: 'Stable, needs checking', text: 'Stable for now but it needs to be checked again.' },
  { id: 'a-delay-risk', label: 'May delay a flight or delivery', text: 'It may delay a flight or a delivery if it is not dealt with.' },
  { id: 'a-cargo-risk', label: 'Cargo may be damaged or spoilt', text: 'Cargo may be damaged or spoilt if it is not dealt with in time.' },
  { id: 'a-safety', label: 'Safety risk until dealt with', text: 'It is a safety risk until it is dealt with.' },
  { id: 'a-light', label: 'Light duty only', text: 'The equipment can be used for light duty only.' },
  { id: 'a-unusable', label: 'Cannot be used yet', text: 'The equipment or area cannot be used until it is repaired or cleared.' },
  { id: 'a-compliance', label: 'Requirement not yet met', text: 'A compliance or documentation requirement is not yet met.' },
  { id: 'a-unknown', label: 'Cause or extent not known', text: 'The cause or the extent is not yet known.' },
];

export const RECOMMENDATION_TEMPLATES: SbarTemplate[] = [
  { id: 'r-continue', label: 'Continue as normal', text: 'Continue as normal. No action needed.' },
  { id: 'r-check-hourly', label: 'Check every hour', text: 'Check at the start of every hour and record the result.' },
  { id: 'r-first-thing', label: 'Follow up first thing', text: 'Follow up first thing at the start of the shift.' },
  { id: 'r-prioritise', label: 'Process this first', text: 'Process this first and tell the next supervisor.' },
  { id: 'r-release', label: 'Release when cleared', text: 'Release once the clearance or the documents are received.' },
  { id: 'r-call-agent', label: 'Contact the agent', text: 'Contact the agent or forwarder for what is missing.' },
  { id: 'r-isolate', label: 'Keep isolated', text: 'Keep the area or item isolated until it has been cleared.' },
  { id: 'r-repair', label: 'Do not use until repaired', text: 'Chase the repair and do not use the equipment until it is signed off.' },
  { id: 'r-claims', label: 'Photograph and report damage', text: 'Photograph the damage and report it to the claims desk.' },
  { id: 'r-escalate', label: 'Escalate if not resolved', text: 'Escalate to the supervisor if it is not resolved within the first hour.' },
];

export const TEMPLATES: Record<SbarPart, SbarTemplate[]> = {
  situation: SITUATION_TEMPLATES,
  background: BACKGROUND_TEMPLATES,
  assessment: ASSESSMENT_TEMPLATES,
  recommendation: RECOMMENDATION_TEMPLATES,
};

/** Common safety warnings, for the optional warning shown at the top of an update. */
export const WARNING_TEMPLATES: SbarTemplate[] = [
  { id: 'w-dg', label: 'Dangerous goods', text: 'Dangerous goods present. Keep away from heat and ignition sources.' },
  { id: 'w-lithium', label: 'Lithium batteries', text: 'Lithium batteries present. Keep away from heat and do not stack.' },
  { id: 'w-dry-ice', label: 'Dry ice', text: 'Dry ice present. Ventilate the area before entering.' },
  { id: 'w-spill', label: 'Spill or wet floor', text: 'Spill or wet floor. Use the marked path.' },
  { id: 'w-stack', label: 'Unstable stack', text: 'Unstable stack. Do not climb or add to it.' },
  { id: 'w-traffic', label: 'Forklift traffic', text: 'Heavy forklift traffic. Keep clear and use the walkways.' },
  { id: 'w-faulty', label: 'Faulty equipment', text: 'Faulty equipment. Do not use until it has been signed off.' },
];

/** A scenario fills all four parts at once, and the person then changes whatever is different today. */
export interface SbarScenario {
  id: string;
  label: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  warning?: string;
}

export const SCENARIOS: SbarScenario[] = [
  { id: 'routine', label: 'Routine, nothing unusual', situation: 's-routine', background: 'b-none', assessment: 'a-stable', recommendation: 'r-continue' },
  { id: 'customs', label: 'Shipment held for customs', situation: 's-customs', background: 'b-agent', assessment: 'a-delay-risk', recommendation: 'r-release' },
  { id: 'docs', label: 'Documents missing or wrong', situation: 's-docs', background: 'b-agent', assessment: 'a-compliance', recommendation: 'r-call-agent' },
  { id: 'damaged', label: 'Damaged cargo', situation: 's-damaged', background: 'b-incident', assessment: 'a-cargo-risk', recommendation: 'r-claims' },
  { id: 'dg', label: 'Dangerous goods handling', situation: 's-dg', background: 'b-none', assessment: 'a-safety', recommendation: 'r-isolate', warning: 'w-dg' },
  { id: 'cold', label: 'Cold room or perishables', situation: 's-cold', background: 'b-maintenance', assessment: 'a-monitor', recommendation: 'r-check-hourly' },
  { id: 'equipment', label: 'Equipment fault', situation: 's-equipment', background: 'b-maintenance', assessment: 'a-light', recommendation: 'r-repair', warning: 'w-faulty' },
  { id: 'delay', label: 'Delay and backlog', situation: 's-delay', background: 'b-weather', assessment: 'a-delay-risk', recommendation: 'r-prioritise' },
  { id: 'staff', label: 'Short of staff', situation: 's-staff', background: 'b-newstaff', assessment: 'a-delay-risk', recommendation: 'r-escalate' },
];

/** Marks a part that the person writes themselves instead of picking a template. */
export const OWN_WORDS = 'own';

/** The text to save for one part: the chosen template, then anything the person added. */
export function composePart(part: SbarPart | 'warning', templateId: string, extra: string): string {
  const list = part === 'warning' ? WARNING_TEMPLATES : TEMPLATES[part];
  const template = list.find((entry) => entry.id === templateId)?.text ?? '';
  return [template, extra.trim()].filter(Boolean).join(' ');
}
