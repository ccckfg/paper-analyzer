use serde::{Deserialize, Serialize};

/// 网络图节点
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkNode {
    pub id: String,
    pub label: String,
    pub title: String,
    pub value: u32,
    pub color: String,
    pub is_core: bool,
}

/// 网络图边
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkEdge {
    pub from: String,
    pub to: String,
}

/// 完整网络数据（传给前端 vis-network）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkData {
    pub nodes: Vec<NetworkNode>,
    pub edges: Vec<NetworkEdge>,
}
