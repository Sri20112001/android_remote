use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentStatusInfo {
    pub running: bool,
    pub port: u16,
    pub host: String,
    pub executable_found: bool,
    pub executable_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PairingQRResult {
    pub pin: String,
    pub qr_payload: String,
}

/// Find the agent binary path by walking up parent directories
fn resolve_agent_path() -> Option<PathBuf> {
    let binary_names = ["remotedeck-agent.exe", "tuf-remote-agent.exe", "main.exe"];

    // 1. Check parent directories from current working directory
    if let Ok(mut current) = std::env::current_dir() {
        for _ in 0..6 {
            for bin in &binary_names {
                let candidate = current.join("agent").join("windows").join("bin").join(bin);
                if candidate.exists() && candidate.is_file() {
                    return candidate.canonicalize().ok().or(Some(candidate));
                }
            }
            if !current.pop() {
                break;
            }
        }
    }

    // 2. Check current executable's directory and parents
    if let Ok(exe) = std::env::current_exe() {
        let mut cur = exe.parent();
        while let Some(dir) = cur {
            for bin in &binary_names {
                let direct = dir.join(bin);
                if direct.exists() && direct.is_file() {
                    return direct.canonicalize().ok().or(Some(direct));
                }
                let candidate = dir.join("agent").join("windows").join("bin").join(bin);
                if candidate.exists() && candidate.is_file() {
                    return candidate.canonicalize().ok().or(Some(candidate));
                }
            }
            cur = dir.parent();
        }
    }

    // 3. Hardcoded workspace default fallbacks
    for bin in &binary_names {
        let fallback = PathBuf::from(format!("agent/windows/bin/{}", bin));
        if fallback.exists() {
            return Some(fallback);
        }
    }

    None
}

/// Checks if port 8765 is actively listening
fn is_agent_listening(port: u16) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    TcpStream::connect_timeout(
        &addr.parse().unwrap(),
        Duration::from_millis(300),
    ).is_ok()
}

/// Executes a raw HTTP request to loopback without CORS hurdles
fn loopback_http(method: &str, path: &str) -> Result<String, String> {
    let mut stream = TcpStream::connect("127.0.0.1:8765").map_err(|e| format!("Failed to connect to agent: {}", e))?;
    stream.set_read_timeout(Some(Duration::from_secs(3))).ok();

    let request = format!(
        "{} {} HTTP/1.1\r\nHost: 127.0.0.1:8765\r\nUser-Agent: RemoteDeck-Desktop\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
        method, path
    );

    stream.write_all(request.as_bytes()).map_err(|e| format!("Write error: {}", e))?;

    let mut response = String::new();
    stream.read_to_string(&mut response).map_err(|e| format!("Read error: {}", e))?;

    if let Some(pos) = response.find("\r\n\r\n") {
        Ok(response[pos + 4..].to_string())
    } else {
        Ok(response)
    }
}

#[tauri::command]
pub fn get_agent_status() -> AgentStatusInfo {
    let port = 8765;
    let running = is_agent_listening(port);
    let agent_path = resolve_agent_path();

    AgentStatusInfo {
        running,
        port,
        host: "127.0.0.1".into(),
        executable_found: agent_path.is_some(),
        executable_path: agent_path.map(|p| p.to_string_lossy().to_string()),
    }
}

#[tauri::command]
pub fn start_agent() -> Result<String, String> {
    if is_agent_listening(8765) {
        return Ok("Agent is already running on port 8765".into());
    }

    let agent_path = resolve_agent_path().ok_or_else(|| {
        "Agent executable (tuf-remote-agent.exe) not found in workspace.".to_string()
    })?;

    let work_dir = agent_path.parent().unwrap_or(Path::new("."));

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        Command::new(&agent_path)
            .current_dir(work_dir)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to spawn agent: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(&agent_path)
            .current_dir(work_dir)
            .spawn()
            .map_err(|e| format!("Failed to spawn agent: {}", e))?;
    }

    // Wait up to 2000ms for socket to become ready
    for _ in 0..20 {
        std::thread::sleep(Duration::from_millis(100));
        if is_agent_listening(8765) {
            return Ok("Agent launched successfully".into());
        }
    }

    Ok("Agent spawn command sent".into())
}

#[tauri::command]
pub fn stop_agent() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "remotedeck-agent.exe"])
            .output();
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "tuf-remote-agent.exe"])
            .output();
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "main.exe"])
            .output();
        Ok("Agent stopped successfully".into())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok("Process termination not supported on this platform".into())
    }
}

#[tauri::command]
pub fn restart_agent() -> Result<String, String> {
    let _ = stop_agent();
    std::thread::sleep(Duration::from_millis(600));
    start_agent()
}

/// Natively generates an active pairing session and returns PIN + full QR JSON
#[tauri::command]
pub fn get_pairing_session() -> Result<PairingQRResult, String> {
    // 1. Ensure agent is running
    if !is_agent_listening(8765) {
        let _ = start_agent();
        std::thread::sleep(Duration::from_millis(900));
    }

    // 2. Start pairing session via POST /api/v1/pairing/start
    let mut body_start = loopback_http("POST", "/api/v1/pairing/start")?;
    let mut start_json: serde_json::Value = serde_json::from_str(&body_start).unwrap_or_default();

    let mut pin = start_json["pin"].as_str().unwrap_or("").to_string();
    let mut session_id = start_json["session_id"].as_str().unwrap_or("").to_string();

    // If session capacity was reached or PIN is empty, restart agent to clear in-memory sessions and retry
    if pin.is_empty() || session_id.is_empty() {
        let _ = restart_agent();
        std::thread::sleep(Duration::from_millis(900));
        body_start = loopback_http("POST", "/api/v1/pairing/start")?;
        start_json = serde_json::from_str(&body_start)
            .map_err(|e| format!("Invalid start JSON ({}): {}", e, body_start))?;
        pin = start_json["pin"].as_str().unwrap_or("").to_string();
        session_id = start_json["session_id"].as_str().unwrap_or("").to_string();
    }

    if pin.is_empty() || session_id.is_empty() {
        return Err(format!("Pairing returned empty PIN: {}", body_start));
    }

    // 3. Query full discovery QR payload
    let qr_path = format!("/api/v1/discovery/qr?session_id={}&pin={}", session_id, pin);
    let body_qr = loopback_http("GET", &qr_path)?;

    Ok(PairingQRResult {
        pin,
        qr_payload: body_qr.trim().to_string(),
    })
}

#[tauri::command]
pub fn get_autostart_status() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("reg")
            .args(["query", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run", "/v", "RemoteDeck"])
            .output();
        if let Ok(out) = output {
            return out.status.success();
        }
    }
    false
}

#[tauri::command]
pub fn set_autostart(enable: bool) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if enable {
            let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let exe_str = current_exe.to_string_lossy().to_string();
            let val = format!("\"{}\"", exe_str);
            let status = Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "RemoteDeck",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &val,
                    "/f",
                ])
                .status()
                .map_err(|e| e.to_string())?;
            return Ok(status.success());
        } else {
            let _ = Command::new("reg")
                .args([
                    "delete",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "RemoteDeck",
                    "/f",
                ])
                .status();
            return Ok(false);
        }
    }
    #[cfg(not(target_os = "windows"))]
    Ok(false)
}
