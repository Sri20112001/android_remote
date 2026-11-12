import React, { useEffect, useRef, useState } from 'react';
import {
  Inbox,
  FolderOpen,
  ExternalLink,
  File,
  FileText,
  Image,
  Film,
  Music,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  Share2,
  Copy,
  Check,
  X,
  Smartphone,
  QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAppStore } from '../stores/useAppStore';
import { Card } from '../components/Card';
import type { BeamedFile } from '../types';

export const FileInbox: React.FC = () => {
  const {
    beamedFiles,
    fetchBeamedFiles,
    openFileInExplorer,
    openDownloadsFolder,
    addBeamedFile,
    addActivity,
    discoveryQR,
  } = useAppStore();

  const [isDragging, setIsDragging] = useState(false);
  const [recentlyDropped, setRecentlyDropped] = useState<BeamedFile[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [beamModalFile, setBeamModalFile] = useState<BeamedFile | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    fetchBeamedFiles();
  }, [fetchBeamedFiles]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getLanIp = (): string => {
    if (discoveryQR?.qr_payload) {
      try {
        const payload = JSON.parse(discoveryQR.qr_payload);
        const addrs = payload.ip_addresses || [];
        const nonLoopback = addrs.find((ip: string) => !ip.startsWith('127.') && ip !== '::1' && ip !== 'localhost');
        if (nonLoopback) return nonLoopback;
      } catch {
        // ignore
      }
    }
    return window.location.hostname || '127.0.0.1';
  };

  const getDownloadUrl = (fileName: string): string => {
    const ip = getLanIp();
    const port = 8765;
    return `http://${ip}:${port}/api/v1/files/download/${encodeURIComponent(fileName)}`;
  };

  const handleOpenBeamModal = (file: BeamedFile) => {
    setBeamModalFile(file);
    setCopiedLink(false);
    addActivity({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      category: 'file',
      message: `File Broadcast: ${file.name}`,
      detail: 'Generated local Wi-Fi download link for mobile devices',
    });
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return <Image size={20} className="text-citrus" />;
    }
    if (['mp4', 'mkv', 'avi', 'mov'].includes(ext || '')) {
      return <Film size={20} className="text-cyber-cyan" />;
    }
    if (['mp3', 'wav', 'flac', 'aac'].includes(ext || '')) {
      return <Music size={20} className="text-cyber-amber" />;
    }
    if (['txt', 'pdf', 'md', 'json', 'csv', 'docx', 'xlsx'].includes(ext || '')) {
      return <FileText size={20} className="text-slate-300" />;
    }
    return <File size={20} className="text-slate-400" />;
  };

  const handleProcessFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: BeamedFile[] = [];
    const nowSec = Math.floor(Date.now() / 1000);

    Array.from(files).forEach((file) => {
      const beamedItem: BeamedFile = {
        name: file.name,
        path: `Downloads\\${file.name}`,
        size_bytes: file.size,
        modified_timestamp: nowSec,
      };
      newFiles.push(beamedItem);
      addBeamedFile(beamedItem);

      addActivity({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        category: 'file',
        message: `File Beamed: ${file.name}`,
        detail: `${formatFileSize(file.size)} • Ready for mobile devices`,
      });
    });

    setRecentlyDropped((prev) => [...newFiles, ...prev].slice(0, 5));
    setSuccessMessage(`${newFiles.length} file(s) staged for local beam!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleProcessFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* 1. Interactive Drag-and-Drop File Beaming Zone (Cult UI / Motion Primitives style) */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`group relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
          isDragging
            ? 'scale-[1.01] border-citrus bg-citrus/10 shadow-[0_0_30px_rgba(202,243,0,0.18)]'
            : 'border-white/[0.14] bg-[#0B0F17]/80 hover:border-citrus/40 hover:bg-[#0B0F17]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Ambient indicator */}
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-300 ${
            isDragging
              ? 'scale-110 border-citrus bg-citrus/20 text-citrus shadow-[0_0_20px_rgba(202,243,0,0.4)]'
              : 'border-white/[0.08] bg-white/[0.03] text-slate-300 group-hover:border-citrus/30 group-hover:text-citrus'
          }`}
        >
          <UploadCloud size={30} className={isDragging ? 'animate-bounce' : ''} />
        </div>

        <h3 className="mt-4 text-base font-bold text-slate-100 sm:text-lg">
          {isDragging ? 'Release to Beam Files Now' : 'Drag & Drop Files to Beam to Phone'}
        </h3>

        <p className="mt-1.5 max-w-md text-xs leading-5 text-slate-400">
          Drop any photos, documents, videos, or archives from your PC. Files are stored locally in
          your Downloads directory and beamed over local Wi-Fi to your paired mobile app.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-citrus px-5 py-2.5 text-xs font-bold text-obsidian-950 shadow-md shadow-citrus/20 transition-all hover:bg-citrus-hover active:scale-95"
          >
            <UploadCloud size={15} />
            <span>Browse & Drop Files</span>
          </button>

          <button
            onClick={() => openDownloadsFolder()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-white/[0.16] hover:text-white"
          >
            <FolderOpen size={14} />
            <span>Open Downloads</span>
          </button>
        </div>

        {/* Success toast notification if just dropped */}
        {successMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-citrus/40 bg-citrus/15 px-3.5 py-1.5 font-mono text-xs font-semibold text-citrus shadow-lg animate-in fade-in duration-200">
            <CheckCircle2 size={15} />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* 2. Recently Dropped Staged Files Queue (if any) */}
      {recentlyDropped.length > 0 && (
        <Card
          title="JUST DROPPED FOR BEAM"
          subtitle="Files ready on local link"
          accentColor="citrus"
        >
          <div className="space-y-2">
            {recentlyDropped.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-citrus/20 bg-citrus/[0.04] p-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-citrus/10 text-citrus shrink-0">
                    {getFileIcon(file.name)}
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-200 truncate block">{file.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {formatFileSize(file.size_bytes)} • Ready for mobile
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenBeamModal(file)}
                    className="flex items-center gap-1.5 rounded-lg border border-citrus/30 bg-citrus/15 px-2.5 py-1 text-[11px] font-bold text-citrus transition-all hover:bg-citrus/25 active:scale-95"
                  >
                    <QrCode size={12} />
                    <span>Beam to Phone</span>
                  </button>
                  <span className="flex items-center gap-1 rounded-full border border-citrus/30 bg-citrus/15 px-2 py-0.5 font-mono text-[9px] font-bold text-citrus">
                    <Sparkles size={10} />
                    <span>STAGED</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 3. Received Downloads / Beamed Files List */}
      <Card
        title="BEAMED DOWNLOADS & FILES"
        subtitle="Stored in %USERPROFILE%\Downloads"
        action={
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400">
              {beamedFiles.length} Recent File{beamedFiles.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={() => fetchBeamedFiles()}
              title="Refresh Files"
              className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        }
      >
        {beamedFiles.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Inbox size={32} className="mx-auto text-slate-600" />
            <h4 className="text-sm font-semibold text-slate-300">No files beamed yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Drop files in the dropzone above or send files from your phone's File Beam tool to
              transfer over local Wi-Fi.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06] max-h-[460px] overflow-y-auto pr-1">
            {beamedFiles.map((file) => (
              <div
                key={file.path}
                className="py-3 flex items-center justify-between hover:bg-white/[0.03] px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.07] shrink-0">
                    {getFileIcon(file.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-200 truncate">{file.name}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {formatFileSize(file.size_bytes)} •{' '}
                      {new Date(file.modified_timestamp * 1000).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => handleOpenBeamModal(file)}
                    title="Beam / Share to Mobile"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-citrus/30 bg-citrus/10 hover:bg-citrus/20 text-citrus text-xs font-semibold transition-colors"
                  >
                    <Share2 size={13} />
                    <span>Beam to Phone</span>
                  </button>
                  <button
                    onClick={() => openFileInExplorer(file.path)}
                    title="Highlight in File Explorer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] hover:text-white text-slate-300 text-xs font-medium transition-colors"
                  >
                    <ExternalLink size={13} />
                    <span>Show in Folder</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 4. Beam to Mobile Modal Overlay */}
      {beamModalFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl border border-citrus/30 bg-[#0E121B] p-6 shadow-2xl shadow-black/80">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-citrus/30 bg-citrus/15 text-citrus">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
                    Beam File Over Local Wi-Fi
                  </h3>
                  <p className="text-xs text-slate-400">Direct streaming from PC to connected mobile app</p>
                </div>
              </div>
              <button
                onClick={() => setBeamModalFile(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* QR Code Presentation */}
            <div className="my-6 flex flex-col items-center justify-center">
              <div className="rounded-2xl border-4 border-obsidian-800 bg-white p-4 shadow-xl">
                <QRCodeSVG
                  value={getDownloadUrl(beamModalFile.name)}
                  size={190}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="mt-4 text-center">
                <div className="font-semibold text-slate-200 text-sm">{beamModalFile.name}</div>
                <div className="font-mono text-xs text-citrus mt-0.5">
                  {formatFileSize(beamModalFile.size_bytes)} • Ready on Local Link
                </div>
              </div>
            </div>

            {/* Direct URL Box */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                Wi-Fi Direct Download Link
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#07090E] p-2">
                <input
                  type="text"
                  readOnly
                  value={getDownloadUrl(beamModalFile.name)}
                  className="flex-1 bg-transparent px-2 text-xs font-mono text-slate-300 outline-none select-all"
                />
                <button
                  onClick={() => handleCopyLink(getDownloadUrl(beamModalFile.name))}
                  className="flex items-center gap-1.5 rounded-lg bg-citrus px-3 py-1.5 text-xs font-bold text-obsidian-950 transition-colors hover:bg-citrus-hover"
                >
                  {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Instructions */}
            <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
              Point your connected phone camera at this QR code or open the link on your mobile browser to download instantly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

