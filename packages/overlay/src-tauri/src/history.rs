use serde::{Deserialize,Serialize};use std::fs;use std::path::PathBuf;use crate::config;
#[derive(Debug,Clone,Serialize,Deserialize)]pub struct Entry{pub id:String,pub text:String,pub summary:String,pub elapsed:Option<u64>,pub status:String,pub error:Option<String>,pub timestamp:u64}
#[derive(Serialize,Deserialize)]struct File{entries:Vec<Entry>}
pub struct History{entries:Vec<Entry>}
impl History{
    pub fn new()->Self{let e=fs::read_to_string(&hp()).ok().and_then(|s|serde_json::from_str::<File>(&s).ok()).map(|f|f.entries).unwrap_or_default();Self{entries:e}}
    pub fn recent(&self,limit:usize)->Vec<Entry>{let n=limit.min(self.entries.len());self.entries[self.entries.len()-n..].to_vec()}
}
fn hp()->PathBuf{config::config_dir().join("history.json")}
