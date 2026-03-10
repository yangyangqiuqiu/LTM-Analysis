export interface Requirement {
  id: string;
  app: string;
  vip: string;
  port: string;
  protocol: string;
  lbMethod: string;
  monitor: string;
  persistence: string;
  members: string[];
  priorityEnabled: boolean;
  vsName: string;
  isExistingConfig?: boolean;
  snat?: string;
}

export interface DeviceState {
  exists: boolean;
  device: string;
  vendor: string;
  vsName: string;
  poolName: string;
  lbMethod: string;
  monitor: string;
  persistence: string;
  members: string[];
  priorityEnabled: boolean;
  sharedList?: string[];
}

export interface AnalysisRow {
  label: string;
  target: string;
  current: string | null;
  highlight?: boolean;
  status?: 'match' | 'conflict' | 'warning' | 'shared';
  msg?: string;
}

export interface Action {
  id: string;
  name: string;
  desc: string;
  disabled: boolean;
}

export interface AnalysisResult {
  deviceInfo: { name: string; ip: string; vendor: string };
  rows: AnalysisRow[];
  actions: Action[];
  statusType: 'NEW' | 'APPEND' | 'APPEND_ERROR' | 'MANUAL_REQUIRED' | 'MATCH';
  hasSharedPool: boolean;
  sharedInfo: string;
}
