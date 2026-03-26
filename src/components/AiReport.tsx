import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { listen } from '@tauri-apps/api/event';
import {
  generateAiReportStream,
  loadSettings,
} from '../services/tauriCommands';
import type { LlmConfig } from '../types';
import '../styles/AiReport.css';

interface AiReportStreamEvent {
  requestId: string;
  status: 'chunk' | 'done' | 'error';
  chunk?: string;
  error?: string;
}

export default function AiReport() {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  const cleanupListener = () => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
  };

  useEffect(() => {
    loadSettings()
      .then(s => setConfig(s.llm))
      .catch(console.error);

    return () => {
      cleanupListener();
    };
  }, []);

  const handleGenerate = async () => {
    if (!config) return;

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setLoading(true);
    setError('');
    setReport('');
    cleanupListener();

    const unlisten = await listen<AiReportStreamEvent>('ai-report-stream', event => {
      const payload = event.payload;
      if (!payload || payload.requestId !== requestId) return;

      if (payload.status === 'chunk') {
        if (payload.chunk) {
          setReport(prev => prev + payload.chunk);
        }
        return;
      }

      if (payload.status === 'done') {
        setLoading(false);
        cleanupListener();
        return;
      }

      if (payload.status === 'error') {
        setLoading(false);
        setError(payload.error || '流式生成失败');
        cleanupListener();
      }
    });
    unlistenRef.current = unlisten;

    try {
      await generateAiReportStream(config, requestId);
    } catch (err) {
      setError(String(err));
      cleanupListener();
      setLoading(false);
    }
  };

  const isConfigured = config?.base_url && config?.api_key && config?.model;

  return (
    <div className="ai-report">
      <div className="report-actions">
        <button
          className="generate-btn"
          onClick={handleGenerate}
          disabled={loading || !isConfigured}
        >
          {loading ? '生成中...' : '生成科研分析报告'}
        </button>
        {!isConfigured && (
          <span className="report-hint">
            请先在设置中配置 API
          </span>
        )}
      </div>

      {loading && (
        <div className="report-generating">
          <div className="loading-spinner" />
          <span>正在生成报告，请稍候...</span>
        </div>
      )}

      {error && <div className="report-error">{error}</div>}

      {report && (
        <div className="report-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {report}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
