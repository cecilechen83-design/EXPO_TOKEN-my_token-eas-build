import React, { useState, useRef, useCallback } from 'react'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import ResultsPanel from './components/ResultsPanel'
import ImageUpload from './components/ImageUpload'
import HelpPanel from './components/HelpPanel'
import Footer from './components/Footer'
import { searchTariff } from './data/tariffData'

export default function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('text') // 'text' | 'image'
  const [imageQuery, setImageQuery] = useState('')

  const handleSearch = useCallback((q) => {
    const trimmed = (q || query).trim()
    if (!trimmed) return
    setLoading(true)
    setSearched(false)
    setTimeout(() => {
      const found = searchTariff(trimmed)
      setResults(found)
      setSearched(true)
      setLoading(false)
    }, 400)
  }, [query])

  const handleImageIdentify = useCallback((identified) => {
    setQuery(identified)
    setActiveTab('text')
    handleSearch(identified)
  }, [handleSearch])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #0f172a 100%)' }}>
      <Header />

      <main style={{ flex: 1, maxWidth: 1100, margin: '0 auto', width: '100%', padding: '24px 16px 40px' }}>
        {/* Tab Switcher */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 20,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 12, padding: 4, width: 'fit-content'
        }}>
          {[
            { id: 'text', label: '🔍 文字查询' },
            { id: 'image', label: '📷 图片识别' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 14, transition: 'all 0.2s',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#1a56db' : 'rgba(255,255,255,0.7)',
              boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
            }}>{tab.label}</button>
          ))}
        </div>

        {activeTab === 'text' ? (
          <SearchBar
            query={query}
            setQuery={setQuery}
            onSearch={handleSearch}
            loading={loading}
          />
        ) : (
          <ImageUpload onIdentify={handleImageIdentify} />
        )}

        {!searched && !loading && <HelpPanel />}

        {loading && <LoadingState />}

        {searched && !loading && (
          <ResultsPanel results={results} query={query} />
        )}
      </main>

      <Footer />
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.7)' }}>
      <div style={{
        width: 48, height: 48, border: '4px solid rgba(255,255,255,0.2)',
        borderTopColor: '#60a5fa', borderRadius: '50%',
        margin: '0 auto 16px', animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ fontSize: 16 }}>正在查询税率数据库...</p>
    </div>
  )
}
