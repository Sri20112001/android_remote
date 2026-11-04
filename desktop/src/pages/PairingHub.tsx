import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, RefreshCw, Smartphone, Trash2, Play, AlertCircle } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { Card } from '../components/Card';

export const PairingHub: React.FC = () => {
  const {
    discoveryQR,
    pairedDevices,
    fetchPairingData,
    revokeDevice,
    isLoadingPairing,
    agentStatus,
    startAgent,
    isStartingAgent,
  } = useAppStore();

  const [copied, setCopied] = useState(false);
  const [pin, setPin] = useState<string>('------');

  useEffect(() => {
    fetchPairingData();
  }, [fetchPairingData]);

  useEffect(() => {
    if (discoveryQR?.pin) {
      setPin(discoveryQR.pin);
    }
  }, [discoveryQR]);

  const handleCopyPin = () => {
    if (pin && pin !== '------') {
      navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegeneratePin = async () => {
    await fetchPairingData(true);
  };

  const qrValue = discoveryQR?.qr_payload || '';

  return (
    <div className="space-y-6">
      {/* If host daemon is offline */}
      {!agentStatus.running && (
        <div className="p-4 rounded-xl bg-cyber-amber/10 border border-cyber-amber/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-cyber-amber shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-slate-100">Host Daemon is Currently Stopped</h4>
              <p className="text-xs text-slate-400">
                The local agent must be running to generate a dynamic pairing code and accept connections.
              </p>
            </div>
          </div>
          <button
            onClick={() => startAgent()}
            disabled={isStartingAgent}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-citrus text-obsidian-950 font-bold text-xs hover:bg-citrus-hover transition-colors shadow-md disabled:opacity-50 shrink-0"
          >
            <Play size={14} fill="currentColor" />
            <span>{isStartingAgent ? 'Starting...' : 'Start Daemon'}</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: QR Code & PIN Display */}
        <div className="lg:col-span-5 space-y-4">
          <Card
            title="DEVICE PAIRING CODE"
            subtitle="Scan with Remote Deck mobile app camera"
            action={
              <button
                onClick={handleRegeneratePin}
                disabled={isLoadingPairing || !agentStatus.running}
                title="Regenerate Pairing PIN"
                className="p-1.5 rounded-lg bg-obsidian-800 border border-obsidian-700 hover:bg-obsidian-700 text-slate-300 transition-colors disabled:opacity-40"
              >
                <RefreshCw size={14} className={isLoadingPairing ? 'animate-spin' : ''} />
              </button>
            }
          >
            <div className="flex flex-col items-center justify-center p-4">
              {/* Dynamic QR Code Canvas */}
              {qrValue ? (
                <div className="bg-white p-4 rounded-2xl shadow-xl shadow-black/40 border-4 border-obsidian-800">
                  <QRCodeSVG value={qrValue} size={190} level="M" includeMargin={false} />
                </div>
              ) : (
                <div className="w-52 h-52 rounded-2xl border-2 border-dashed border-obsidian-700 bg-obsidian-900 flex flex-col items-center justify-center p-4 text-center">
                  {isLoadingPairing ? (
                    <>
                      <RefreshCw size={24} className="text-citrus animate-spin mb-2" />
                      <span className="text-xs text-slate-400">Generating pairing session...</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={24} className="text-slate-500 mb-2" />
                      <span className="text-xs text-slate-400 mb-3">No active pairing session</span>
                      <button
                        onClick={handleRegeneratePin}
                        className="px-3 py-1.5 rounded-lg bg-citrus text-obsidian-950 font-bold text-xs hover:bg-citrus-hover transition-colors"
                      >
                        Generate Code
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* 6-Digit PIN Display */}
              <div className="mt-6 text-center w-full">
                <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                  MANUAL 6-DIGIT PAIRING PIN
                </span>
                <div className="mt-2.5 flex items-center justify-center gap-3">
                  <div className="bg-obsidian-950/90 border border-citrus/40 px-6 py-2.5 rounded-2xl shadow-[0_0_20px_rgba(202,243,0,0.15)] flex items-center justify-center">
                    <span className="text-2xl sm:text-3xl font-black font-mono tracking-[0.35em] text-citrus drop-shadow-[0_0_8px_rgba(202,243,0,0.5)]">
                      {pin}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyPin}
                    className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-citrus/40 hover:bg-citrus/15 text-slate-300 hover:text-citrus transition-all duration-200 active:scale-95 shadow-lg"
                    title="Copy PIN"
                  >
                    {copied ? <Check size={18} className="text-citrus" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Pairing Instructions & Authorized Devices */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Setup Instructions */}
          <Card title="QUICK CONNECTION GUIDE" subtitle="Seamless 3-step setup">
            <ol className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-obsidian-800 border border-obsidian-700 flex items-center justify-center text-xs font-mono font-bold text-citrus shrink-0 mt-0.5">
                  1
                </span>
                <span>Connect your phone and PC to the <strong>same local Wi-Fi network</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-obsidian-800 border border-obsidian-700 flex items-center justify-center text-xs font-mono font-bold text-citrus shrink-0 mt-0.5">
                  2
                </span>
                <span>Open the <strong>Remote Deck</strong> mobile app and tap <strong>Scan QR</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-obsidian-800 border border-obsidian-700 flex items-center justify-center text-xs font-mono font-bold text-citrus shrink-0 mt-0.5">
                  3
                </span>
                <span>Point your phone camera at the QR code on the left to pair instantly.</span>
              </li>
            </ol>
          </Card>

          {/* Paired Devices List */}
          <Card
            title="AUTHORIZED DEVICES"
            subtitle="Mobile phones paired with this workstation"
            action={
              <span className="text-xs font-mono text-slate-400">
                {pairedDevices.length} Connected
              </span>
            }
          >
            {pairedDevices.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                No mobile devices have been paired yet. Scan the QR code to link your phone.
              </div>
            ) : (
              <div className="space-y-2">
                {pairedDevices.map((device) => (
                  <div
                    key={device.id}
                    className="p-3 rounded-lg bg-obsidian-900 border border-obsidian-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-citrus/10 text-citrus border border-citrus/20">
                        <Smartphone size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200 text-sm">{device.name}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          ID: {device.id} &bull; Paired {new Date(device.paired_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => revokeDevice(device.id)}
                      className="px-3 py-1.5 rounded-lg bg-cyber-crimson/10 border border-cyber-crimson/30 text-cyber-crimson hover:bg-cyber-crimson/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>Revoke</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
