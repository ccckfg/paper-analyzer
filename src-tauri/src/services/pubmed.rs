use crate::models::paper::{Paper, PaperSummary};
use quick_xml::events::Event;
use quick_xml::Reader;

const ESEARCH_URL: &str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const EFETCH_URL: &str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

/// 搜索 PubMed 获取指定关键词的 PMID 列表
pub async fn search_pmids(query: &str, max_results: u32) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let params = [
        ("db", "pubmed"),
        ("term", query),
        ("retmax", &max_results.to_string()),
        ("retmode", "xml"),
        ("sort", "relevance"),
    ];

    let resp = client
        .get(ESEARCH_URL)
        .query(&params)
        .send()
        .await
        .map_err(|e| format!("PubMed search request failed: {}", e))?;

    let body = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    parse_esearch_ids(&body)
}

/// 解析 esearch XML 提取 PMID 列表
fn parse_esearch_ids(xml: &str) -> Result<Vec<String>, String> {
    let mut reader = Reader::from_str(xml);
    let mut ids = Vec::new();
    let mut in_id = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) if e.name().as_ref() == b"Id" => {
                in_id = true;
            }
            Ok(Event::Text(e)) if in_id => {
                let text = e.unescape().map_err(|e| e.to_string())?;
                ids.push(text.to_string());
                in_id = false;
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("XML parse error: {}", e)),
            _ => {}
        }
    }

    Ok(ids)
}

/// 批量获取论文详细信息
pub async fn fetch_papers(pmids: &[String]) -> Result<Vec<Paper>, String> {
    if pmids.is_empty() {
        return Ok(Vec::new());
    }

    let client = reqwest::Client::new();
    let id_list = pmids.join(",");
    let params = [
        ("db", "pubmed"),
        ("id", &id_list),
        ("retmode", "xml"),
        ("rettype", "full"),
    ];

    let resp = client
        .get(EFETCH_URL)
        .query(&params)
        .send()
        .await
        .map_err(|e| format!("PubMed fetch request failed: {}", e))?;

    let body = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read fetch response: {}", e))?;

    parse_efetch_papers(&body)
}

/// 解析 efetch XML 提取论文信息
fn parse_efetch_papers(xml: &str) -> Result<Vec<Paper>, String> {
    let mut reader = Reader::from_str(xml);
    let mut papers = Vec::new();

    let mut current_paper: Option<PaperBuilder> = None;
    let mut current_tag = String::new();
    let mut in_author = false;
    let mut author_last = String::new();
    let mut author_fore = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                current_tag = tag.clone();
                match tag.as_str() {
                    "PubmedArticle" => {
                        current_paper = Some(PaperBuilder::default());
                    }
                    "Author" => {
                        in_author = true;
                        author_last.clear();
                        author_fore.clear();
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(e)) => {
                let text = e.unescape().map_err(|e| e.to_string())?.to_string();
                if let Some(ref mut paper) = current_paper {
                    match current_tag.as_str() {
                        "PMID" if paper.pmid.is_empty() => paper.pmid = text,
                        "ArticleTitle" => paper.title.push_str(&text),
                        "Title" if paper.journal.is_empty() => paper.journal = text,
                        "Year" if paper.year.is_empty() => paper.year = text,
                        "AbstractText" => paper.abstract_text.push_str(&text),
                        "LastName" if in_author => author_last = text,
                        "ForeName" if in_author => author_fore = text,
                        _ => {}
                    }
                }
            }
            Ok(Event::End(e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "Author" => {
                        if in_author {
                            if let Some(ref mut paper) = current_paper {
                                let name = format!("{} {}", author_fore, author_last)
                                    .trim()
                                    .to_string();
                                if !name.is_empty() {
                                    paper.authors.push(name);
                                }
                            }
                            in_author = false;
                        }
                    }
                    "PubmedArticle" => {
                        if let Some(builder) = current_paper.take() {
                            papers.push(builder.build());
                        }
                    }
                    _ => {}
                }
                current_tag.clear();
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("XML parse error: {}", e)),
            _ => {}
        }
    }

    Ok(papers)
}

/// 将 Paper 转换为 PaperSummary
pub fn to_summaries(papers: &[Paper]) -> Vec<PaperSummary> {
    papers
        .iter()
        .map(|p| PaperSummary {
            pmid: p.pmid.clone(),
            title: p.title.clone(),
            journal: p.journal.clone(),
            year: p.year.clone(),
            authors: p.authors.clone(),
            citation_count: p.citation_count,
        })
        .collect()
}

#[derive(Default)]
struct PaperBuilder {
    pmid: String,
    title: String,
    journal: String,
    year: String,
    authors: Vec<String>,
    abstract_text: String,
}

impl PaperBuilder {
    fn build(self) -> Paper {
        Paper {
            pmid: self.pmid,
            title: self.title,
            journal: self.journal,
            year: self.year,
            authors: self.authors,
            abstract_text: self.abstract_text,
            citation_count: 0,
            references: Vec::new(),
        }
    }
}
