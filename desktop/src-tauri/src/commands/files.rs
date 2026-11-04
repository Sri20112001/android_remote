use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::SystemTime;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BeamedFileInfo {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified_timestamp: u64,
}

#[tauri::command]
pub fn get_beamed_files() -> Result<Vec<BeamedFileInfo>, String> {
    let mut files = Vec::new();

    // The Go agent saves uploads to %USERPROFILE%\Downloads
    let downloads_dir = dirs_downloads().ok_or("Could not locate Downloads directory")?;

    if let Ok(entries) = fs::read_dir(&downloads_dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let path = entry.path().to_string_lossy().to_string();
                    let size_bytes = meta.len();
                    let modified_timestamp = meta
                        .modified()
                        .unwrap_or(SystemTime::UNIX_EPOCH)
                        .duration_since(SystemTime::UNIX_EPOCH)
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    files.push(BeamedFileInfo {
                        name,
                        path,
                        size_bytes,
                        modified_timestamp,
                    });
                }
            }
        }
    }

    // Sort by most recently modified
    files.sort_by(|a, b| b.modified_timestamp.cmp(&a.modified_timestamp));
    // Keep top 20
    files.truncate(20);

    Ok(files)
}

#[tauri::command]
pub fn open_file_in_explorer(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(format!("/select,{}", file_path))
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_downloads_folder() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(dir) = dirs_downloads() {
            Command::new("explorer")
                .arg(dir)
                .spawn()
                .map_err(|e| format!("Failed to open Downloads folder: {}", e))?;
        }
    }
    Ok(())
}

fn dirs_downloads() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE").map(|prof| PathBuf::from(prof).join("Downloads"))
}
