use serde::{Deserialize,Serialize};use std::fs;use std::path::PathBuf;

pub const CONFIG_DIR:&str=".comdr";
pub const PROJ_DIR:&str="temp/comdr";

fn home_dir()->PathBuf{dirs::home_dir().unwrap_or_else(||PathBuf::from("."))}
pub fn config_dir()->PathBuf{home_dir().join(CONFIG_DIR)}
#[derive(Debug,Clone,Serialize,Deserialize)]
pub struct OverlayConfig{
    #[serde(default="de")]pub dock_edge:String,
    #[serde(default)]pub auto_fold:bool,
    #[serde(default="dd")]pub auto_fold_delay_ms:u64,
    #[serde(default)]pub project_path:String,
}
fn de()->String{"right".into()}fn dd()->u64{3000}
impl Default for OverlayConfig{fn default()->Self{Self{dock_edge:de(),auto_fold:false,auto_fold_delay_ms:dd(),project_path:String::new()}}}
impl OverlayConfig{
    pub fn load()->Self{let p=cp();if let Ok(r)=fs::read_to_string(&p){if let Ok(c)=serde_json::from_str(&r){return c;}}let d=Self::default();let _=d.save();d}
    pub fn save(&self)->Result<(),String>{let p=cp();if let Some(pp)=p.parent(){fs::create_dir_all(pp).map_err(|e|format!("{e}"))?;}fs::write(&p,serde_json::to_string_pretty(self).unwrap()).map_err(|e|format!("{e}"))}
    pub fn effective_project_path(&mut self)->String{if self.project_path.is_empty(){if let Ok(raw)=std::fs::read_to_string(&cp()){if let Ok(c)=serde_json::from_str::<OverlayConfig>(&raw){self.project_path=c.project_path;}}}self.project_path.clone()}
}
fn cp()->PathBuf{config_dir().join("overlay-config.json")}
