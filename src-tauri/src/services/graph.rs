use crate::models::network::{NetworkData, NetworkEdge, NetworkNode};
use crate::models::paper::{CorePaper, Paper};
use std::collections::{HashMap, HashSet};

/// 从论文列表构建引用网络数据
pub fn build_network(papers: &[Paper]) -> NetworkData {
    if papers.is_empty() {
        return NetworkData {
            nodes: Vec::new(),
            edges: Vec::new(),
        };
    }

    let pmid_set: HashSet<&str> = papers.iter().map(|p| p.pmid.as_str()).collect();

    // `references` 字段当前承载的是 cited-by PMID 列表：
    // for each paper P, paper.references = [papers that cite P].
    // 因此边方向应为 citing -> cited。
    let mut in_degree: HashMap<String, u32> = HashMap::new();
    let mut edge_pairs: HashSet<(String, String)> = HashSet::new();

    for paper in papers {
        for citing_pmid in &paper.references {
            if citing_pmid == &paper.pmid || !pmid_set.contains(citing_pmid.as_str()) {
                continue;
            }

            if edge_pairs.insert((citing_pmid.clone(), paper.pmid.clone())) {
                *in_degree.entry(paper.pmid.clone()).or_insert(0) += 1;
            }
        }
    }

    let max_network_cited = in_degree.values().copied().max().unwrap_or(1).max(1);
    let max_pubmed_cited = papers
        .iter()
        .map(|p| p.citation_count)
        .max()
        .unwrap_or(1)
        .max(1);

    let core_pmids: HashSet<String> = find_core_papers(papers, 10)
        .into_iter()
        .map(|p| p.pmid)
        .collect();

    let mut edges: Vec<NetworkEdge> = edge_pairs
        .into_iter()
        .map(|(from, to)| NetworkEdge { from, to })
        .collect();
    edges.sort_by(|a, b| a.from.cmp(&b.from).then(a.to.cmp(&b.to)));

    // 构建节点：综合使用 PubMed 被引次数 + 结果集内被引次数来决定视觉大小
    let nodes: Vec<NetworkNode> = papers
        .iter()
        .map(|p| {
            let local_in = in_degree.get(&p.pmid).copied().unwrap_or(0);
            let is_core = core_pmids.contains(&p.pmid);
            let short_title = shorten_title(&p.title, 40);

            let pubmed_ratio = p.citation_count as f64 / max_pubmed_cited as f64;
            let local_ratio = local_in as f64 / max_network_cited as f64;
            let visual_score = pubmed_ratio * 0.7 + local_ratio * 0.3;
            let value = (8.0 + visual_score * 28.0).round() as u32;

            NetworkNode {
                id: p.pmid.clone(),
                label: short_title,
                title: format!(
                    "{}\n{} ({})\nPubMed Cited: {}\nIn-Result Cited: {}",
                    p.title, p.journal, p.year, p.citation_count, local_in
                ),
                value,
                color: if is_core {
                    "#ef4444".to_string()
                } else {
                    "#6b7280".to_string()
                },
                is_core,
            }
        })
        .collect();

    NetworkData { nodes, edges }
}

/// 计算 Top N 核心论文
pub fn find_core_papers(papers: &[Paper], top_n: usize) -> Vec<CorePaper> {
    if papers.is_empty() || top_n == 0 {
        return Vec::new();
    }

    let pmid_set: HashSet<&str> = papers.iter().map(|p| p.pmid.as_str()).collect();

    // 计算每篇论文在当前结果集中被其他论文引用的次数（入度）
    let mut in_degree: HashMap<String, u32> = HashMap::new();
    let total_nodes = papers.len() as f64;

    for paper in papers {
        for citing_pmid in &paper.references {
            if citing_pmid != &paper.pmid && pmid_set.contains(citing_pmid.as_str()) {
                *in_degree.entry(paper.pmid.clone()).or_insert(0) += 1;
            }
        }
    }

    let mut scored: Vec<(&Paper, f64, f64)> = papers
        .iter()
        .map(|p| {
            let degree = in_degree.get(&p.pmid).copied().unwrap_or(0) as f64;
            let centrality = if total_nodes > 1.0 {
                degree / (total_nodes - 1.0)
            } else {
                0.0
            };

            // 综合分 = PubMed 被引次数 * 0.75 + 结果集网络中心性 * 0.25
            let score = p.citation_count as f64 * 0.75 + centrality * 100.0 * 0.25;
            (p, score, centrality)
        })
        .collect();

    scored.sort_by(|a, b| {
        b.1.partial_cmp(&a.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| b.0.citation_count.cmp(&a.0.citation_count))
    });

    scored
        .iter()
        .take(top_n.min(scored.len()))
        .enumerate()
        .map(|(i, (p, score, centrality))| CorePaper {
            pmid: p.pmid.clone(),
            title: p.title.clone(),
            journal: p.journal.clone(),
            year: p.year.clone(),
            citation_score: *score,
            degree_centrality: *centrality,
            rank: (i + 1) as u32,
        })
        .collect()
}

fn shorten_title(title: &str, max_chars: usize) -> String {
    let chars: Vec<char> = title.chars().collect();
    if chars.len() > max_chars {
        format!(
            "{}...",
            chars.into_iter().take(max_chars).collect::<String>()
        )
    } else {
        title.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::{build_network, find_core_papers};
    use crate::models::paper::Paper;

    fn paper(pmid: &str, citation_count: u32, cited_by: &[&str]) -> Paper {
        Paper {
            pmid: pmid.to_string(),
            title: format!("Paper {}", pmid),
            journal: "Test Journal".to_string(),
            year: "2024".to_string(),
            authors: vec!["Author A".to_string()],
            abstract_text: "abstract".to_string(),
            citation_count,
            references: cited_by.iter().map(|s| s.to_string()).collect(),
        }
    }

    #[test]
    fn build_network_uses_citing_to_cited_direction() {
        let papers = vec![paper("A", 50, &["B"]), paper("B", 5, &[])];
        let network = build_network(&papers);

        assert_eq!(network.edges.len(), 1);
        assert_eq!(network.edges[0].from, "B");
        assert_eq!(network.edges[0].to, "A");
    }

    #[test]
    fn find_core_papers_returns_requested_top_n() {
        let papers: Vec<Paper> = (0..12)
            .map(|i| paper(&format!("P{}", i), 100 - i, &[]))
            .collect();

        let core = find_core_papers(&papers, 10);
        assert_eq!(core.len(), 10);
        assert_eq!(core[0].rank, 1);
        assert_eq!(core[9].rank, 10);
    }
}
