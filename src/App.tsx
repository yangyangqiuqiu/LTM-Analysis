import React, { useState, useMemo, useEffect } from 'react';
import { 
  Network, Server, Search, FileCode, 
  CheckCircle, ChevronRight, Copy, Loader2, 
  AlertTriangle, Info, Lock, LockOpen,
  Activity, Plus, Clipboard, ChevronDown, FileText,
  ListFilter, Send, GitPullRequest, ArrowRight,
  Settings, AlertOctagon, Power, Split, CheckSquare,
  Play, RotateCcw, Check, XCircle, Shield, Globe, Layers, Square,
  Maximize2, Database, Circle, ArrowLeft, MoreHorizontal, Layout, 
  Cpu, LockKeyhole, HeartPulse, Sliders, Box, CheckCheck, Archive, Users,
  ToggleLeft, ToggleRight, Trash2, PlusCircle, ChevronUp, Share2, Flag,
  TerminalSquare
} from 'lucide-react';
import { Requirement } from './types';
import { TICKET_INFO, REQUIREMENTS, MOCK_DEVICE_STATE } from './mockData';
import { analyzeRequirement, generateFinalScript } from './utils';

// --- LB 配置表单组件 ---
const LBProvisionForm = ({ requirement, onNext }: { requirement: Requirement, onNext: (req: Requirement) => void }) => {
  const [existingConfig, setExistingConfig] = useState<any>(null);
  const isAppendMode = !!existingConfig; 

  const [basicInfo, setBasicInfo] = useState({
    name: requirement.vsName || '',
    vip: requirement.vip || '',
    port: requirement.port || '',
  });
  
  const [nameLocked, setNameLocked] = useState(true);

  const [network, setNetwork] = useState({
    type: 'standard', 
    protocol: requirement.protocol === 'UDP' ? 'udp' : 'tcp',
    sourceAddr: '0.0.0.0/0',
  });

  const [profiles, setProfiles] = useState({
    fastL4: 'fastL4_default',
    tcp: 'tcp_wan_optimized',
    udp: 'udp_default',
    dns: 'none',
    fastHttp: 'none',
    persistence: requirement.persistence || 'none',
    persistTimeout: '180',
    clientSSL: 'none',
    serverSSL: 'none',
    http: 'none',
    ftp: 'none',
    oneConnect: 'none',
    anyIp: 'none'
  });

  const [profilesExpanded, setProfilesExpanded] = useState(false);

  // 联动逻辑：会话保持与 HTTP 模板
  useEffect(() => {
    if (profiles.persistence === 'cookie' && profiles.http === 'none') {
      setProfiles(prev => ({ ...prev, http: 'http_standard' }));
    }
  }, [profiles.persistence]);

  // 联动逻辑：协议类型与 Profile
  useEffect(() => {
    if (network.protocol === 'udp') {
      setProfiles(prev => ({ ...prev, tcp: 'none', udp: 'udp_default', http: 'none', fastL4: 'none' }));
    } else if (network.protocol === 'tcp') {
      setProfiles(prev => ({ ...prev, udp: 'none', tcp: 'tcp_wan_optimized' }));
    }
  }, [network.protocol]);

  const [backend, setBackend] = useState({
    algorithm: requirement.lbMethod || 'round-robin',
    priorityEnabled: false, 
    members: [] as { ip: string; port: string; priority: string; isExisting: boolean }[],
    monitor: requirement.monitor || 'tcp',
    snat: 'automap',
    monitorSend: 'GET /health_check HTTP/1.1\\r\\nHost: check.local\\r\\n\\r\\n',
    monitorRecv: '200 OK',
  });

  const [customParams, setCustomParams] = useState([
    { key: 'description', value: `Created by ITSM ${TICKET_INFO.id}` }
  ]);

  useEffect(() => {
    const key = `${requirement.vip}:${requirement.port}`;
    const liveState = MOCK_DEVICE_STATE[key];

    if (liveState) {
        setExistingConfig(liveState);
        setBasicInfo(prev => ({ ...prev, name: liveState.vsName }));
        setBackend(prev => ({
            ...prev,
            algorithm: liveState.lbMethod, 
            monitor: liveState.monitor,
            priorityEnabled: requirement.priorityEnabled !== undefined ? requirement.priorityEnabled : liveState.priorityEnabled,
        }));
        setProfiles(prev => ({
            ...prev,
            persistence: liveState.persistence || 'none', 
        }));

        const liveMembers = liveState.members.map(m => ({ 
            ip: m.split(':')[0], 
            port: m.split(':')[1], 
            priority: liveState.priorityEnabled ? '10' : '', 
            isExisting: true 
        }));
        const newMembers = requirement.members
            .filter(m => !liveState.members.includes(m))
            .map(m => ({ 
                ip: m.split(':')[0], 
                port: m.split(':')[1], 
                priority: '', 
                isExisting: false 
            }));
        
        setBackend(prev => ({ ...prev, members: [...liveMembers, ...newMembers] }));
        setProfilesExpanded(false);
    } else {
        setExistingConfig(null);
        setBasicInfo({
            name: requirement.vsName || '',
            vip: requirement.vip || '',
            port: requirement.port || '',
        });
        const reqMembers = requirement.members.map(m => ({ ip: m.split(':')[0], port: m.split(':')[1], priority: '', isExisting: false }));
        setBackend(prev => ({ 
            ...prev, 
            members: reqMembers,
            algorithm: requirement.lbMethod || 'round-robin',
            monitor: requirement.monitor || 'tcp',
            priorityEnabled: requirement.priorityEnabled || false
        }));
        setProfiles(prev => ({
            ...prev,
            persistence: requirement.persistence || 'none'
        }));
        setProfilesExpanded(true); 
    }
  }, [requirement]);

  const handleMemberChange = (index: number, field: string, value: string) => {
    const newMembers = [...backend.members];
    if (newMembers[index].isExisting) return; 
    (newMembers[index] as any)[field] = value;
    setBackend({ ...backend, members: newMembers });
  };
  const addMember = () => setBackend({ ...backend, members: [...backend.members, { ip: '', port: '', priority: '', isExisting: false }] });
  const removeMember = (index: number) => {
    if (backend.members[index].isExisting) return;
    const newMembers = [...backend.members];
    newMembers.splice(index, 1);
    setBackend({ ...backend, members: newMembers });
  };

  const showAdvancedMonitor = ['http', 'https', 'tcp_content'].includes(backend.monitor);
  const showPriorityColumn = backend.priorityEnabled || (existingConfig && existingConfig.priorityEnabled);

  return (
    <div className="bg-white rounded-md shadow-sm border border-slate-200 animate-in fade-in duration-300">
      <div className={`px-6 py-4 border-b rounded-t-md flex justify-between items-center ${isAppendMode ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
        <div>
          <h3 className={`text-base font-bold flex items-center ${isAppendMode ? 'text-indigo-800' : 'text-slate-800'}`}>
            <span className={`w-2 h-4 rounded-sm mr-2 ${isAppendMode ? 'bg-indigo-500' : 'bg-slate-400'}`}></span>
            {requirement.app} - {isAppendMode ? '策略追加' : '新建策略'}
          </h3>
          {isAppendMode && (
            <div className="text-xs mt-1.5 text-indigo-600/80 font-medium">
              现网配置已存在，系统已自动回填并锁定基础参数，请在下方列表追加新成员。
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-8">
        <section>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center">基础信息配置</h4>
          <div className="grid grid-cols-3 gap-6">
            <InputField label="服务名称 (VS Name)" value={basicInfo.name} onChange={v => setBasicInfo({...basicInfo, name: v})} disabled={isAppendMode || nameLocked} locked={true} allowUnlock={!isAppendMode} isLockedState={nameLocked} onToggleLock={() => setNameLocked(!nameLocked)} />
            <InputField label="服务地址 (VIP)" value={basicInfo.vip} onChange={() => {}} disabled={true} locked={true} /> 
            <InputField label="服务端口 (Port)" value={basicInfo.port} onChange={() => {}} disabled={true} locked={true} />
          </div>
        </section>

        <section className={isAppendMode ? "opacity-60 grayscale-[0.5] pointer-events-none" : ""}>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center">网络与转发模式</h4>
          <div className="grid grid-cols-3 gap-6">
            <SelectField label="转发模式" value={network.type} onChange={v => setNetwork({...network, type: v})} options={[{ label: 'Standard', value: 'standard' }, { label: 'PerformanceL4', value: 'performance_l4' }]} />
            <SelectField label="协议类型" value={network.protocol} onChange={v => setNetwork({...network, protocol: v})} options={[{ label: 'TCP', value: 'tcp' }, { label: 'UDP', value: 'udp' }]} />
            <InputField label="源地址限制" value={network.sourceAddr} onChange={v => setNetwork({...network, sourceAddr: v})} />
          </div>
        </section>

        <section className={`border border-slate-200 rounded-md overflow-hidden ${isAppendMode ? "bg-slate-50/50" : ""}`}>
          <div className="bg-slate-50 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-slate-100" onClick={() => setProfilesExpanded(!profilesExpanded)}>
            <h4 className="text-xs font-bold text-slate-600 flex items-center">
              <Sliders className="w-4 h-4 mr-2 text-slate-400"/> 
              策略与协议模板配置 
              {isAppendMode && <Lock className="w-3 h-3 ml-2 text-slate-400" />}
            </h4>
            {profilesExpanded ? <ChevronUp className="w-4 h-4 text-slate-400"/> : <ChevronDown className="w-4 h-4 text-slate-400"/>}
          </div>
          {profilesExpanded && (
            <div className={`p-5 space-y-6 bg-white ${isAppendMode ? "pointer-events-none opacity-70" : ""}`}>
              <div className="grid grid-cols-4 gap-4">
                {network.protocol === 'tcp' && (
                  <>
                    <SelectField label="TCP 模板" value={profiles.tcp} onChange={v => setProfiles({...profiles, tcp: v})} options={[{label: 'tcp', value: 'tcp'}, {label: 'tcp_wan_optimized', value: 'tcp_wan_optimized'}, {label: 'tcp_lan_optimized', value: 'tcp_lan_optimized'}]} />
                    <SelectField label="HTTP 模板" value={profiles.http} onChange={v => setProfiles({...profiles, http: v})} options={[{label: 'None', value: 'none'}, {label: 'http_standard', value: 'http_standard'}, {label: 'http_acceleration', value: 'http_acceleration'}]} />
                  </>
                )}
                {network.protocol === 'udp' && (
                  <SelectField label="UDP 模板" value={profiles.udp} onChange={v => setProfiles({...profiles, udp: v})} options={[{label: 'udp', value: 'udp'}, {label: 'udp_gtm_dns', value: 'udp_gtm_dns'}]} />
                )}
                <SelectField label="会话保持" value={profiles.persistence} onChange={v => setProfiles({...profiles, persistence: v})} options={[{ label: 'None', value: 'none' }, { label: '源地址 (Source Addr)', value: 'source_addr' }, { label: 'Cookie', value: 'cookie' }, { label: 'SSL ID', value: 'ssl_id' }]} />
                <InputField label="保持超时 (秒)" value={profiles.persistTimeout} onChange={v => setProfiles({...profiles, persistTimeout: v})} />
              </div>
              
              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                <SelectField label="Client SSL" value={profiles.clientSSL} onChange={v => setProfiles({...profiles, clientSSL: v})} options={[{label: 'None', value: 'none'}, {label: 'ssl_wildcard_com', value: 'ssl_wildcard_com'}]} />
                <SelectField label="Server SSL" value={profiles.serverSSL} onChange={v => setProfiles({...profiles, serverSSL: v})} options={[{label: 'None', value: 'none'}, {label: 'ssl_server_default', value: 'ssl_server_default'}]} />
                <SelectField label="OneConnect" value={profiles.oneConnect} onChange={v => setProfiles({...profiles, oneConnect: v})} options={[{label: 'None', value: 'none'}, {label: 'oneconnect_default', value: 'oneconnect_default'}]} />
                <SelectField label="FastL4" value={profiles.fastL4} onChange={v => setProfiles({...profiles, fastL4: v})} options={[{label: 'None', value: 'none'}, {label: 'fastL4_default', value: 'fastL4_default'}]} />
              </div>

              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                <SelectField label="FTP 模板" value={profiles.ftp} onChange={v => setProfiles({...profiles, ftp: v})} options={[{label: 'None', value: 'none'}, {label: 'ftp_default', value: 'ftp_default'}]} />
                <SelectField label="DNS 模板" value={profiles.dns} onChange={v => setProfiles({...profiles, dns: v})} options={[{label: 'None', value: 'none'}, {label: 'dns_default', value: 'dns_default'}]} />
                <SelectField label="FastHTTP" value={profiles.fastHttp} onChange={v => setProfiles({...profiles, fastHttp: v})} options={[{label: 'None', value: 'none'}, {label: 'fasthttp_default', value: 'fasthttp_default'}]} />
                <SelectField label="AnyIP" value={profiles.anyIp} onChange={v => setProfiles({...profiles, anyIp: v})} options={[{label: 'None', value: 'none'}, {label: 'anyip_enabled', value: 'anyip_enabled'}]} />
              </div>
            </div>
          )}
        </section>

        <section className={isAppendMode ? "bg-slate-50/30 p-4 rounded-md border border-slate-100" : ""}>
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
              后端资源池配置
              {isAppendMode && <Lock className="w-3 h-3 ml-2 text-slate-400" />}
            </h4>
            <div className={`flex items-center ${isAppendMode ? 'pointer-events-none opacity-60' : ''}`}>
              <span className="text-xs text-slate-500 mr-2">启用节点优先级</span>
              <button onClick={() => setBackend({...backend, priorityEnabled: !backend.priorityEnabled})} className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors ${backend.priorityEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <div className={`bg-white w-3 h-3 rounded-full shadow-sm transform transition-transform ${backend.priorityEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
              </button>
            </div>
          </div>
          <div className={`grid grid-cols-4 gap-6 mb-4 ${isAppendMode ? 'pointer-events-none opacity-60' : ''}`}>
            <SelectField label="负载均衡算法" value={backend.algorithm} onChange={v => setBackend({...backend, algorithm: v})} options={[{ label: '轮询 (Round Robin)', value: 'round-robin' }, { label: '最小连接 (Least Connections)', value: 'least-connections-node' }, { label: '加权轮询 (Weighted RR)', value: 'weighted-round-robin' }]} />
            <SelectField label="健康检查 (Monitor)" value={backend.monitor} onChange={v => setBackend({...backend, monitor: v})} options={[{label: 'TCP', value: 'tcp'}, {label: 'HTTP', value: 'http'}, {label: 'HTTPS', value: 'https'}, {label: 'ICMP', value: 'icmp'}, {label: 'UDP', value: 'udp'}]} />
            <SelectField label="SNAT 配置" value={backend.snat} onChange={v => setBackend({...backend, snat: v})} options={[{label: 'Auto Map', value: 'automap'}, {label: 'None', value: 'none'}, {label: 'SNAT Pool', value: 'snatpool'}]} />
          </div>

          {showAdvancedMonitor && (
            <div className={`grid grid-cols-2 gap-6 mb-6 p-4 bg-slate-50 rounded-md border border-slate-200 ${isAppendMode ? 'pointer-events-none opacity-60' : ''}`}>
              <InputField label="Monitor Send String" value={backend.monitorSend} onChange={v => setBackend({...backend, monitorSend: v})} />
              <InputField label="Monitor Receive String" value={backend.monitorRecv} onChange={v => setBackend({...backend, monitorRecv: v})} />
            </div>
          )}
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 font-medium">IP Address</th>
                  <th className="px-4 py-2.5 font-medium">Port</th>
                  {showPriorityColumn && <th className="px-4 py-2.5 font-medium">Priority</th>}
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {backend.members.map((m, i) => (
                  <tr key={i} className={`group ${m.isExisting ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-2">
                      <div className="flex items-center">
                        <input type="text" value={m.ip} onChange={e => handleMemberChange(i, 'ip', e.target.value)} disabled={m.isExisting} className="w-full bg-transparent outline-none border-b border-transparent focus:border-indigo-300 font-mono text-slate-700" />
                        {m.isExisting && <span className="ml-2 text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-sm">已有</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <input type="text" value={m.port} onChange={e => handleMemberChange(i, 'port', e.target.value)} disabled={m.isExisting} className="w-20 bg-transparent outline-none border-b border-transparent focus:border-indigo-300 font-mono text-slate-700" />
                    </td>
                    {showPriorityColumn && (
                      <td className="px-4 py-2">
                        <input type="number" value={m.priority} onChange={e => handleMemberChange(i, 'priority', e.target.value)} disabled={m.isExisting} className="w-16 bg-transparent outline-none border-b border-transparent focus:border-indigo-300 font-mono text-slate-700" />
                      </td>
                    )}
                    <td className="px-4 py-2 text-right">
                      {!m.isExisting && <button onClick={() => removeMember(i)} className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200">
              <button onClick={addMember} className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center"><PlusCircle className="w-3.5 h-3.5 mr-1.5"/> 添加后端节点</button>
            </div>
          </div>
        </section>
      </div>

      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end rounded-b-md">
        <button onClick={() => onNext({ 
          ...requirement, 
          vsName: basicInfo.name, 
          lbMethod: backend.algorithm, 
          members: backend.members.map(m => `${m.ip}:${m.port}${m.priority ? ':'+m.priority : ''}`), 
          isExistingConfig: !!existingConfig, 
          priorityEnabled: backend.priorityEnabled,
          snat: backend.snat,
          persistence: profiles.persistence,
          monitor: backend.monitor
        })} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md text-sm font-medium shadow-sm flex items-center transition-all">
          保存并进入差异分析 <ArrowRight className="w-4 h-4 ml-2"/>
        </button>
      </div>
    </div>
  );
};

const InputField = ({ label, value, onChange, disabled, locked, allowUnlock, isLockedState, onToggleLock }: any) => (
  <div className="flex flex-col relative">
    <label className="text-[11px] font-medium text-slate-500 mb-1.5">{label}</label>
    <div className="relative">
      <input type="text" value={value} onChange={e => onChange(e.target.value)} disabled={allowUnlock ? isLockedState : disabled} className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200" />
      {locked && (
        <button onClick={allowUnlock ? onToggleLock : undefined} className={`absolute right-2 top-2 ${allowUnlock ? 'cursor-pointer hover:text-indigo-600' : 'cursor-default'}`}>
            {allowUnlock && !isLockedState ? <LockOpen className="w-3.5 h-3.5 text-indigo-500"/> : <Lock className="w-3.5 h-3.5 text-slate-400"/>}
        </button>
      )}
    </div>
  </div>
);

const SelectField = ({ label, value, onChange, options, disabled }: any) => (
  <div className="flex flex-col">
    <label className="text-[11px] font-medium text-slate-500 mb-1.5">{label}</label>
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-indigo-500 outline-none appearance-none disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200">
        {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2 top-2 w-4 h-4 text-slate-400 pointer-events-none"/>
    </div>
  </div>
);

// --- 主组件 ---
export default function App() {
  const [activeReqId, setActiveReqId] = useState(REQUIREMENTS[0].id);
  const [viewState, setViewState] = useState<'form' | 'review' | 'script'>('form'); 
  const [step, setStep] = useState(1);
  const [userSelections, setUserSelections] = useState<Record<string, Record<string, boolean>>>({}); 
  const [confirmedReqs, setConfirmedReqs] = useState<Record<string, boolean>>({});
  const [reqDataMap, setReqDataMap] = useState<Record<string, Requirement>>({}); 

  useEffect(() => {
    const defaults: any = {};
    const initData: any = {};
    REQUIREMENTS.forEach(req => {
      initData[req.id] = req; 
      const analysis = analyzeRequirement(req);
      const reqActions: any = {};
      analysis.actions.forEach(act => { if (!act.disabled) reqActions[act.id] = true; });
      defaults[req.id] = reqActions;
    });
    setUserSelections(defaults);
    setReqDataMap(initData);
  }, []);

  const handleFormSubmit = (updatedReq: Requirement) => {
    setReqDataMap(prev => ({ ...prev, [updatedReq.id]: updatedReq }));
    setViewState('review');
    setStep(2);
  };

  const handleConfirmCurrent = () => {
    setConfirmedReqs(prev => ({ ...prev, [activeReqId]: true }));
    const idx = REQUIREMENTS.findIndex(r => r.id === activeReqId);
    if (idx < REQUIREMENTS.length - 1) {
      setActiveReqId(REQUIREMENTS[idx+1].id);
      setViewState('form'); 
      setStep(1);
    }
  };

  const currentReqRaw = REQUIREMENTS.find(r => r.id === activeReqId)!;
  const currentReqData = reqDataMap[activeReqId] || currentReqRaw;
  const currentAnalysis = useMemo(() => analyzeRequirement(currentReqData), [currentReqData]);
  const currentSelections = userSelections[activeReqId] || {};
  const allConfirmed = REQUIREMENTS.every(r => confirmedReqs[r.id]);

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 text-sm overflow-hidden">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 z-20 shadow-xl">
        <div className="h-14 flex items-center px-4 border-b border-slate-800 bg-slate-950">
           <div className="flex items-center w-full space-x-3">
             <div className="w-8 h-8 bg-indigo-600 text-white rounded-md flex items-center justify-center shrink-0 shadow-sm"><FileText className="w-4 h-4"/></div>
             <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-500 font-medium tracking-wide">交付工单</div>
                <div className="font-bold text-slate-200 truncate text-xs">{TICKET_INFO.id}</div>
             </div>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
           <div className="px-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                <span>负载均衡策略</span>
                <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-sm">{REQUIREMENTS.length}</span>
              </div>
              <div className="space-y-0.5">
                 {REQUIREMENTS.map((req) => (
                    <div key={req.id} onClick={() => { setActiveReqId(req.id); setViewState(confirmedReqs[req.id] ? 'review' : 'form'); setStep(confirmedReqs[req.id] ? 2 : 1); }} className={`group px-3 py-2 rounded-md cursor-pointer transition-colors text-xs flex flex-col gap-0.5 ${activeReqId === req.id ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-800/50 text-slate-400'}`}>
                        <div className="flex justify-between items-center">
                            <span className={`font-medium truncate ${activeReqId === req.id ? 'text-indigo-300' : 'text-slate-300'}`}>{req.app}</span>
                            {confirmedReqs[req.id] && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0"/>}
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className={`font-mono text-[10px] ${activeReqId === req.id ? 'text-indigo-400/80' : 'text-slate-500'}`}>{req.vip}</span>
                        </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
            <button onClick={() => { setViewState('script'); setStep(3); }} disabled={!allConfirmed} className={`w-full py-2 rounded-md text-xs font-medium flex items-center justify-center transition-all shadow-sm ${allConfirmed ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                <TerminalSquare className="w-3.5 h-3.5 mr-2"/> 合并生成变更脚本
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50">
         <div className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
            <div className="flex items-center text-sm">
                <span className="text-slate-500 font-medium">配置交付</span>
                <ChevronRight className="w-4 h-4 mx-1 text-slate-400"/>
                <span className="font-semibold text-slate-800">{viewState === 'form' ? '策略配置填报' : viewState === 'review' ? '差异分析确认' : '脚本执行'}</span>
            </div>
            <div className="flex items-center space-x-1">
                <StepIndicator num={1} label="填报" active={step >= 1} current={step === 1} />
                <div className={`w-6 h-px ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                <StepIndicator num={2} label="分析" active={step >= 2} current={step === 2} />
                <div className={`w-6 h-px ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                <StepIndicator num={3} label="执行" active={step >= 3} current={step === 3} />
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-6">
            {viewState === 'form' && <div className="max-w-5xl mx-auto"><LBProvisionForm requirement={currentReqData} onNext={handleFormSubmit} /></div>}
            {viewState === 'review' && (
                <div className="max-w-6xl mx-auto grid grid-cols-12 gap-6 animate-in fade-in duration-300">
                    <div className="col-span-8 lg:col-span-9 bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center space-x-2"><ListFilter className="w-4 h-4 text-slate-500"/><span className="text-sm font-semibold text-slate-800">配置参数比对分析</span></div>
                        </div>
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                <tr><th className="px-5 py-3 font-medium w-1/4">分析项</th><th className="px-5 py-3 font-medium text-indigo-700 w-1/3">工单目标值</th><th className="px-5 py-3 font-medium text-slate-600 w-5/12">现网配置值</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentAnalysis.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="px-5 py-4 font-medium text-slate-600 bg-slate-50/30 border-r border-slate-100">{row.label}</td>
                                        <td className={`px-5 py-4 font-mono text-slate-800 border-r border-slate-100 ${row.highlight ? 'bg-indigo-50/30' : ''}`}>{row.target}</td>
                                        <td className={`px-5 py-4 font-mono text-slate-500`}>
                                            {row.current || '-'}
                                            {row.msg && <div className={`mt-2 text-[10px] px-2.5 py-1.5 rounded-sm flex items-start ${row.status === 'conflict' ? 'text-rose-700 bg-rose-50' : row.status === 'match' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>{row.msg}</div>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="col-span-4 lg:col-span-3 bg-white rounded-md border border-slate-200 shadow-sm flex flex-col">
                        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50"><span className="text-sm font-semibold text-slate-800">决策与动作</span></div>
                        <div className="p-4 flex-1 space-y-4">
                            {currentAnalysis.actions.map(act => (
                                <div key={act.id} onClick={() => !act.disabled && setUserSelections(prev => ({ ...prev, [activeReqId]: { ...prev[activeReqId], [act.id]: !prev[activeReqId]?.[act.id] } }))} className={`flex p-3 rounded-md border text-xs cursor-pointer ${currentSelections[act.id] ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                                    <div className="mr-2.5 shrink-0 mt-0.5">{currentSelections[act.id] ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-slate-300" />}</div>
                                    <div><div className="font-semibold mb-0.5">{act.name}</div><div className="text-[10px] text-slate-500">{act.desc}</div></div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-md">
                            <button onClick={handleConfirmCurrent} className="w-full py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-md font-medium text-xs flex items-center justify-center transition-colors">确认方案 & 下一项 <ArrowRight className="w-3.5 h-3.5 ml-1.5"/></button>
                        </div>
                    </div>
                </div>
            )}
            {viewState === 'script' && (
                <div className="max-w-5xl mx-auto h-full flex flex-col animate-in zoom-in-95 duration-300">
                    <div className="bg-white rounded-md border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center"><TerminalSquare className="w-5 h-5 mr-2 text-slate-600"/><span className="text-sm font-semibold text-slate-800">变更脚本下发预览</span></div>
                        </div>
                        <div className="flex-1 bg-slate-900 p-6 overflow-auto custom-scrollbar">
                            <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {generateFinalScript(userSelections, reqDataMap).map((block, i) => (
                                    <div key={i} className="mb-8">
                                        <div className="text-emerald-400 font-bold mb-2 border-b border-slate-700 pb-1.5 flex justify-between"><span># Target Device: {block.device}</span></div>
                                        {block.code}
                                    </div>
                                ))}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
         </div>
      </main>
    </div>
  );
}

const StepIndicator = ({ num, label, active, current }: any) => (
    <div className={`flex items-center space-x-1.5 px-1 ${active ? 'opacity-100' : 'opacity-40 grayscale'}`}>
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${current ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-500'}`}>{num}</div>
        <span className={`text-[11px] font-semibold ${current ? 'text-indigo-700' : 'text-slate-500'}`}>{label}</span>
    </div>
);
