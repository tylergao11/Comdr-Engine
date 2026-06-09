use serde::{Deserialize,Serialize};
use std::sync::Mutex;

#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecEvent{
    pub schema:String,
    pub seq:u64,
    pub kind:String,
    pub round:u64,
    #[serde(skip_serializing_if="Option::is_none")]
    pub index:Option<u64>,
    #[serde(default)]
    pub command:Option<serde_json::Value>,
    #[serde(default)]
    pub result:Option<serde_json::Value>,
    #[serde(skip_serializing_if="Option::is_none")]
    pub elapsed_ms:Option<u64>,
    #[serde(skip_serializing_if="Option::is_none")]
    pub total_rounds:Option<u64>,
    #[serde(skip_serializing_if="Option::is_none")]
    pub status:Option<String>,
    #[serde(skip_serializing_if="Option::is_none")]
    pub error:Option<String>,
    #[serde(skip_serializing_if="Option::is_none")]
    pub message:Option<String>,
    pub timestamp:String,
}

pub struct ExecLogState{pub cursor:Mutex<u64>}

impl ExecLogState{
    pub fn with_cursor_at_end(_project_path:&str)->Self{
        Self{cursor:Mutex::new(0)}
    }
}

#[tauri::command]
pub fn poll_execution_log(state:tauri::State<'_,crate::AppState>)->Vec<ExecEvent>{
    let pp=state.config.lock().unwrap().effective_project_path();
    if pp.is_empty(){return vec![];}

    let log_path=format!("{pp}/{}/execution-log.jsonl",crate::config::PROJ_DIR);
    let raw=match std::fs::read_to_string(&log_path){Ok(s)=>s,Err(_)=>return vec![]};

    let mut cur=state.exec_log.cursor.lock().unwrap();
    if *cur>raw.len() as u64{*cur=raw.len() as u64;}

    let slice=&raw[*cur as usize..];
    *cur=raw.len() as u64;
    if slice.is_empty(){return vec![];}

    slice.lines()
        .filter_map(|l|serde_json::from_str(l.trim()).ok())
        .collect()
}
