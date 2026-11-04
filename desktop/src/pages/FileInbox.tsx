import React, { useEffect } from 'react';
import { Inbox, FolderOpen, ExternalLink, File, FileText, Image, Film, Music, RefreshCw } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { Card } from '../components/Card';

export const FileInbox: React.FC = () => {
  const { beamedFiles, fetchBeamedFiles, openFileInExplorer, openDownloadsFolder } = useAppStore();

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
    if (['txt', 'pdf', 'md', 'json', 'csv'].includes(ext || '')) {
      return <FileText size={20} className="text-slate-300" />;
    }
    return <File size={20} className="text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Downloads Folder Quick Access */}
      <Card
        title="LOCAL LAN FILE BEAM INBOX"
        subtitle="Files received over local Wi-Fi from the Remote Deck mobile app"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchBeamedFiles()}
              title="Refresh Files"
              className="p-1.5 rounded-lg bg-obsidian-800 border border-obsidian-700 hover:bg-obsidian-700 text-slate-300 transition-colors"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => openDownloadsFolder()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-citrus text-obsidian-950 font-semibold text-xs hover:bg-citrus-hover transition-colors"
            >
              <FolderOpen size={14} />
              <span>Open Downloads</span>
            </button>
          </div>
        }
      >
        <p className="text-xs text-slate-400">
          When you use the <strong>File Beam</strong> feature on your mobile phone, incoming documents, photos, and videos are saved directly to your workstation's <code>%USERPROFILE%\Downloads</code> folder.
        </p>
      </Card>

      {/* Files List */}
      <Card
        title="RECENT DOWNLOADS"
        subtitle="Stored in %USERPROFILE%\Downloads"
        action={
          <span className="text-xs font-mono text-slate-400">
            {beamedFiles.length} Recent Files
          </span>
        }
      >
        {beamedFiles.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Inbox size={32} className="mx-auto text-slate-600" />
            <h4 className="text-sm font-semibold text-slate-300">No files beamed yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Open the Remote Deck app on your phone, navigate to Settings, and tap "Beam File to PC" to send files directly over your local Wi-Fi.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-obsidian-800 max-h-[460px] overflow-y-auto pr-1">
            {beamedFiles.map((file) => (
              <div
                key={file.path}
                className="py-3 flex items-center justify-between hover:bg-obsidian-900/60 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-obsidian-900 border border-obsidian-800 shrink-0">
                    {getFileIcon(file.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-200 truncate">{file.name}</div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {formatFileSize(file.size_bytes)} &bull;{' '}
                      {new Date(file.modified_timestamp * 1000).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => openFileInExplorer(file.path)}
                    title="Highlight in File Explorer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-obsidian-800 border border-obsidian-700 hover:bg-obsidian-700 text-slate-300 text-xs font-medium transition-colors"
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
    </div>
  );
};
