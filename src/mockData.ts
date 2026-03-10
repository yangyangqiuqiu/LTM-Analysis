import { Requirement, DeviceState } from './types';

export const TICKET_INFO = {
  id: 'LTM-20260520-008',
  title: '支付结算系统-Q2扩容及参数调优',
  status: '待执行',
  applicant: '支付运维组',
};

export const REQUIREMENTS: Requirement[] = [
  { 
    id: 'REQ-01', app: '移动支付网关', 
    vip: '10.10.20.100', port: '80', protocol: 'TCP', 
    lbMethod: 'least-connections-member', monitor: 'tcp', persistence: 'source_addr',
    members: ['172.16.10.1:80', '172.16.10.2:80'],
    priorityEnabled: false,
    vsName: 'vs_mobile_pay_80'
  },
  { 
    id: 'REQ-02', app: '内部OA-Web', 
    vip: '10.10.30.50', port: '80', protocol: 'TCP', 
    lbMethod: 'round-robin', monitor: 'http', persistence: 'cookie',
    members: ['172.16.20.5:80'], 
    priorityEnabled: true, 
    vsName: 'vs_oa_web_80'
  },
  { 
    id: 'REQ-03', app: '基础公共服务', 
    vip: '10.10.40.88', port: '8080', protocol: 'TCP', 
    lbMethod: 'round-robin', monitor: 'http', persistence: 'none',
    members: ['172.16.30.9:8080'],
    priorityEnabled: false,
    vsName: 'vs_common_srv_8080'
  },
  { 
    id: 'REQ-04', app: '财务结算核心', 
    vip: '10.10.50.10', port: '443', protocol: 'TCP', 
    lbMethod: 'round-robin', monitor: 'tcp', persistence: 'source_addr', 
    members: ['172.16.40.5:8080'],
    priorityEnabled: false,
    vsName: 'vs_fin_core_443'
  },
  {
    id: 'REQ-05', app: '旧版兼容接口',
    vip: '10.10.20.101', port: '80', protocol: 'TCP', 
    lbMethod: 'round-robin', monitor: 'tcp', persistence: 'none',
    members: ['172.16.10.6:80'],
    priorityEnabled: false,
    vsName: 'vs_legacy_api_80'
  }
];

export const MOCK_DEVICE_STATE: Record<string, DeviceState> = {
  '10.10.30.50:80': { exists: true, device: 'LB-CORP-F5-01', vendor: 'F5', vsName: 'vs_oa_web_80', poolName: 'pool_oa_web_80', lbMethod: 'round-robin', monitor: 'http', persistence: 'cookie', members: ['172.16.20.1:80', '172.16.20.2:80'], priorityEnabled: false },
  '10.10.40.88:8080': { exists: true, device: 'LB-DMZ-F5-02', vendor: 'F5', vsName: 'vs_common_srv_8080', poolName: 'pool_common_backend', lbMethod: 'round-robin', monitor: 'tcp', persistence: 'none', members: ['172.16.30.1:8080'], priorityEnabled: false },
  '10.10.50.10:443': { exists: true, device: 'LB-CORE-AD-01', vendor: 'Sangfor', vsName: 'vs_fin_core_443', poolName: 'pool_fin_core_443', lbMethod: 'round-robin', monitor: 'tcp', persistence: 'none', members: ['172.16.40.1:443'], priorityEnabled: false },
  '10.10.20.101:80': { exists: true, device: 'LB-DMZ-F5-01', vendor: 'F5', vsName: 'vs_legacy_api_80', poolName: 'pool_legacy_shared', sharedList: ['vs_legacy_web_8080', 'vs_legacy_h5_80'], lbMethod: 'round-robin', monitor: 'tcp', persistence: 'none', members: ['172.16.10.5:80'], priorityEnabled: false },
};

export const getDeviceInfo = (vip: string) => {
  const subnet = vip.split('.').slice(0,3).join('.');
  if (subnet === '10.10.20') return { name: 'LB-DMZ-F5-01', ip: '192.168.1.10', vendor: 'F5' };
  if (subnet === '10.10.30') return { name: 'LB-CORP-F5-01', ip: '192.168.2.20', vendor: 'F5' };
  if (subnet === '10.10.40') return { name: 'LB-DMZ-F5-02', ip: '192.168.1.11', vendor: 'F5' };
  if (subnet === '10.10.50') return { name: 'LB-CORE-AD-01', ip: '192.168.100.1', vendor: 'Sangfor' }; 
  return { name: 'LB-CORE-F5-01', ip: '192.168.254.1', vendor: 'F5' };
}
