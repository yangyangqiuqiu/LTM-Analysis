import { Requirement, AnalysisResult, AnalysisRow, Action } from './types';
import { MOCK_DEVICE_STATE, getDeviceInfo, REQUIREMENTS } from './mockData';

export function analyzeRequirement(req: Requirement): AnalysisResult {
  const key = `${req.vip}:${req.port}`;
  const deviceState = MOCK_DEVICE_STATE[key];
  const deviceInfo = getDeviceInfo(req.vip);
  let statusType: AnalysisResult['statusType'] = 'NEW';
  let rows: AnalysisRow[] = [];
  const actions: Action[] = [];
  let hasSharedPool = false;
  let sharedInfo = '';

  const allRows: AnalysisRow[] = [
    { label: 'Virtual Server', target: req.vsName, current: null },
    { label: 'VIP : Port', target: `${req.vip} : ${req.port}`, current: null },
    { label: 'LB Algorithm', target: req.lbMethod, current: null },
    { label: 'Monitor', target: req.monitor, current: null },
    { label: 'Persistence', target: req.persistence || 'none', current: null },
    { label: 'Members', target: req.members.join('\n'), current: null, highlight: true },
  ];

  if (!deviceState) {
    statusType = 'NEW';
    rows = allRows.filter(r => ['Virtual Server', 'VIP : Port', 'LB Algorithm', 'Members'].includes(r.label));
    rows.forEach(r => r.current = null);
    actions.push({ id: 'create_new_strategy', name: '确认新建负载策略', desc: `系统将自动下发全套配置 (VS + Pool + Monitor)`, disabled: false });
  } else {
    allRows.forEach(r => {
        if (r.label === 'Virtual Server') r.current = deviceState.vsName;
        if (r.label === 'VIP : Port') r.current = `${req.vip} : ${req.port}`;
        if (r.label === 'LB Algorithm') r.current = deviceState.lbMethod;
        if (r.label === 'Monitor') r.current = deviceState.monitor;
        if (r.label === 'Persistence') r.current = deviceState.persistence || 'none';
        if (r.label === 'Members') r.current = deviceState.members.join('\n');
    });

    if (!req.isExistingConfig) {
        statusType = 'MANUAL_REQUIRED';
        rows = allRows.filter(r => r.label === 'VIP : Port');
        rows[0].status = 'conflict';
        rows[0].msg = '配置已存在';
    } 
    else {
        statusType = 'APPEND';
        rows = allRows.filter(r => ['VIP : Port', 'LB Algorithm', 'Members'].includes(r.label));
        
        rows.forEach(r => {
            if (r.label !== 'Members' && r.label !== 'VIP : Port') {
                if (r.target === r.current) {
                    r.status = 'match';
                    r.msg = '匹配 (Match)';
                }
            }
        });

        if (req.lbMethod !== deviceState.lbMethod) {
            statusType = 'APPEND_ERROR';
            const row = rows.find(r => r.label === 'LB Algorithm');
            if (row) {
              row.status = 'conflict';
              row.msg = '算法不一致';
            }
        }
        
        const currentPort = deviceState.members[0]?.split(':')[1];
        const hasPortMismatch = req.members.some(m => {
            const p = m.split(':')[1];
            return p && p !== currentPort;
        });

        if (currentPort && hasPortMismatch) {
             const memRow = rows.find(r => r.label === 'Members');
             if (memRow) {
               memRow.status = 'warning';
               memRow.msg = `发现异构端口 (Pool 现网端口: ${currentPort})，允许继续追加`;
             }
        }

        if (deviceState.sharedList && deviceState.sharedList.length > 0) {
            hasSharedPool = true;
            sharedInfo = deviceState.sharedList.join(', ');
            const memRow = rows.find(r => r.label === 'Members');
            if (memRow) {
              memRow.status = 'shared';
              memRow.msg = `Pool 被多个 VS 引用: ${sharedInfo}`;
            }
        }

        const newMembers = req.members.filter(m => !deviceState.members.includes(m));
        if (newMembers.length > 0) {
            actions.push({ 
                id: 'append_member', 
                name: '确认追加增量节点', 
                desc: `仅下发 ${newMembers.length} 个新增节点: ${newMembers.join(', ')}`, 
                disabled: false 
            });
        } else {
            statusType = 'MATCH';
            actions.push({ id: 'no_change', name: '无需变更', desc: '目标节点已全部存在于现网配置中', disabled: true });
        }
    }
  }
  return { deviceInfo, rows, actions, statusType, hasSharedPool, sharedInfo };
}

export function generateFinalScript(selections: Record<string, Record<string, boolean>>, reqDataMap: Record<string, Requirement>) {
    const scripts: { device: string; vendor: string; app: string; code: string }[] = [];
    Object.keys(selections).forEach(reqId => {
        const req = reqDataMap[reqId] || REQUIREMENTS.find(r => r.id === reqId);
        if (!req) return;
        const sel = selections[reqId];
        const deviceInfo = getDeviceInfo(req.vip);
        const analysis = analyzeRequirement(req);
        
        if (['MANUAL_REQUIRED', 'APPEND_ERROR'].includes(analysis.statusType)) return;
        if (!sel || Object.keys(sel).length === 0) return;

        let lines: string[] = [];
        const isF5 = deviceInfo.vendor === 'F5';
        
        if (sel.create_new_strategy) {
            const poolName = `pool_${req.app}_${req.port}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const monitorName = `mon_${req.monitor}`;
            if (isF5) {
                lines.push(`create ltm monitor ${req.monitor} ${monitorName} interval 5 timeout 16`);
                const membersStr = req.members.map(m => {
                    const parts = m.split(':');
                    const ip = parts[0];
                    const port = parts[1];
                    const prio = parts[2];
                    if (prio && prio !== 'undefined' && prio !== '') {
                        return `${ip}:${port} { priority-group ${prio} }`;
                    }
                    return `${ip}:${port}`;
                }).join(' ');

                lines.push(`create ltm pool ${poolName} load-balancing-mode ${req.lbMethod} members add { ${membersStr} } monitor ${monitorName}`);
                if (req.priorityEnabled) {
                     lines.push(`modify ltm pool ${poolName} min-active-members 1`);
                }

                let profileStr = '';
                if (req.protocol === 'tcp') {
                    profileStr = 'tcp';
                    if (req.persistence && req.persistence !== 'none') {
                        profileStr += ` ${req.persistence}`;
                    }
                } else {
                    profileStr = 'udp';
                }

                lines.push(`create ltm virtual ${req.vsName} destination ${req.vip}:${req.port} pool ${poolName} profiles add { ${profileStr} } source-address-translation { type ${req.snat || 'automap'} }`);
            }
        } else if (sel.append_member) {
            const state = MOCK_DEVICE_STATE[`${req.vip}:${req.port}`];
            const news = req.members.filter(m => !state.members.includes(m));
            if (isF5) {
                const membersStr = news.map(m => {
                    const parts = m.split(':');
                    const ip = parts[0];
                    const port = parts[1];
                    const prio = parts[2];
                    if (req.priorityEnabled && prio && prio !== 'undefined' && prio !== '') {
                        return `${ip}:${port} { priority-group ${prio} }`;
                    }
                    return `${ip}:${port}`;
                }).join(' ');

                lines.push(`modify ltm pool ${state.poolName} members add { ${membersStr} }`);
            }
        }

        if (lines.length > 0) scripts.push({ device: deviceInfo.name, vendor: deviceInfo.vendor, app: req.app, code: lines.join('\n') });
    });
    return scripts;
}
