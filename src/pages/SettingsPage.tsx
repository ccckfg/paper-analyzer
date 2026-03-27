import { useState, useEffect } from 'react';
import {
  loadSettings,
  saveSettings,
  testLlmConnection,
} from '../services/tauriCommands';
import {
  DEFAULT_MAX_RESULTS,
  MAX_MAX_RESULTS,
  MIN_MAX_RESULTS,
  normalizeMaxResults,
} from '../config/constants';
import type { AppSettings } from '../types';
import '../styles/SettingsPage.css';

interface Props {
  onClose: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  llm: { base_url: '', api_key: '', model: '' },
  max_results: DEFAULT_MAX_RESULTS,
};

function validateMaxResultsInput(input: string): string {
  const value = input.trim();
  if (!value) {
    return `请输入 ${MIN_MAX_RESULTS}-${MAX_MAX_RESULTS} 之间的整数`;
  }
  if (!/^\d+$/.test(value)) {
    return '最大搜索结果数只能是整数';
  }
  const parsed = Number(value);
  if (parsed < MIN_MAX_RESULTS || parsed > MAX_MAX_RESULTS) {
    return `范围需在 ${MIN_MAX_RESULTS}-${MAX_MAX_RESULTS} 之间`;
  }
  return '';
}

export default function SettingsPage({ onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [maxResultsInput, setMaxResultsInput] = useState(String(DEFAULT_MAX_RESULTS));
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const maxResultsError = validateMaxResultsInput(maxResultsInput);

  useEffect(() => {
    loadSettings()
      .then(s => {
        const normalizedMaxResults = normalizeMaxResults(s.max_results);
        setSettings({
          ...s,
          max_results: normalizedMaxResults,
        });
        setMaxResultsInput(String(normalizedMaxResults));
      })
      .catch(() => {
        setSettings(DEFAULT_SETTINGS);
        setMaxResultsInput(String(DEFAULT_MAX_RESULTS));
      });
  }, []);

  const updateLlm = (field: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      llm: { ...prev.llm, [field]: value },
    }));
    setTestResult(null);
  };

  const handleSave = async () => {
    if (maxResultsError) return;

    const nextSettings: AppSettings = {
      ...settings,
      max_results: Number(maxResultsInput.trim()),
    };

    setSaving(true);
    try {
      await saveSettings(nextSettings);
      setSettings(nextSettings);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const msg = await testLlmConnection(settings.llm);
      setTestResult({ ok: true, msg });
    } catch (err) {
      setTestResult({ ok: false, msg: String(err) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        <div className="settings-header">
          <button className="settings-back-btn" onClick={onClose}>
            返回
          </button>
          <h1 className="settings-page-title">设置</h1>
        </div>

        {/* LLM API 配置 */}
        <div className="settings-section">
          <h2 className="section-title">大模型 API 配置</h2>
          <div className="form-group">
            <label className="form-label">Base URL</label>
            <input
              className="form-input"
              value={settings.llm.base_url}
              onChange={e => updateLlm('base_url', e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
            <div className="form-hint">支持 OpenAI 兼容格式（OpenAI / Deepseek / 本地 Ollama 等）</div>
          </div>
          <div className="form-group">
            <label className="form-label">API Key</label>
            <input
              className="form-input"
              type="password"
              value={settings.llm.api_key}
              onChange={e => updateLlm('api_key', e.target.value)}
              placeholder="sk-..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">模型名称</label>
            <input
              className="form-input"
              value={settings.llm.model}
              onChange={e => updateLlm('model', e.target.value)}
              placeholder="gpt-4o-mini / deepseek-chat"
            />
          </div>

          <div className="form-actions">
            <button className="btn-secondary" onClick={handleTest} disabled={testing}>
              {testing ? '测试中...' : '测试连接'}
            </button>
          </div>

          {testResult && (
            <div className={`test-result ${testResult.ok ? 'success' : 'error'}`}>
              {testResult.msg}
            </div>
          )}
        </div>

        {/* 搜索设置 */}
        <div className="settings-section">
          <h2 className="section-title">检索设置</h2>
          <div className="form-group">
            <label className="form-label">最大搜索结果数</label>
            <input
              className={`form-input ${maxResultsError ? 'input-error' : ''}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={maxResultsInput}
              onChange={e => setMaxResultsInput(e.target.value)}
            />
            <div className={`form-hint ${maxResultsError ? 'error' : ''}`}>
              {maxResultsError || `建议范围：${MIN_MAX_RESULTS} - ${MAX_MAX_RESULTS}`}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || Boolean(maxResultsError)}
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
