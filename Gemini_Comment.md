你好！站在**产品经理（PM）**与**高级前端开发（Dev）**的双重视角来看，你目前遇到的这两个问题正是“数据图谱可视化”领域中最容易踩坑、也是最影响用户体验的两个痛点。

在科研引文这种“高密度”的关系图谱中，如果不进行人工干预：
1. **视觉层面**：一定会产生所谓的**“毛线球效应（Hairball Effect）”**。你的代码中默认开启了连续平滑曲线（`smooth: { enabled: true }`），几百条曲线穿插在一起会导致严重的视觉干扰，让人无法分辨清晰的关系走向。
2. **交互层面**：失去了数据的“下钻能力”。如果一张图表只能看不能点，用户看到高亮的核心节点却无法展开阅读摘要、无法跳转原文献，整个**产品探索链路就在这里断裂了**。

### 🛠️ 解决落地方案（即插即用）

**好消息是：我们完全不需要修改 Rust 后端**！通过打通前端组件的数据流、关闭曲线渲染并调优物理引擎配置，我们就可以实现一张**清晰、交互拉满的现代感网络图谱**。

请按照以下 3 个步骤修改前端代码：

#### 第一步：打通数据流（修改 `ResultsPage.tsx`）
当前 `NetworkGraph` 只向后端请求了非常基础的节点（缺少期刊、作者等），我们需要将父组件已经拿到手的 `papers` 完整数据当作 Props 传给它。

打开 `src/pages/ResultsPage.tsx`，找到大约 65 行左右 `tab-panel` 的地方：
```tsx
// 修改前：
{activeTab === 'network' && <NetworkGraph />}

// 修改后：将 papers 列表传入图谱，作为查数据的字典
{activeTab === 'network' && <NetworkGraph papers={papers} />}
```

#### 第二步：彻底重构图谱组件（修改 `NetworkGraph.tsx`）
打开 `src/components/NetworkGraph.tsx`，用以下代码**完全替换**。
> **核心改进点**：
> 1. **直线降噪**：关闭平滑曲线，极大降低非选中状态下连线的透明度。
> 2. **引力调优**：改用 `barnesHut` 防重叠引擎，加大节点间的排斥力，让星图自己“散开”。
> 3. **交互绑定**：监听节点 `click` 事件，点击后在右侧弹出一个高级毛玻璃详情卡片。

```tsx
import { useRef, useEffect, useState } from 'react';
import type { Edge, Node, Options } from 'vis-network';
import { buildNetwork } from '../services/tauriCommands';
import type { NetworkData, PaperSummary } from '../types';
import { PUBMED_BASE_URL } from '../config/constants';
import '../styles/NetworkGraph.css';

// 1. 接收父组件传入的文献列表
interface Props {
  papers?: PaperSummary[];
}

export default function NetworkGraph({ papers = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 2. 新增状态：保存当前被用户点击的论文详细数据
  const [selectedPaper, setSelectedPaper] = useState<PaperSummary | null>(null);
  
  // 使用 ref 保存 papers，防止闭包拿不到最新的数据
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
        title: '👆 点击查看详细信息', // 缩减原生 hover tooltip，引导点击交互
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
        // 视觉降噪：调低未选中连线的透明度，高亮时变为显眼的蓝色
        color: { color: 'rgba(100,116,139,0.15)', highlight: 'rgba(59,130,246,0.8)' },
        width: 1,
        selectionWidth: 2,
        smooth: false, // 💡 降噪核心：彻底关闭曲线！密集网络中直线更具可读性
      }))
    );

    const options: Options = {
      physics: {
        solver: 'barnesHut', // 💡 改用适合关系图的 barnesHut 排斥引擎
        barnesHut: {
          gravitationalConstant: -2000, // 增加斥力，强制推开挤作一团的节点
          centralGravity: 0.1,
          springLength: 150,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0.1 // 开启防重叠
        },
        stabilization: { iterations: 150 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        zoomView: true,
        dragView: true,
        hideEdgesOnDrag: true, // 拖拽画布时隐藏连线，大幅提升帧率
        selectConnectedEdges: true, // 💡 核心交互：选中节点时自动高亮其所有连线！
      },
      nodes: { shape: 'dot', scaling: { min: 8, max: 40 } },
      edges: { smooth: false },
    };

    if (networkRef.current) networkRef.current.destroy();
    networkRef.current = new Network(containerRef.current, { nodes, edges }, options);

    // 3. 核心交互：监听点击事件，反查论文完整数据
    networkRef.current.on('click', (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const paper = papersRef.current.find(p => p.pmid === nodeId);
        if (paper) {
          setSelectedPaper(paper);
        }
      } else {
        setSelectedPaper(null); // 点击空白区域关闭浮层
      }
    });
  };

  useEffect(() => {
    loadNetwork();
    return () => networkRef.current?.destroy();
  }, []);

  return (
    <div className="network-container">
      {loading && (
        <div className="network-loading"><div className="loading-spinner" /><span style={{ color: 'var(--text-secondary)' }}>正在构建智能引用网络...</span></div>
      )}
      {error && (
        <div className="network-error"><span>❌ {error}</span><button className="retry-btn" onClick={loadNetwork}>🔄 重试</button></div>
      )}

      {/* Vis 画布 */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', display: loading || error ? 'none' : 'block', outline: 'none' }} />

      {!loading && !error && (
        <div className="network-legend">
          <div className="legend-item"><div className="legend-dot core" /><span>核心论文</span></div>
          <div className="legend-item"><div className="legend-dot normal" /><span>普通论文</span></div>
        </div>
      )}

      {/* 4. 新增面板：论文详情高级卡片 */}
      {selectedPaper && (
        <div className="network-detail-panel fade-in">
          <button className="panel-close-btn" onClick={() => setSelectedPaper(null)}>✕</button>
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
            <div className="detail-citations">🔥 {selectedPaper.citation_count} 次被引</div>
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
```

#### 第三步：补充卡片的玻璃态样式（修改 `NetworkGraph.css`）
打开 `src/styles/NetworkGraph.css`，在文件**最末尾**追加以下 CSS 代码，为新增的详情抽屉提供符合深色主题的质感外观：

```css
/* ===============================
   新增：网络图右侧交互详情面板
   =============================== */
.network-detail-panel {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 320px;
  max-height: calc(100% - 3rem);
  background: var(--bg-glass);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  box-shadow: var(--shadow-lg), 0 0 20px rgba(0, 0, 0, 0.3);
  z-index: 20;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  border-top: 3px solid var(--accent-primary);
  animation: fadeIn 0.3s ease forwards;
}

.panel-close-btn {
  position: absolute;
  top: 0.8rem;
  right: 0.8rem;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.2rem;
  border: none;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all var(--transition-fast);
}

.panel-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.detail-pmid {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
  margin-bottom: 0.4rem;
}

.detail-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.8rem;
  line-height: 1.4;
  padding-right: 1.5rem; /* 为关闭按钮留空间 */
}

.detail-meta {
  display: flex;
  gap: 0.8rem;
  margin-bottom: 0.8rem;
  font-size: 0.85rem;
}

.detail-journal {
  color: var(--accent-primary);
  font-weight: 600;
}

.detail-year {
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.detail-authors {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 1rem;
}

.detail-citations {
  display: inline-block;
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-family: var(--font-mono);
  font-weight: 600;
  align-self: flex-start;
  margin-bottom: 1.2rem;
}

.detail-actions {
  margin-top: auto;
  border-top: 1px solid var(--border-color);
  padding-top: 1rem;
}

.detail-link {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-gradient);
  color: white;
  padding: 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  text-decoration: none;
}

.detail-link:hover {
  transform: translateY(-2px);
  box-shadow: var(--accent-glow);
  color: white;
}
```

### 🎉 预期效果 (The "Aha" Moment)

按以上方案保存后，热更新会在界面上展示出质的飞跃：
1. **彻底告别毛线团**：抛弃虚高的曲线并加大排斥力后，整个节点会如星系般舒展排布，你能一眼看清网络骨架的疏密走向。
2. **聚光灯效应**：当你点击任意一个文献节点时（例如核心红点），**所有不相关的线段会自动淡化到隐身，只高亮这篇文献所在的引文路径**。
3. **完成产品探索闭环**：右侧平滑滑出的文献卡片能够让科研用户立刻掌握作者、影响因子、被引信息，一键飞往 PubMed 开启深度阅读。这正是这款工具原本设计该有的体验！你好！站在**产品经理（PM）**与**高级前端开发（Dev）**的双重视角来看，你目前遇到的这两个问题正是“数据图谱可视化”领域中最容易踩坑、也是最影响用户体验的两个痛点。

在科研引文这种“高密度”的关系图谱中，如果不进行人工干预：
1. **视觉层面**：一定会产生所谓的**“毛线球效应（Hairball Effect）”**。你的代码中默认开启了连续平滑曲线（`smooth: { enabled: true }`），几百条曲线穿插在一起会导致严重的视觉干扰，让人无法分辨清晰的关系走向。
2. **交互层面**：失去了数据的“下钻能力”。如果一张图表只能看不能点，用户看到高亮的核心节点却无法展开阅读摘要、无法跳转原文献，整个**产品探索链路就在这里断裂了**。

### 🛠️ 解决落地方案（即插即用）

**好消息是：我们完全不需要修改 Rust 后端**！通过打通前端组件的数据流、关闭曲线渲染并调优物理引擎配置，我们就可以实现一张**清晰、交互拉满的现代感网络图谱**。

请按照以下 3 个步骤修改前端代码：

#### 第一步：打通数据流（修改 `ResultsPage.tsx`）
当前 `NetworkGraph` 只向后端请求了非常基础的节点（缺少期刊、作者等），我们需要将父组件已经拿到手的 `papers` 完整数据当作 Props 传给它。

打开 `src/pages/ResultsPage.tsx`，找到大约 65 行左右 `tab-panel` 的地方：
```tsx
// 修改前：
{activeTab === 'network' && <NetworkGraph />}

// 修改后：将 papers 列表传入图谱，作为查数据的字典
{activeTab === 'network' && <NetworkGraph papers={papers} />}
```

#### 第二步：彻底重构图谱组件（修改 `NetworkGraph.tsx`）
打开 `src/components/NetworkGraph.tsx`，用以下代码**完全替换**。
> **核心改进点**：
> 1. **直线降噪**：关闭平滑曲线，极大降低非选中状态下连线的透明度。
> 2. **引力调优**：改用 `barnesHut` 防重叠引擎，加大节点间的排斥力，让星图自己“散开”。
> 3. **交互绑定**：监听节点 `click` 事件，点击后在右侧弹出一个高级毛玻璃详情卡片。

```tsx
import { useRef, useEffect, useState } from 'react';
import type { Edge, Node, Options } from 'vis-network';
import { buildNetwork } from '../services/tauriCommands';
import type { NetworkData, PaperSummary } from '../types';
import { PUBMED_BASE_URL } from '../config/constants';
import '../styles/NetworkGraph.css';

// 1. 接收父组件传入的文献列表
interface Props {
  papers?: PaperSummary[];
}

export default function NetworkGraph({ papers = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 2. 新增状态：保存当前被用户点击的论文详细数据
  const [selectedPaper, setSelectedPaper] = useState<PaperSummary | null>(null);
  
  // 使用 ref 保存 papers，防止闭包拿不到最新的数据
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
        title: '👆 点击查看详细信息', // 缩减原生 hover tooltip，引导点击交互
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
        // 视觉降噪：调低未选中连线的透明度，高亮时变为显眼的蓝色
        color: { color: 'rgba(100,116,139,0.15)', highlight: 'rgba(59,130,246,0.8)' },
        width: 1,
        selectionWidth: 2,
        smooth: false, // 💡 降噪核心：彻底关闭曲线！密集网络中直线更具可读性
      }))
    );

    const options: Options = {
      physics: {
        solver: 'barnesHut', // 💡 改用适合关系图的 barnesHut 排斥引擎
        barnesHut: {
          gravitationalConstant: -2000, // 增加斥力，强制推开挤作一团的节点
          centralGravity: 0.1,
          springLength: 150,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0.1 // 开启防重叠
        },
        stabilization: { iterations: 150 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        zoomView: true,
        dragView: true,
        hideEdgesOnDrag: true, // 拖拽画布时隐藏连线，大幅提升帧率
        selectConnectedEdges: true, // 💡 核心交互：选中节点时自动高亮其所有连线！
      },
      nodes: { shape: 'dot', scaling: { min: 8, max: 40 } },
      edges: { smooth: false },
    };

    if (networkRef.current) networkRef.current.destroy();
    networkRef.current = new Network(containerRef.current, { nodes, edges }, options);

    // 3. 核心交互：监听点击事件，反查论文完整数据
    networkRef.current.on('click', (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const paper = papersRef.current.find(p => p.pmid === nodeId);
        if (paper) {
          setSelectedPaper(paper);
        }
      } else {
        setSelectedPaper(null); // 点击空白区域关闭浮层
      }
    });
  };

  useEffect(() => {
    loadNetwork();
    return () => networkRef.current?.destroy();
  }, []);

  return (
    <div className="network-container">
      {loading && (
        <div className="network-loading"><div className="loading-spinner" /><span style={{ color: 'var(--text-secondary)' }}>正在构建智能引用网络...</span></div>
      )}
      {error && (
        <div className="network-error"><span>❌ {error}</span><button className="retry-btn" onClick={loadNetwork}>🔄 重试</button></div>
      )}

      {/* Vis 画布 */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', display: loading || error ? 'none' : 'block', outline: 'none' }} />

      {!loading && !error && (
        <div className="network-legend">
          <div className="legend-item"><div className="legend-dot core" /><span>核心论文</span></div>
          <div className="legend-item"><div className="legend-dot normal" /><span>普通论文</span></div>
        </div>
      )}

      {/* 4. 新增面板：论文详情高级卡片 */}
      {selectedPaper && (
        <div className="network-detail-panel fade-in">
          <button className="panel-close-btn" onClick={() => setSelectedPaper(null)}>✕</button>
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
            <div className="detail-citations">🔥 {selectedPaper.citation_count} 次被引</div>
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
```

#### 第三步：补充卡片的玻璃态样式（修改 `NetworkGraph.css`）
打开 `src/styles/NetworkGraph.css`，在文件**最末尾**追加以下 CSS 代码，为新增的详情抽屉提供符合深色主题的质感外观：

```css
/* ===============================
   新增：网络图右侧交互详情面板
   =============================== */
.network-detail-panel {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 320px;
  max-height: calc(100% - 3rem);
  background: var(--bg-glass);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  box-shadow: var(--shadow-lg), 0 0 20px rgba(0, 0, 0, 0.3);
  z-index: 20;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  border-top: 3px solid var(--accent-primary);
  animation: fadeIn 0.3s ease forwards;
}

.panel-close-btn {
  position: absolute;
  top: 0.8rem;
  right: 0.8rem;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.2rem;
  border: none;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all var(--transition-fast);
}

.panel-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.detail-pmid {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
  margin-bottom: 0.4rem;
}

.detail-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.8rem;
  line-height: 1.4;
  padding-right: 1.5rem; /* 为关闭按钮留空间 */
}

.detail-meta {
  display: flex;
  gap: 0.8rem;
  margin-bottom: 0.8rem;
  font-size: 0.85rem;
}

.detail-journal {
  color: var(--accent-primary);
  font-weight: 600;
}

.detail-year {
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.detail-authors {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 1rem;
}

.detail-citations {
  display: inline-block;
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-family: var(--font-mono);
  font-weight: 600;
  align-self: flex-start;
  margin-bottom: 1.2rem;
}

.detail-actions {
  margin-top: auto;
  border-top: 1px solid var(--border-color);
  padding-top: 1rem;
}

.detail-link {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-gradient);
  color: white;
  padding: 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  text-decoration: none;
}

.detail-link:hover {
  transform: translateY(-2px);
  box-shadow: var(--accent-glow);
  color: white;
}
```

### 🎉 预期效果 (The "Aha" Moment)

按以上方案保存后，热更新会在界面上展示出质的飞跃：
1. **彻底告别毛线团**：抛弃虚高的曲线并加大排斥力后，整个节点会如星系般舒展排布，你能一眼看清网络骨架的疏密走向。
2. **聚光灯效应**：当你点击任意一个文献节点时（例如核心红点），**所有不相关的线段会自动淡化到隐身，只高亮这篇文献所在的引文路径**。
3. **完成产品探索闭环**：右侧平滑滑出的文献卡片能够让科研用户立刻掌握作者、影响因子、被引信息，一键飞往 PubMed 开启深度阅读。这正是这款工具原本设计该有的体验！