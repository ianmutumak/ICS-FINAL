# ZAMU-CHECK: Standardized Shift Handover Management Architecture
**Project**: Strathmore University ICS Capstone (Kiome Ian Mutuma · 144861 · Supervisor: Dr. Esther Khakata)  
**Domain Scope**: Enterprise Warehouse & Logistics (Kenya Airways Bonded Freight Hub & General Industrial Facilities)

---

## Executive Summary & Objectives
Based on the full capstone engineering documentation and your clarifying choices:
1. **Primary Workflow**: A **Unified Suite** integrating real-time **SBAR / ISOBAR** structured logging, **Dual Sign-Off** non-repudiation verification, and live **Handover Effectiveness Index (HEI)** telemetry in one responsive operational screen.
2. **Evaluation & Usability**: An **Embedded Supervisor Post-Handover Debrief & 10-Item SUS (System Usability Scale)** survey tab directly within the analytics governance module to compute standard percentile scores, grade scales (A–F), and track cognitive load reduction over successive shifts.
3. **Custody & Equipment Agility**: **User-Defined Custom Categories & Dynamic Tracking**—eliminating rigid hardcoded presets while providing smooth, flexible warehouse tracking (dock doors, forklifts, reach trucks, customs cages, cold bays, or custom industrial equipment) populated directly through user input and persistent database storage.

```
+---------------------------------------------------------------------------------------------------+
|                                  ZAMU-CHECK OPERATIONAL ARCHITECTURE                              |
+---------------------------------------------------------------------------------------------------+
|  1. AUTH GATEWAY & ROLES       2. UNIFIED SBAR SUITE           3. VERIFICATION & AUDIT            |
|  - Shift Operator              - Asynchronous ISOBAR Logging   - Mandatory High-Risk Ack          |
|  - Reviewing Supervisor        - Dynamic Custom Categories     - Dual Cryptographic Signatures    |
|  - System Administrator        - Live HEI Telemetry Gauge      - Immutable Audit Trail Ledger     |
+---------------------------------------------------------------------------------------------------+
|  4. ANALYTICS & USABILITY RESEARCH MODULE (Strathmore Capstone Chapter 3)                         |
|  - Handover Effectiveness Index (HEI) [Completeness, Acknowledged Safety Alerts, Custody Checks]  |
|  - Mean Time to Report (MTTR) & Shift Transition Cycle Times                                      |
|  - Standardized 10-Item System Usability Scale (SUS) Supervisor Debrief Tab (Brooke 1996)        |
+---------------------------------------------------------------------------------------------------+
```

---

## User Review Required

> [!NOTE]
> Please review the architecture and components outlined below before we proceed to implementation.

1. **HEI (Handover Effectiveness Index) Formula Weighting**:
   - `HEI = (W_sbar * CompletenessScore) + (W_haz * HazardMitigationScore) + (W_eq * CustodyCheckScore) - Penalty(UnacknowledgedItems)`
   - Default weights: 40% SBAR documentation completeness, 35% hazard/critical alert acknowledgment, 25% equipment custody reconciliation.
2. **SUS (System Usability Scale) Standard Questionnaire**:
   - The 10 standardized items from Brooke (1996) will be embedded in a dedicated **Supervisor Debrief & SUS** tab under Analytics, calculating scores from 0–100 with qualitative benchmark grade (A: ≥80.3, B: 68–80.2, C: 51–67.9, F: <51).

---

## Proposed Changes

### Module 1: Core Types & State Management (`/src/types/index.ts`, `/src/context/HandoverContext.tsx`)
- **Extend Data Models**:
  - Add `HandoverEffectivenessIndex` model (`overallScore`, `sbarCompleteness`, `safetyAckRate`, `equipmentReconciliationRate`, `unresolvedRiskCount`).
  - Add `SusEvaluationRecord` model (`id`, `handoverId`, `evaluatorId`, `evaluatorName`, `shiftCode`, `scores: [10 items]`, `calculatedScore`, `grade`, `debriefNotes`, `timestamp`).
  - Add `CustomCategory` model allowing operators and supervisors to add, edit, and delete custom warehouse zones and equipment categories on the fly.
- **Dynamic Category & Equipment Management**:
  - Replace rigid airport presets with a flexible category manager that initializes clean defaults (e.g., Inbound Receiving, Staging Dock, Material Handling, Cold Storage, Bonded Secure Bay, Dispatch) while allowing users to create custom categories with tailored attributes.
- **Persistence & Offline Buffering**:
  - Store active shifts, custom categories, SUS evaluations, and SBAR cases in Firestore (`ai-studio-zamucheckshiftha-fd6e22d5-fc4f-4b5e-9a8b-3c9a20164f55`) with resilient localStorage caching.

### Module 2: Unified SBAR & Active Handover Suite (`/src/components/dashboard/ActiveHandoverView.tsx`)
- **Real-Time SBAR / ISOBAR Entry**:
  - Structured cards for **Situation**, **Background**, **Assessment**, and **Recommendation** with severity badges (Critical, Unstable, Observation, Stable).
  - High-risk / safety alerts toggle with mandatory acknowledgment status.
- **Live HEI Telemetry Gauge**:
  - Sticky/header telemetry widget displaying the live HEI score (0–100%) in real time as operators log items and perform custody checks.
  - Color-coded indicator: Optimal (≥85%), Moderate (65–84%), Incomplete (<65%).
- **Dynamic Equipment & Custody Reconciliation**:
  - Interactive status controls (Functional, Inspection Due, Faulty, In Use).
  - Custody handoff toggle with timestamped sign-off.
  - "Add Custom Asset / Category" quick-action modal allowing ad-hoc asset entry without templates.

### Module 3: Dual Digital Signature & Verification (`/src/components/modals/SignoffModal.tsx`)
- **Two-Party Verification Protocol**:
  - Outgoing operator formal declaration and digital PIN / signature.
  - Incoming operator acknowledgment of all critical alerts, open carry-over tasks, and equipment custody tags.
  - Cryptographic hash generation (`SHA-256` simulation based on payload, timestamp, and keys) for non-repudiation.
- **Safety Gate**:
  - Blocks handover finalization if unacknowledged critical/safety hazard items remain unresolved without explicit supervisor override.

### Module 4: Embedded Supervisor Debrief & 10-Item SUS Evaluation (`/src/components/analytics/StatisticsAnalyticsView.tsx`)
- **New Subtab: "Supervisor Debrief & SUS Survey"**:
  - Embedded 10-item System Usability Scale questionnaire with 5-point Likert scale buttons (Strongly Disagree `1` to Strongly Agree `5`).
  - Real-time score calculator using the formal SUS algorithm:
    - Odd items: $X_i = \text{Score}_i - 1$
    - Even items: $Y_i = 5 - \text{Score}_i$
    - Total SUS Score: $(\sum X + \sum Y) \times 2.5$
  - Visual gauge with percentile benchmarking (Sauro & Lewis standard) and academic grade assignment (A+ to F).
  - Qualitative supervisor debrief notes field with Shift ID tag.
  - Historical table of completed SUS evaluations with exportable summary for capstone dissertation defense.

---

## Verification Plan

### Automated Checks
- Run `compile_applet` to ensure zero TypeScript errors or missing imports.
- Validate React component tree rendering without console exceptions.

### Functional Testing Scenarios
1. **Dynamic Category Creation**: Create a new custom warehouse category (e.g. "Automated Sortation Hub"), add custom equipment, and verify instant persistence.
2. **SBAR Logging & Live HEI**: Create an SBAR case with a critical hazard alert; verify that the HEI score adjusts dynamically.
3. **Dual Sign-off Flow**: Initiate handover signoff, acknowledge critical alerts as incoming operator, sign with cryptographic hash, and verify transition to the Archive ledger.
4. **SUS Evaluation**: Fill out the 10-item SUS questionnaire as supervisor, verify mathematical scoring accuracy, and confirm the evaluation saves to the debrief log.
