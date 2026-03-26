import { useRef, useEffect, useState } from 'react';
import type { Edge, Node, Options } from 'vis-network';
import { buildNetwork } from '../services/tauriCommands';
import type { NetworkData, PaperSummary } from '../types';
import { PUBMED_BASE_URL } from '../config/constants';
import '../styles/NetworkGraph.css';

const MAX_VISIBLE_NODES = 50;

interface Props {
  papers?: PaperSummary[];
}

/** 当节点过多时，只保留核心节点及其一跳邻居 */
function filterDenseNetwork(data: NetworkData): { filtered: NetworkData; totalNodes: number } {
  const totalNodes = data.nodes.length;
  if (totalNodes <= MAX_VISIBLE_NODES) {
    return { filtered: data, totalNodes };
  }

  const coreIds = new Set(data.nodes.filter(n => n.is_core).map(n => n.id));
  const neighborIds = new Set<string>();

  for (const edge of data.edges) {
    if (coreIds.has(edge.from)) neighborIds.add(edge.to);
    if (coreIds.has(edge.to)) neighborIds.add(edge.from);
  }

  const keepIds = new Set([...coreIds, ...neighborIds]);
  const filteredNodes = data.nodes.filter(n => keepIds.has(n.id));
  const filteredEdges = data.edges.filter(
    e => keepIds.has(e.from) && keepIds.has(e.to)
  );

  return {
    filtered: { nodes: filteredNodes, edges: filteredEdges },
    totalNodes,
  };
}

export default function NetworkGraph({ papers = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPaper, setSelectedPaper] = useState<PaperSummary | null>(null);
  const [filterInfo, setFilterInfo] = useState('');
  const [isReady, setIsReady] = useState(false);

  const papersRef = useRef(papers);
  useEffect(() => { papersRef.current = papers; }, [papers]);

  const loadNetwork = async () => {
    setLoading(true);
    setError('');
    setSelectedPaper(null);
    setFilterInfo('');
    setIsReady(false);
    try {
      const data: NetworkData = await buildNetwork();
      const { filtered, totalNodes } = filterDenseNetwork(data);
      if (filtered.nodes.length < totalNodes) {
        setFilterInfo(
          `共 ${totalNodes} 个节点，已筛选展示核心文献及其关联的 ${filtered.nodes.length} 个节点`
        );
      }
      renderGraph(filtered);
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
        title: n.label,
        value: n.value,
        color: {
          background: n.is_core ? '#D97757' : '#E8E7E5',
          border: n.is_core ? '#B95737' : '#D4D3D1',
          highlight: {
            background: n.is_core ? '#E48B6E' : '#FFFFFF',
            border: n.is_core ? '#D97757' : '#A1A09F',
          },
        },
        font: { color: '#2C2C2A', size: n.is_core ? 14 : 11, face: 'Inter' },
        borderWidth: n.is_core ? 2 : 1,
        shadow: false,
      }))
    );

    const edges = new DataSet<Edge>(
      data.edges.map((e, i) => ({
        id: `e${i}`,
        from: e.from,
        to: e.to,
        arrows: 'to',
        color: {
          color: 'rgba(0,0,0,0.08)',
          highlight: 'rgba(217,119,87,0.5)',
        },
        width: 1,
        selectionWidth: 2,
        smooth: false,
      }))
    );

    // 动态调整物理参数：节点少则紧凑，节点多则分散
    const nodeCount = data.nodes.length;
    // 节点数 < 15 时紧凑排列；节点数 >= 15 时距离随节点数增加而拉大
    const repulsion = nodeCount < 15 ? -2000 : Math.max(-8000, -2000 - (nodeCount - 15) * 150);
    const springLen = nodeCount < 15 ? 120 : Math.min(300, 120 + (nodeCount - 15) * 5);

    const options: Options = {
      physics: {
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: repulsion,
          centralGravity: 0.1,
          springLength: springLen,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0.2,
        },
        stabilization: { iterations: 200 },
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

    // 稳定化完成后关闭物理引擎，防止持续抖动
    networkRef.current.on('stabilizationIterationsDone', () => {
      networkRef.current?.setOptions({ physics: { enabled: false } });
      setTimeout(() => setIsReady(true), 50); // 确保布局完成后触发入场动画
    });

    networkRef.current.on('dragStart', () => {
      networkRef.current?.setOptions({ physics: { enabled: true } });
    });
    networkRef.current.on('dragEnd', () => {
      networkRef.current?.setOptions({ physics: { enabled: false } });
    });

    networkRef.current.on('click', (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const paper = papersRef.current.find(p => p.pmid === nodeId);
        if (paper) setSelectedPaper(paper);
      } else {
        setSelectedPaper(null);
      }
    });
  };

  useEffect(() => {
    loadNetwork();
    return () => { networkRef.current?.destroy(); };
  }, []);

  return (
    <div className="network-container">
      {loading && (
        <div className="network-loading">
          <div className="loading-spinner" />
          <span style={{ color: 'var(--text-secondary)' }}>
            正在整理引用网络...
          </span>
        </div>
      )}
      {error && (
        <div className="network-error">
          <span>{error}</span>
          <button className="retry-btn" onClick={loadNetwork}>
            重新加载
          </button>
        </div>
      )}
      <div className={`network-canvas-wrapper ${isReady ? 'ready' : ''}`}>
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            display: loading || error ? 'none' : 'block',
            outline: 'none',
          }}
        />
      </div>
      {!loading && !error && (
        <>
          {filterInfo && (
            <div className="network-filter-info">{filterInfo}</div>
          )}
          <div className="network-legend">
            <div className="legend-item">
              <div className="legend-dot core" />
              <span>核心文献</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot normal" />
              <span>普通文献</span>
            </div>
          </div>
        </>
      )}

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
            {selectedPaper.authors.slice(0, 4).join(', ')}
            {selectedPaper.authors.length > 4 && ' et al.'}
          </div>

          {selectedPaper.citation_count > 0 && (
            <div className="detail-citations">
              {selectedPaper.citation_count} 次被引
            </div>
          )}

          <div className="detail-actions">
            <a
              href={`${PUBMED_BASE_URL}/${selectedPaper.pmid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="detail-link"
            >
              前往 PubMed 阅读 ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}


