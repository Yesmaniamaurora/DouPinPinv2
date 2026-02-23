import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Image as ImageIcon, Loader2, Settings2, Lock, LayoutGrid, Sparkles, ShieldCheck, History, Key, Trash2, CheckCircle2, XCircle, LogOut } from 'lucide-react';
import { PerlerBeadGenerator, Algorithm } from './core/generator';
import { PaletteKey, brandNames, palettes, deltaE } from './core/color_utils';
import { getBrowserFingerprint } from './core/fingerprint';

type Tab = 'base' | 'advanced' | 'admin';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('base');
  
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [licenseKey, setLicenseKey] = useState('');
  const [authError, setAuthError] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  // Admin States
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [adminKeys, setAdminKeys] = useState<any[]>([]);
  const [generatedKey, setGeneratedKey] = useState('');
  const [isFetchingAdminData, setIsFetchingAdminData] = useState(false);

  const [image, setImage] = useState<string | null>(null);
  const [width, setWidth] = useState<number>(40);
  const [height, setHeight] = useState<number>(40);
  const [algorithm, setAlgorithm] = useState<Algorithm>('dominant_pooling');
  const [palette, setPalette] = useState<PaletteKey>('mard');
  const [brightness, setBrightness] = useState<number>(0);
  const [removeBackground, setRemoveBackground] = useState<boolean>(false);
  const [backgroundTolerance, setBackgroundTolerance] = useState<number>(30);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [grid, setGrid] = useState<any[][] | null>(null);
  const [selectedColorCodes, setSelectedColorCodes] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  
  // BFS States
  const [bfsThreshold, setBfsThreshold] = useState<number>(15);
  const [isBfsMode, setIsBfsMode] = useState<boolean>(false);
  const [missingColorCode, setMissingColorCode] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (grid && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        import('./core/draw_utils').then(({ drawPattern }) => {
          drawPattern(ctx, grid, 40, 60, selectedColorCodes);
          setResultImage(canvasRef.current!.toDataURL('image/png'));
        });
      }
    }
  }, [grid, selectedColorCodes]);

  useEffect(() => {
    const checkAuth = async () => {
      const savedKey = localStorage.getItem('perler_license');
      if (savedKey) {
        try {
          const fp = await getBrowserFingerprint();
          const res = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: savedKey, fingerprint: fp })
          });
          const data = await res.json();
          if (data.success) {
            setIsAuth(true);
            if (data.isAdmin) setIsAdmin(true);
          } else {
            localStorage.removeItem('perler_license');
          }
        } catch (e) {
          console.error(e);
        }
      }
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setIsActivating(true);
    setAuthError('');
    try {
      const fp = await getBrowserFingerprint();
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: licenseKey.trim(), fingerprint: fp })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('perler_license', licenseKey.trim());
        setIsAuth(true);
        if (data.isAdmin) setIsAdmin(true);
      } else {
        setAuthError(data.error || '验证失败');
      }
    } catch (e) {
      setAuthError('网络错误，请重试');
    } finally {
      setIsActivating(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setResultImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!image) return;
    
    const w = Math.min(Math.max(1, width), 120);
    const h = Math.min(Math.max(1, height), 120);
    setWidth(w);
    setHeight(h);

    setIsGenerating(true);
    
    try {
      const imgElement = new Image();
      imgElement.src = image;
      await new Promise((resolve) => {
        imgElement.onload = resolve;
      });

      setTimeout(async () => {
        try {
          const result = await PerlerBeadGenerator.generate(
            imgElement, 
            w, 
            h, 
            algorithm, 
            palette, 
            brightness,
            removeBackground,
            backgroundTolerance
          );
          setGrid(result.grid);
          setResultImage(result.image);
          setSelectedColorCodes([]);
          setIsLocked(false);
        } catch (error) {
          console.error("Generation failed:", error);
          alert("生成图纸失败，请重试。 Generation failed, please try again.");
        } finally {
          setIsGenerating(false);
        }
      }, 50);
      
    } catch (error) {
      console.error("Image loading failed:", error);
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `perler-pattern-${width}x${height}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!grid || !resultImage) return;
    
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate scale
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    
    const realX = x * scaleX;
    const realY = y * scaleY;
    
    const cellSize = 40;
    const margin = 60;
    const rows = grid.length;
    const cols = grid[0].length;
    const gridWidth = cols * cellSize;
    const offsetX = (img.naturalWidth - gridWidth) / 2;
    const offsetY = margin;
    
    if (realX >= offsetX && realX <= offsetX + gridWidth && realY >= offsetY && realY <= offsetY + rows * cellSize) {
      const c = Math.floor((realX - offsetX) / cellSize);
      const r = Math.floor((realY - offsetY) / cellSize);
      
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        if (isBfsMode) {
          const newGrid = PerlerBeadGenerator.mergeRegion(grid, r, c, bfsThreshold);
          setGrid(newGrid);
        } else {
          const color = grid[r][c];
          toggleColorSelection(color.code);
        }
      }
    }
  };

  const toggleColorSelection = (code: string) => {
    if (isLocked) {
      setSelectedColorCodes(prev => {
        if (prev.includes(code)) {
          return prev.filter(c => c !== code);
        } else {
          if (prev.length >= 3) return prev; // Max 3 for multi-select
          return [...prev, code];
        }
      });
    } else {
      setSelectedColorCodes(prev => prev.includes(code) && prev.length === 1 ? [] : [code]);
    }
    setMissingColorCode(code);
  };

  const clearSelection = () => {
    setSelectedColorCodes([]);
    setIsLocked(false);
  };

  const fetchAdminData = async () => {
    if (!isAdmin) return;
    setIsFetchingAdminData(true);
    try {
      const savedKey = localStorage.getItem('perler_license');
      const [logsRes, keysRes] = await Promise.all([
        fetch('/api/admin/logs', { headers: { 'x-admin-key': savedKey || '' } }),
        fetch('/api/admin/keys', { headers: { 'x-admin-key': savedKey || '' } })
      ]);
      const logs = await logsRes.json();
      const keys = await keysRes.json();
      setAdminLogs(logs);
      setAdminKeys(keys);
    } catch (e) {
      console.error('Failed to fetch admin data', e);
    } finally {
      setIsFetchingAdminData(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && isAdmin) {
      fetchAdminData();
    }
  }, [activeTab, isAdmin]);

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedKey(result);
  };

  const adoptKey = async () => {
    if (!generatedKey) return;
    try {
      const savedKey = localStorage.getItem('perler_license');
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': savedKey || ''
        },
        body: JSON.stringify({ key: generatedKey })
      });
      if (res.ok) {
        setGeneratedKey('');
        fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteKey = async (keyToDelete: string) => {
    if (!window.confirm(`确定要删除密钥 ${keyToDelete} 吗？\nAre you sure you want to delete key ${keyToDelete}?`)) return;
    try {
      const savedKey = localStorage.getItem('perler_license');
      const res = await fetch(`/api/admin/keys/${keyToDelete}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': savedKey || '' }
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('perler_license');
    setIsAuth(false);
    setIsAdmin(false);
    setLicenseKey('');
    setActiveTab('base');
  };

  const handleAutoMerge = () => {
    if (!grid) return;
    const newGrid = PerlerBeadGenerator.autoMerge(grid, bfsThreshold);
    setGrid(newGrid);
  };

  const renderAdminTab = () => {
    if (!isAdmin) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[600px] p-4 text-center">
          <ShieldCheck className="w-16 h-16 text-red-400 mb-4" />
          <h2 className="text-2xl font-bold text-[#20243F]">权限不足</h2>
          <p className="text-neutral-500">此页面仅限管理员访问<br/>Admin access only</p>
        </div>
      );
    }

    return (
      <div className="space-y-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Logs */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-[#a3bdb2]/40 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-[#a3bdb2]/30 pb-4">
                <History className="w-5 h-5 text-[#20243F]" />
                <h2 className="text-lg font-medium text-[#20243F]">最近登录 <span className="text-neutral-400 text-sm font-normal ml-1">Recent Logins</span></h2>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {adminLogs.map(log => (
                  <div key={log.id} className="p-3 rounded-xl bg-neutral-50 border border-[#a3bdb2]/20 text-[10px] space-y-1">
                    <div className="flex justify-between font-bold text-[#20243F]">
                      <span>{log.key}</span>
                      <span className={log.status.includes('success') ? 'text-green-600' : 'text-red-600'}>{log.status}</span>
                    </div>
                    <div className="text-neutral-500 flex justify-between">
                      <span>{log.ip}</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="truncate opacity-60">FP: {log.fingerprint}</div>
                  </div>
                ))}
                {adminLogs.length === 0 && <p className="text-center py-10 text-neutral-400 text-xs">暂无日志</p>}
              </div>
            </div>

            {/* Key Generation */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#a3bdb2]/40 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-[#a3bdb2]/30 pb-4">
                <Key className="w-5 h-5 text-[#20243F]" />
                <h2 className="text-lg font-medium text-[#20243F]">生成密钥 <span className="text-neutral-400 text-sm font-normal ml-1">Generate Key</span></h2>
              </div>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={generatedKey}
                    placeholder="点击生成 ->"
                    className="flex-1 px-3 py-2 rounded-lg border border-[#a3bdb2]/50 bg-neutral-50 font-mono text-sm"
                  />
                  <button 
                    onClick={generateRandomKey}
                    className="px-4 py-2 bg-[#a3bdb2]/20 text-[#20243F] rounded-lg hover:bg-[#a3bdb2]/30 transition-colors text-sm font-medium"
                  >
                    生成
                  </button>
                </div>
                <button 
                  onClick={adoptKey}
                  disabled={!generatedKey}
                  className="w-full py-2.5 bg-[#20243F] text-white rounded-xl hover:bg-[#20243F]/90 disabled:opacity-50 transition-colors font-medium text-sm"
                >
                  采用 (Save Key)
                </button>
              </div>
            </div>
          </div>

          {/* Right: Key Management */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-[#a3bdb2]/40 p-6 flex flex-col h-full min-h-[600px]">
              <div className="flex items-center justify-between border-b border-[#a3bdb2]/30 pb-4 mb-6">
                <h2 className="text-lg font-medium text-[#20243F]">密钥管理 <span className="text-neutral-400 text-sm font-normal ml-1">Key Management</span></h2>
                <button onClick={fetchAdminData} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <Loader2 className={`w-4 h-4 text-[#20243F] ${isFetchingAdminData ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {/* Unused Keys */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-neutral-500 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    未使用密钥 Unused
                  </h3>
                  <div className="space-y-2">
                    {adminKeys.filter(k => !k.fingerprint).map(k => (
                      <div key={k.key} className="flex items-center justify-between p-3 bg-green-50/30 border border-green-100 rounded-xl group">
                        <span className="font-mono text-sm text-[#20243F]">{k.key}</span>
                        <button 
                          onClick={() => deleteKey(k.key)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {adminKeys.filter(k => !k.fingerprint).length === 0 && <p className="text-center py-10 text-neutral-400 text-xs">暂无未使用密钥</p>}
                  </div>
                </div>

                {/* Used Keys */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-neutral-500 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-orange-500" />
                    已使用密钥 Used
                  </h3>
                  <div className="space-y-2">
                    {adminKeys.filter(k => k.fingerprint).map(k => (
                      <div key={k.key} className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1 group relative">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-sm text-[#20243F]">{k.key}</span>
                          <button 
                            onClick={() => deleteKey(k.key)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-[9px] text-neutral-400 truncate">FP: {k.fingerprint}</div>
                      </div>
                    ))}
                    {adminKeys.filter(k => k.fingerprint).length === 0 && <p className="text-center py-10 text-neutral-400 text-xs">暂无已使用密钥</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBaseTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-24">
      {/* Left Panel: Controls */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-[#a3bdb2]/40 p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-[#a3bdb2]/30 pb-4">
            <Settings2 className="w-5 h-5 text-[#20243F]" />
            <h2 className="text-lg font-medium text-[#20243F]">参数设置 <span className="text-neutral-400 text-sm font-normal ml-1">Parameters</span></h2>
          </div>

          {/* Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700">上传原图 <span className="text-neutral-400 font-normal ml-1">Upload Image</span></label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[#a3bdb2]/50 border-dashed rounded-xl hover:border-[#20243F] hover:bg-[#a3bdb2]/10 transition-colors cursor-pointer group"
            >
              <div className="space-y-1 text-center">
                {image ? (
                  <div className="relative w-full h-32 rounded-lg overflow-hidden">
                    <img src={image} alt="Preview" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-[#a3bdb2] group-hover:text-[#20243F] transition-colors" />
                    <div className="flex text-sm text-neutral-600 justify-center">
                      <span className="relative rounded-md font-medium text-[#20243F] hover:text-[#20243F]/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#20243F]">
                        点击上传图片 Click to upload
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">支持 PNG, JPG 格式</p>
                  </>
                )}
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/jpeg, image/png" 
              className="hidden" 
            />
          </div>

          {/* Dimensions */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700">宽度 <span className="text-neutral-400 font-normal ml-1">Width</span> (Max: 120)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="120" 
                  value={width} 
                  onChange={(e) => setWidth(parseInt(e.target.value) || 1)}
                  className="block w-full rounded-lg border-[#a3bdb2]/50 shadow-sm focus:border-[#20243F] focus:ring-[#20243F] sm:text-sm px-3 py-2 border outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700">高度 <span className="text-neutral-400 font-normal ml-1">Height</span> (Max: 120)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="120" 
                  value={height} 
                  onChange={(e) => setHeight(parseInt(e.target.value) || 1)}
                  className="block w-full rounded-lg border-[#a3bdb2]/50 shadow-sm focus:border-[#20243F] focus:ring-[#20243F] sm:text-sm px-3 py-2 border outline-none"
                />
              </div>
            </div>
            {/* Quick Sizes */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => { setWidth(18); setHeight(18); }} className="px-2 py-1 text-xs bg-[#a3bdb2]/20 hover:bg-[#a3bdb2]/40 rounded text-[#20243F] transition-colors border border-[#a3bdb2]/30">18x18 (小挂件 Small)</button>
              <button onClick={() => { setWidth(36); setHeight(36); }} className="px-2 py-1 text-xs bg-[#a3bdb2]/20 hover:bg-[#a3bdb2]/40 rounded text-[#20243F] transition-colors border border-[#a3bdb2]/30">36x36</button>
              <button onClick={() => { setWidth(52); setHeight(52); }} className="px-2 py-1 text-xs bg-[#a3bdb2]/20 hover:bg-[#a3bdb2]/40 rounded text-[#20243F] transition-colors border border-[#a3bdb2]/30">52x52 (标准 Std)</button>
              <button onClick={() => { setWidth(72); setHeight(72); }} className="px-2 py-1 text-xs bg-[#a3bdb2]/20 hover:bg-[#a3bdb2]/40 rounded text-[#20243F] transition-colors border border-[#a3bdb2]/30">72x72</button>
            </div>
          </div>

          {/* Algorithm */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700">降采样算法 <span className="text-neutral-400 font-normal ml-1">Downsampling</span></label>
            <select 
              value={algorithm} 
              onChange={(e) => setAlgorithm(e.target.value as Algorithm)}
              className="block w-full rounded-lg border-[#a3bdb2]/50 shadow-sm focus:border-[#20243F] focus:ring-[#20243F] sm:text-sm px-3 py-2 border bg-white outline-none"
            >
              <option value="average">区域平均 (Average)</option>
              <option value="dominant_pooling">频率最大化池化 (Dominant Pooling) - 默认</option>
              <option value="gradient_enhanced">边缘识别 (Gradient Enhanced)</option>
              <option value="nearest">中心像素 (Nearest)</option>
            </select>
          </div>

          {/* Palette */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700">色系选择 <span className="text-neutral-400 font-normal ml-1">Palette</span></label>
            <select 
              value={palette} 
              onChange={(e) => setPalette(e.target.value as PaletteKey)}
              className="block w-full rounded-lg border-[#a3bdb2]/50 shadow-sm focus:border-[#20243F] focus:ring-[#20243F] sm:text-sm px-3 py-2 border bg-white outline-none"
            >
              {brandNames.map(brand => (
                <option key={brand} value={brand}>{brand}色卡</option>
              ))}
            </select>
          </div>

          {/* Brightness */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700">亮度调节 <span className="text-neutral-400 font-normal ml-1">Brightness</span></label>
            <input 
              type="range" 
              min="-2" 
              max="2" 
              step="1" 
              value={brightness} 
              onChange={(e) => setBrightness(parseInt(e.target.value))}
              className="w-full accent-[#20243F]"
            />
            <div className="flex justify-between text-xs text-neutral-500">
              <span>-2 (暗 Dark)</span>
              <span>0 (默认 Default)</span>
              <span>+2 (亮 Light)</span>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!image || isGenerating}
            className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white ${
              !image || isGenerating ? 'bg-[#a3bdb2] cursor-not-allowed text-white/70' : 'bg-[#20243F] hover:bg-[#20243F]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#20243F]'
            } transition-colors`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                生成中 Generating...
              </>
            ) : (
              '生成图纸 Generate'
            )}
          </button>
        </div>
      </div>

      {/* Right Panel: Result */}
      <div className="lg:col-span-8">
        <div className="bg-white rounded-2xl shadow-sm border border-[#a3bdb2]/40 p-6 h-full min-h-[600px] flex flex-col">
          <div className="flex items-center justify-between border-b border-[#a3bdb2]/30 pb-4 mb-4">
            <h2 className="text-lg font-medium text-[#20243F]">预览结果 <span className="text-neutral-400 text-sm font-normal ml-1">Preview</span></h2>
            {resultImage && (
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 border border-[#a3bdb2]/50 shadow-sm text-sm font-medium rounded-lg text-[#20243F] bg-white hover:bg-[#a3bdb2]/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#20243F] transition-colors"
              >
                <Download className="-ml-1 mr-2 h-4 w-4 text-[#20243F]" />
                下载图纸 Download
              </button>
            )}
          </div>

          <div className="flex-1 bg-white rounded-xl border border-[#a3bdb2]/30 overflow-hidden flex items-center justify-center relative">
            {isGenerating ? (
              <div className="flex flex-col items-center text-[#20243F]">
                <Loader2 className="animate-spin h-10 w-10 mb-4 text-[#20243F]" />
                <p>正在处理图像并匹配色号 Processing...</p>
              </div>
            ) : resultImage ? (
              <div className="w-full h-full overflow-auto p-4 flex items-center justify-center bg-neutral-100/50">
                <img 
                  src={resultImage} 
                  alt="Generated Pattern" 
                  className="max-w-none shadow-md"
                  style={{ maxHeight: '800px' }}
                />
                <div className="absolute bottom-2 right-4 text-[10px] text-neutral-400 bg-white/80 px-2 py-0.5 rounded-full shadow-sm">
                  Num of Colors: {grid ? new Set(grid.flat().map(c => c.code)).size : 0}
                </div>
              </div>
            ) : (
              <div className="text-center text-neutral-400">
                <ImageIcon className="mx-auto h-12 w-12 mb-3 opacity-30 text-[#20243F]" />
                <p>上传图片并点击生成，在此预览图纸<br/><span className="text-sm">Upload an image and generate to preview</span></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdvancedTab = () => {
    if (isCheckingAuth) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[600px]">
          <Loader2 className="w-8 h-8 text-[#a3bdb2] animate-spin" />
        </div>
      );
    }

    if (!isAuth) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[600px] p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#a3bdb2]/30 w-full max-w-md p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-[#a3bdb2]/20 rounded-2xl mx-auto flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-[#20243F]" />
              </div>
              <h1 className="text-2xl font-bold text-[#20243F]">高级功能解锁</h1>
              <p className="text-neutral-500 text-sm">请输入激活密钥以绑定此设备<br/>Please enter activation key to bind device</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <input 
                  type="text" 
                  value={licenseKey}
                  onChange={e => setLicenseKey(e.target.value)}
                  placeholder="例如: VIP-8888"
                  className="w-full px-4 py-3 rounded-xl border border-[#a3bdb2]/50 focus:border-[#20243F] focus:ring-2 focus:ring-[#20243F] outline-none transition-all text-center font-mono text-lg tracking-wider uppercase"
                />
              </div>
              {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
              <button 
                onClick={handleActivate}
                disabled={isActivating || !licenseKey}
                className="w-full py-3 rounded-xl bg-[#20243F] text-white font-medium hover:bg-[#20243F]/90 disabled:opacity-50 transition-colors flex justify-center items-center"
              >
                {isActivating ? <Loader2 className="w-5 h-5 animate-spin" /> : '激活设备 Activate'}
              </button>
            </div>
            
            <div className="text-xs text-neutral-400 text-center mt-6">
              <p>设备指纹技术保护 · 一机一码</p>
              <p>Device Fingerprinting Protected</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8 pb-24">
        {/* Background Removal Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#a3bdb2]/40 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[#a3bdb2]/30 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#20243F]" />
              <h2 className="text-xl font-bold text-[#20243F]">高级背景处理 <span className="text-neutral-400 text-sm font-normal ml-1">Advanced Background Removal</span></h2>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={removeBackground} 
                  onChange={(e) => setRemoveBackground(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#a3bdb2]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#20243F]"></div>
                <span className="ml-3 text-sm font-medium text-[#20243F]">{removeBackground ? '已开启 Enabled' : '已关闭 Disabled'}</span>
              </label>
            </div>
          </div>

          <div className={`space-y-6 transition-opacity ${removeBackground ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-neutral-700">背景容差 <span className="text-neutral-400 font-normal ml-1">Tolerance</span></label>
                  <span className="text-xs font-bold text-[#20243F] bg-[#a3bdb2]/20 px-2 py-1 rounded">{backgroundTolerance}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={backgroundTolerance} 
                  onChange={(e) => setBackgroundTolerance(parseInt(e.target.value))}
                  className="w-full accent-[#20243F]"
                />
                <p className="text-[10px] text-neutral-500">数值越大，越多的相近颜色会被识别为背景。基于洪水填充算法从四个角落开始扩散。</p>
              </div>
              <div className="bg-neutral-50 rounded-xl p-4 border border-[#a3bdb2]/20 text-xs text-neutral-600 space-y-2">
                <p className="font-bold flex items-center gap-1"><Settings2 className="w-3 h-3" /> 算法说明 Algorithm Note:</p>
                <p>采用洪水填充 (Flood Fill) 逻辑，从图像边缘识别连通的浅色区域。被识别为背景的像素在生成清单时将不被计入，且在图纸中以淡灰色显示，帮助您专注于主体创作。</p>
              </div>
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={!image || isGenerating}
              className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white ${
                !image || isGenerating ? 'bg-[#a3bdb2] cursor-not-allowed text-white/70' : 'bg-[#20243F] hover:bg-[#20243F]/90'
              } transition-colors`}
            >
              {isGenerating ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : '应用设置并重新生成 Apply & Re-generate'}
            </button>
          </div>
        </div>

        {/* Region Color Merging Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#a3bdb2]/40 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[#a3bdb2]/30 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#20243F]" />
              <h2 className="text-xl font-bold text-[#20243F]">区域颜色合并 (BFS 算法) <span className="text-neutral-400 text-sm font-normal ml-1">Region Color Merging</span></h2>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isBfsMode} 
                  onChange={(e) => setIsBfsMode(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#a3bdb2]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#20243F]"></div>
                <span className="ml-3 text-sm font-medium text-[#20243F]">{isBfsMode ? '手动吸取开启' : '手动吸取关闭'}</span>
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-neutral-700">合并阈值 <span className="text-neutral-400 font-normal ml-1">Threshold</span></label>
                  <span className="text-xs font-bold text-[#20243F] bg-[#a3bdb2]/20 px-2 py-1 rounded">{bfsThreshold}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={bfsThreshold} 
                  onChange={(e) => setBfsThreshold(parseInt(e.target.value))}
                  className="w-full accent-[#20243F]"
                />
                <p className="text-[10px] text-neutral-500">数值越大，越多的相近颜色会被合并。开启手动吸取后点击下方预览图中的格子即可触发合并，或者点击下方“全图自动合并”。</p>
              </div>
              <div className="bg-neutral-50 rounded-xl p-4 border border-[#a3bdb2]/20 text-xs text-neutral-600 space-y-2">
                <p className="font-bold flex items-center gap-1"><Settings2 className="w-3 h-3" /> 使用说明 Usage:</p>
                <p>1. 调整合并阈值。<br/>2. <b>手动合并：</b>开启“手动吸取开启”开关，在下方“智能寻色辅助”或“预览结果”区域点击你想要合并的色块。<br/>3. <b>自动合并：</b>点击下方“全图自动合并”按钮，系统将根据阈值自动处理全图杂色。</p>
              </div>
            </div>
            
            <button
              onClick={handleAutoMerge}
              disabled={!grid || isGenerating}
              className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white ${
                !grid || isGenerating ? 'bg-[#a3bdb2] cursor-not-allowed text-white/70' : 'bg-[#20243F] hover:bg-[#20243F]/90'
              } transition-colors`}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              全图自动合并 (Auto Merge All)
            </button>
          </div>
        </div>

        {/* Intelligent Color Seeking Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#a3bdb2]/40 p-6 min-h-[600px] flex flex-col space-y-6">
          <div className="flex items-center justify-between border-b border-[#a3bdb2]/30 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#20243F]" />
              <h2 className="text-xl font-bold text-[#20243F]">智能寻色辅助 <span className="text-neutral-400 text-sm font-normal ml-1">Intelligent Color Seeking</span></h2>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsLocked(!isLocked)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isLocked ? 'bg-[#20243F] text-white' : 'bg-[#a3bdb2]/20 text-[#20243F] hover:bg-[#a3bdb2]/30'
                }`}
              >
                {isLocked ? <Lock className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                {isLocked ? '多选锁定中' : '单选模式'}
              </button>
              <button 
                onClick={clearSelection}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                清除选择
              </button>
            </div>
          </div>

          {!resultImage ? (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 py-20">
              <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
              <p>请先在“基础”页生成图纸<br/><span className="text-sm">Please generate pattern in Base tab first</span></p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
              {/* Interactive Canvas */}
              <div className="lg:col-span-8 bg-neutral-100 rounded-xl border border-[#a3bdb2]/30 overflow-hidden flex items-center justify-center relative group">
                <div className="w-full h-full overflow-auto p-4 flex items-center justify-center">
                  <img 
                    src={resultImage} 
                    alt="Interactive Pattern" 
                    className="max-w-none shadow-lg cursor-crosshair transition-all"
                    onClick={handleCanvasClick}
                    style={{ maxHeight: '750px' }}
                  />
                </div>
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-[#a3bdb2]/30 text-xs font-medium text-[#20243F] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  点击格子定位色号 Click cell to seek color
                </div>
              </div>

              {/* Color Palette List */}
              <div className="lg:col-span-4 flex flex-col space-y-4">
                <div className="bg-neutral-50 rounded-xl p-4 border border-[#a3bdb2]/20 flex-1 overflow-hidden flex flex-col">
                  <h3 className="text-sm font-bold text-[#20243F] mb-3 flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" />
                    本图色号清单 <span className="text-xs font-normal opacity-60">Color List</span>
                  </h3>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {grid && (() => {
                      const statsMap = new Map<string, { color: any, count: number }>();
                      grid.flat().forEach(cell => {
                        if (!statsMap.has(cell.code)) statsMap.set(cell.code, { color: cell, count: 0 });
                        statsMap.get(cell.code)!.count++;
                      });
                      return Array.from(statsMap.values())
                        .sort((a, b) => b.count - a.count)
                        .map(({ color, count }) => {
                          const isSelected = selectedColorCodes.includes(color.code);
                          return (
                            <button
                              key={color.code}
                              onClick={() => toggleColorSelection(color.code)}
                              className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all ${
                                isSelected 
                                  ? 'bg-[#20243F] border-[#20243F] text-white shadow-md scale-[1.02]' 
                                  : 'bg-white border-[#a3bdb2]/30 text-[#20243F] hover:border-[#20243F]/50'
                              }`}
                            >
                              <div 
                                className="w-8 h-8 rounded shadow-inner flex items-center justify-center text-[10px] font-bold"
                                style={{ 
                                  backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`,
                                  color: (0.299 * color.rgb[0] + 0.587 * color.rgb[1] + 0.114 * color.rgb[2]) > 128 ? '#000' : '#fff'
                                }}
                              >
                                {color.code}
                              </div>
                              <div className="flex-1 text-left">
                                <div className="text-xs font-bold">{color.code}</div>
                                <div className="text-[10px] opacity-60">{count} 颗 Beads</div>
                              </div>
                              {isSelected && <Sparkles className="w-4 h-4 text-[#a3bdb2]" />}
                            </button>
                          );
                        });
                    })()}
                  </div>
                </div>
                
                <div className="bg-[#20243F] text-white rounded-xl p-4 space-y-2">
                  <p className="text-xs font-medium flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5" />
                    使用技巧 Tips
                  </p>
                  <ul className="text-[10px] space-y-1 opacity-80 list-disc pl-4">
                    <li>点击图中格子可快速定位色号</li>
                    <li>开启锁定模式可同时点亮多种颜色</li>
                    <li>专注模式下，非目标色将自动变暗</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Missing Bead Guide Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#a3bdb2]/40 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#a3bdb2]/30 pb-4">
            <Sparkles className="w-6 h-6 text-[#20243F]" />
            <h2 className="text-xl font-bold text-[#20243F]">缺豆指南 <span className="text-neutral-400 text-sm font-normal ml-1">Missing Bead Guide</span></h2>
          </div>
          
          <div className="flex flex-wrap gap-4 items-center min-h-[60px]">
            {!missingColorCode ? (
              <p className="text-xs text-neutral-500">点击上方色号清单中的颜色，在此查看替代方案。</p>
            ) : (
              <div className="flex items-center gap-4 bg-neutral-50 p-3 rounded-xl border border-[#a3bdb2]/20">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] opacity-60">原色 Original</span>
                  <div 
                    className="w-10 h-10 rounded shadow-md flex items-center justify-center text-[10px] font-bold"
                    style={{ 
                      backgroundColor: `rgb(${palettes[palette].find(c => c.code === missingColorCode)?.rgb.join(',')})`,
                      color: (0.299 * (palettes[palette].find(c => c.code === missingColorCode)?.rgb[0] || 0) + 0.587 * (palettes[palette].find(c => c.code === missingColorCode)?.rgb[1] || 0) + 0.114 * (palettes[palette].find(c => c.code === missingColorCode)?.rgb[2] || 0)) > 128 ? '#000' : '#fff'
                    }}
                  >
                    {missingColorCode}
                  </div>
                </div>
                
                <div className="h-8 w-px bg-[#a3bdb2]/30 mx-2" />
                
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] opacity-60">替代方案 Alternatives</span>
                  <div className="flex gap-2">
                    {(() => {
                      const currentPalette = palettes[palette];
                      const target = currentPalette.find(c => c.code === missingColorCode);
                      if (!target) return [];
                      
                      return currentPalette
                        .filter(c => c.code !== missingColorCode)
                        .map(c => ({ color: c, dist: deltaE(target.lab, c.lab) }))
                        .sort((a, b) => a.dist - b.dist)
                        .slice(0, 3)
                        .map(({ color: alt }) => (
                          <div 
                            key={alt.code}
                            className="w-10 h-10 rounded shadow-sm flex items-center justify-center text-[10px] font-bold"
                            style={{ 
                              backgroundColor: `rgb(${alt.rgb.join(',')})`,
                              color: (0.299 * alt.rgb[0] + 0.587 * alt.rgb[1] + 0.114 * alt.rgb[2]) > 128 ? '#000' : '#fff'
                            }}
                          >
                            {alt.code}
                          </div>
                        ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Hidden canvas for background rendering */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Logout Button */}
        <div className="flex justify-center pt-8">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-8 py-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-all text-sm font-medium shadow-sm hover:shadow-md"
          >
            <LogOut className="w-4 h-4" />
            退出登录 Logout
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#20243F]/5 text-neutral-900 font-sans selection:bg-[#a3bdb2]/50 selection:text-[#20243F] flex flex-col">
      {/* Header */}
      <header className="bg-[#20243F] sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#a3bdb2] rounded-lg flex items-center justify-center shadow-sm">
              <ImageIcon className="w-5 h-5 text-[#20243F]" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white">豆拼拼-图纸工厂 <span className="text-[#a3bdb2] text-base font-normal ml-2 hidden sm:inline">Perler Pattern Factory</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-[#a3bdb2] font-medium">v2.1.0</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'base' ? renderBaseTab() : activeTab === 'advanced' ? renderAdvancedTab() : renderAdminTab()}
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#a3bdb2]/30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-16 gap-4 sm:gap-12">
            <button
              onClick={() => setActiveTab('base')}
              className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${
                activeTab === 'base' 
                  ? 'text-[#20243F] border-t-2 border-[#20243F]' 
                  : 'text-neutral-400 hover:text-[#20243F]/70 border-t-2 border-transparent'
              }`}
            >
              <LayoutGrid className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">基础 Base</span>
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${
                activeTab === 'advanced' 
                  ? 'text-[#20243F] border-t-2 border-[#20243F]' 
                  : 'text-neutral-400 hover:text-[#20243F]/70 border-t-2 border-transparent'
              }`}
            >
              <Sparkles className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">高级 Advanced</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${
                  activeTab === 'admin' 
                    ? 'text-[#20243F] border-t-2 border-[#20243F]' 
                    : 'text-neutral-400 hover:text-[#20243F]/70 border-t-2 border-transparent'
                }`}
              >
                <ShieldCheck className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-medium">管理 Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
