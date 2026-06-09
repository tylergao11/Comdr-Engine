mod config;mod history;mod execution_log;

use config::OverlayConfig;use history::History;
use serde::{Deserialize,Serialize};use std::sync::Mutex;
use tauri::{Emitter,menu::{Menu,MenuItem},tray::{MouseButton,MouseButtonState,TrayIconBuilder,TrayIconEvent},Manager,State,WebviewWindow};

const SNAP_TOP: i32 = 25;
const UNSNAP_TOP: i32 = SNAP_TOP + 40;
const COLLAPSED_H: f64 = 32.0;
const FULL_W: f64 = 380.0;
const FULL_H: f64 = 240.0;

struct SnapData{pub collapsed:bool}
struct AppState{history:Mutex<History>,config:Mutex<OverlayConfig>,exec_log:execution_log::ExecLogState,snap:Mutex<SnapData>}

fn write_alive(){
    let dir=config::config_dir();
    let _=std::fs::create_dir_all(&dir);
    let ts=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d|d.as_millis() as u64).unwrap_or(0);
    let _=std::fs::write(dir.join("overlay-alive"),ts.to_string());
}

fn read_tokens(pp:&str)->Option<TokenInfo>{
    std::fs::read_to_string(format!("{pp}/{}/latest-tokens.json",config::PROJ_DIR))
        .ok().and_then(|s|serde_json::from_str::<TokenInfo>(&s).ok())
}

#[tauri::command]
fn bridge_alive(pp:&str)->bool{
    if let Ok(raw)=std::fs::read_to_string(format!("{pp}/{}/bridge.json",config::PROJ_DIR)){
        if let Ok(d)=serde_json::from_str::<serde_json::Value>(&raw){
            if let Some(ts)=d.get("updatedAt").and_then(|v|v.as_str()){
                if let Ok(t)=chrono::DateTime::parse_from_rfc3339(ts){
                    let age=std::time::SystemTime::now().duration_since(t.into()).map(|d|d.as_secs()).unwrap_or(999);
                    return age<3;
                }
            }
        }
    }
    false
}

#[tauri::command]
fn heartbeat(state:State<'_,AppState>)->HbResp{
    write_alive();
    let pp=state.config.lock().unwrap().effective_project_path();
    if pp.is_empty(){return HbResp{mcp_online:true,bridge_online:false,current_doc:None,schema_version:None,tokens:None};}
    let tokens=read_tokens(&pp);
    let online=bridge_alive(&pp);
    if online{
        if let Ok(raw)=std::fs::read_to_string(format!("{pp}/{}/bridge.json",config::PROJ_DIR)){
            if let Ok(d)=serde_json::from_str::<serde_json::Value>(&raw){return HbResp{mcp_online:true,bridge_online:true,current_doc:d["openDocument"]["path"].as_str().map(|s|s.to_string()),schema_version:d["editorCapabilities"]["componentSchema"]["source"].as_str().map(|s|s.to_string()),tokens};}
        }
    }
    HbResp{mcp_online:true,bridge_online:false,current_doc:None,schema_version:None,tokens}
}

#[tauri::command]fn load_history(state:State<'_,AppState>)->Vec<history::Entry>{state.history.lock().unwrap().recent(20).to_vec()}
#[tauri::command]fn load_config(state:State<'_,AppState>)->OverlayConfig{state.config.lock().unwrap().clone()}
#[tauri::command]fn save_config(nc:OverlayConfig,state:State<'_,AppState>)->Result<(),String>{let mut c=state.config.lock().unwrap();*c=nc;c.save()}
#[derive(Debug,Serialize)]struct Layout{pub full_w:f64,pub full_h:f64,pub collapsed_h:f64,pub snap_top:i32}
#[tauri::command]fn get_layout()->Layout{Layout{full_w:FULL_W,full_h:FULL_H,collapsed_h:COLLAPSED_H,snap_top:SNAP_TOP}}
#[tauri::command]fn resize_window(w:WebviewWindow,width:u32,height:u32){let _=w.set_size(tauri::Size::Logical(tauri::LogicalSize{width:width as f64,height:height as f64}));}
#[tauri::command]
fn request_undo(state:State<'_,AppState>,count:Option<u32>)->Result<(),String>{
    let pp=state.config.lock().unwrap().effective_project_path();
    if pp.is_empty(){return Err("No project path configured".into());}
    let inbox=std::path::PathBuf::from(&pp).join(config::PROJ_DIR).join("inbox");
    std::fs::create_dir_all(&inbox).map_err(|e|format!("{e}"))?;
    let ts=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d|d.as_millis() as u64).unwrap_or(0);
    let id=format!("undo-{ts}");
    let n=count.unwrap_or(1);
    let req=serde_json::json!({"schema":"Comdr.cocos-task-request.v1","id":id,"taskCard":{"type":"undo","payload":{"count":n}},"createdAt":chrono::Utc::now().to_rfc3339()});
    let task_path=inbox.join(format!("{id}.json"));
    let tmp=format!("{}.tmp.{}",task_path.display(),ts);
    std::fs::write(&tmp,serde_json::to_string_pretty(&req).unwrap()).map_err(|e|format!("{e}"))?;
    std::fs::rename(&tmp,&task_path).or_else(|_|std::fs::write(&task_path,serde_json::to_string_pretty(&req).unwrap()).map_err(|e|format!("{e}")))?;
    Ok(())
}

#[derive(Debug,Serialize,Deserialize)]struct HbResp{mcp_online:bool,bridge_online:bool,current_doc:Option<String>,schema_version:Option<String>,tokens:Option<TokenInfo>}
#[derive(Debug,Serialize,Deserialize)]#[serde(rename_all="camelCase")]struct TokenInfo{prompt_tokens:u64,completion_tokens:u64,cache_hit_tokens:Option<u64>,cache_miss_tokens:Option<u64>,round:u64}
pub fn run(){
    let cfg=OverlayConfig::load();
    let pp=cfg.project_path.clone();
    tauri::Builder::default().plugin(tauri_plugin_shell::init())
        .manage(AppState{history:Mutex::new(History::new()),config:Mutex::new(cfg),exec_log:execution_log::ExecLogState::with_cursor_at_end(&pp),snap:Mutex::new(SnapData{collapsed:false})})
        .setup(|app|{
            let tgl=MenuItem::with_id(app,"tgl","显示/隐藏",true,None::<&str>)?;
            let q=MenuItem::with_id(app,"q","退出",true,None::<&str>)?;
            let _=TrayIconBuilder::new().menu(&Menu::with_items(app,&[&tgl,&q])?)
                .on_menu_event(|a,e|match e.id.as_ref(){"tgl"=>{if let Some(w)=a.get_webview_window("main"){let _=w.hide();}}"q"=>a.exit(0),_=>{}})
                .on_tray_icon_event(|tr,ev|if let TrayIconEvent::Click{button:MouseButton::Left,button_state:MouseButtonState::Up,..}=ev{if let Some(w)=tr.app_handle().get_webview_window("main"){if let Ok(Some(m)) = w.primary_monitor(){let s=m.size();let sf=m.scale_factor();let x=(s.width as f64/sf)-FULL_W-20.0;let y=(s.height as f64/sf)-FULL_H-80.0;let _=w.set_position(tauri::PhysicalPosition::new(x as i32,y as i32));}let _=w.show();let _=w.unminimize();let _=w.set_focus();}})
                .build(app)?;
            if let Some(w)=app.get_webview_window("main"){let _=w.set_maximizable(false);let _=w.set_ignore_cursor_events(false);}
            // 窗口移动 → 顶部吸附
            if let Some(w)=app.get_webview_window("main"){
                let ah=app.handle().clone();
                w.on_window_event(move |ev|{
                    use tauri::WindowEvent;
                    if let WindowEvent::Moved(p)=ev{
                        if let Some(m)=ah.get_webview_window("main").and_then(|w|w.primary_monitor().ok()).flatten(){
                            let sf=m.scale_factor();
                            let st=ah.state::<AppState>();
                            let mut sd=st.snap.lock().unwrap();
                            let y_px=(p.y as f64*sf) as i32;
                            if y_px<=SNAP_TOP && !sd.collapsed{
                                sd.collapsed=true;
                                let _=ah.get_webview_window("main").map(|w|{let _=w.set_size(tauri::Size::Logical(tauri::LogicalSize{width:FULL_W,height:COLLAPSED_H}));let _=w.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(p.x,0)));w});
                                let _=ah.emit("snap-changed",serde_json::json!({"collapsed":true}));
                            }else if y_px>UNSNAP_TOP && sd.collapsed{
                                sd.collapsed=false;
                                let _=ah.get_webview_window("main").map(|w|{let _=w.set_size(tauri::Size::Logical(tauri::LogicalSize{width:FULL_W,height:FULL_H}));w});
                                let _=ah.emit("snap-changed",serde_json::json!({"collapsed":false}));
                            }
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![heartbeat,load_history,load_config,save_config,resize_window,get_layout,request_undo,execution_log::poll_execution_log])
        .run(tauri::generate_context!()).expect("run");
}
