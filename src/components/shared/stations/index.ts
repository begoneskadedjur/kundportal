// src/components/shared/stations/index.ts
// Delade stationskomponenter som inte hör till ute eller inne specifikt:
// typrutan, verktygsraden, typbytet och flyttläget. Används av kontrollrundan
// (StationInspectionModule) och utrustningsvyn.

export { default as StationTypeTile } from './StationTypeTile'
export type { StationTypeTileProps, StationTypeTileSize } from './StationTypeTile'
export { default as StationToolbar } from './StationToolbar'
export type { StationToolbarProps, StationToolbarButton } from './StationToolbar'
export { default as ChangeStationTypeSheet, ChangeStationTypeModal } from './ChangeStationTypeSheet'
export type {
  ChangeStationTypeSheetProps,
  ChangeStationTypeModalProps,
  ChangeStationTypeStation,
  ChangeStationTypeChoice,
} from './ChangeStationTypeSheet'
export { default as RelocateBar } from './RelocateBar'
export type { RelocateBarProps } from './RelocateBar'
