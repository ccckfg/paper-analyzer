import { useRef, useEffect, useState } from 'react';
import type { Edge, Node, Options } from 'vis-network';
import { buildNetwork } from '../services/tauriCommands';
import type { NetworkData, PaperSummary } from '../types';
import { PUBMED_BASE_URL } from '../config/constants';
import '../styles/NetworkGraph.css';

interface Props {
  papers?: PaperSummary[];
}

export default function NetworkGraph({ papers = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPaper, setSelectedPaper] = useState<PaperSummary | null>(null);

  // 使用 ref 保存 papers，防止事件回调闭包拿不到最新数据
  const papersRef = useRef(papers);
  useEffect(() => {
    papersRef.current = papers;
  }, [papers]);

  const loadNetwork = async () => {
    setLoading(true);
    setError('');
    setSelectedPaper(null);
    try {
      const data: NetworkData = await buildNetwork();
      renderGraph(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const renderGraph = async (data: NetworkData) => {
    if (!containerRef.current) return;

    const { Network } = await import('vis-network');
    const { DataSet } = await import('vis-data');

    const nodes = new DataSet<Node>(
      data.nodes.map(n => ({
        id: n.id,
        label: n.label,
        title: '👆 点击查看详细信息',
        value: n.value,
        color: {
          background: n.color,
          border: n.is_core ? '#fca5a5' : '#4b5563',
          highlight: {
            background: n.is_core ? '#f87171' : '#60a5fa',
            border: n.is_core ? '#ef4444' : '#3b82f6',
          },
        },
        font: { color: '#e5e7eb', size: n.is_core ? 14 : 11, face: 'Outfit' },
        borderWidth: n.is_core ? 3 : 1,
        shadow: n.is_core,
      }))
    );

    const edges = new DataSet<Edge>(
      data.edges.map((e, i) => ({
        id: `e${i}`,
        from: e.from,
        to: e.to,
        arrows: 'to',
        color: {
          color: 'rgba(100,116,139,0.15)',
          highlight: 'rgba(59,130,246,0.8)',
        },
        width: 1,
        selectionWidth: 2,
        smooth: false,
      }))
    );

    const options: Options = {
      physics: {
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.1,
          springLength: 150,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0.1,
        },
        stabilization: { iterations: 150 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        zoomView: true,
        dragView: true,
        hideEdgesOnDrag: true,
        selectConnectedEdges: true,
      },
      nodes: { shape: 'dot', scaling: { min: 8, max: 40 } },
      edges: { smooth: false },
    };

    if (networkRef.current) {
      networkRef.current.destroy();
    }

    networkRef.current = new Network(
      containerRef.current,
      { nodes, edges },
      options
    );

    // 点击节点 → 通过 PMID 反查论文完整数据并展示详情面板
    networkRef.current.on('click', (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const paper = papersRef.current.find(p => p.pmid === nodeId);
        if (paper) {
          setSelectedPaper(paper);
        }
      } else {
        setSelectedPaper(null);
      }
    });
  };

  useEffect(() => {
    loadNetwork();
    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="network-container">
      {loading && (
        <div className="network-loading">
          <div className="loading-spinner" />
          <span style={{ color: 'var(--text-secondary)' }}>
            正在构建智能引用网络...
          </span>
        </div>
      )}
      {error && (
        <div className="network-error">
          <span>❌ {error}</span>
          <button className="retry-btn" onClick={loadNetwork}>
            🔄 重试
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: loading || error ? 'none' : 'block',
          outline: 'none',
        }}
      />
      {!loading && !error && (
        <div className="network-legend">
          <div className="legend-item">
            <div className="legend-dot core" />
            <span>核心论文</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot normal" />
            <span>普通论文</span>
          </div>
        </div>
      )}

      {/* 论文详情浮层面板 */}
      {selectedPaper && (
        <div className="network-detail-panel">
          <button
            className="panel-close-btn"
            onClick={() => setSelectedPaper(null)}
          >
            ✕
          </button>
          <div className="detail-pmid">PMID: {selectedPaper.pmid}</div>
          <h3 className="detail-title">{selectedPaper.title}</h3>

          <div className="detail-meta">
            <span className="detail-journal">{selectedPaper.journal}</span>
            <span className="detail-year">{selectedPaper.year}</span>
          </div>

          <div className="detail-authors">
            👨‍🔬 {selectedPaper.authors.slice(0, 4).join(', ')}
            {selectedPaper.authors.length > 4 && ' et al.'}
          </div>

          {selectedPaper.citation_count > 0 && (
            <div className="detail-citations">
              🔥 {selectedPaper.citation_count} 次被引
            </div>
          )}

          <div className="detail-actions">
            <a
              href={`${PUBMED_BASE_URL}/${selectedPaper.pmid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="detail-link"
            >
              📖 前往 PubMed 阅读全篇 ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
