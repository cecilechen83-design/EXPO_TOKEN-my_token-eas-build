import React, { useState, useRef } from 'react'

// Simulated AI image recognition for common product categories
function simulateImageRecognition(filename) {
  const name = filename.toLowerCase()
  const mappings = [
    { keys: ['shoe', 'boot', 'sneaker', 'footwear', '鞋'], result: '运动鞋' },
    { keys: ['phone', 'mobile', 'iphone', '手机'], result: '手机' },
    { keys: ['tv', 'television', 'display', '电视'], result: '电视机' },
    { keys: ['shirt', 'tshirt', 't-shirt', '衫', '服'], result: 'T恤' },
    { keys: ['bag', 'purse', 'handbag', '包'], result: '手提包' },
    { keys: ['watch', 'clock', '表', '钟'], result: '手表' },
    { keys: ['laptop', 'computer', '电脑', 'pc'], result: '计算机' },
    { keys: ['sofa', 'chair', '椅', '沙发'], result: '沙发' },
    { keys: ['cosmetic', 'makeup', '化妆', 'lipstick'], result: '化妆品' },
    { keys: ['toy', 'doll', '玩具', '娃娃'], result: '玩具' },
    { keys: ['fridge', 'refrigerator', '冰箱'], result: '冰箱' },
    { keys: ['washer', 'washing', '洗衣机'], result: '洗衣机' },
    { keys: ['air', 'conditioner', 'ac', '空调'], result: '空调' },
    { keys: ['car', '汽车', 'vehicle'], result: '乘用车' },
    { keys: ['bike', 'bicycle', '自行车'], result: '自行车' },
    { keys: ['tire', 'tyre', '轮胎'], result: '轮胎' },
    { keys: ['led', 'lamp', 'light', '灯', '灯泡'], result: 'LED灯' },
    { keys: ['cable', '电线', '电缆'], result: '电线电缆' },
    { keys: ['chair', '椅子'], result: '椅子' },
    { keys: ['table', '桌子'], result: '家具' },
  ]
  for (const m of mappings) {
    if (m.keys.some(k => name.includes(k))) return m.result
  }
  return '电子产品'
}

export default function ImageUpload({ onIdentify }) {
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState(null)
  const [fileName, setFileName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [identified, setIdentified] = useState('')
  const fileRef = useRef()

  const processFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('请上传图片文件（JPG/PNG/WebP）')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target.result)
      setFileName(file.name)
      setIdentified('')
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    processFile(file)
  }

  const handleAnalyze = () => {
    if (!fileName) return
    setAnalyzing(true)
    setTimeout(() => {
      const result = simulateImageRecognition(fileName)
      setIdentified(result)
      setAnalyzing(false)
    }, 1800)
  }

  const handleUseResult = () => {
    if (identified) onIdentify(identified)
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        onClick={() => !preview && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? '#60a5fa' : preview ? '#34d399' : 'rgba(255,255,255,0.2)'}`,
          borderRadius: 16,
          padding: preview ? '16px' : '48px 20px',
          textAlign: 'center',
          cursor: preview ? 'default' : 'pointer',
          background: dragOver ? 'rgba(96,165,250,0.08)' : preview ? 'rgba(52,211,153,0.05)' : 'rgba(255,255,255,0.03)',
          transition: 'all 0.2s',
        }}
      >
        {!preview ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              上传商品图片进行自动识别
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              拖拽图片到此处，或点击选择文件（JPG / PNG / WebP）
            </p>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <img src={preview} alt="preview" style={{
              maxWidth: 180, maxHeight: 180, borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.15)', objectFit: 'contain',
              background: 'rgba(255,255,255,0.05)'
            }} />
            <div style={{ flex: 1, textAlign: 'left', minWidth: 200 }}>
              <p style={{ color: '#34d399', fontWeight: 700, marginBottom: 6 }}>✅ 图片已上传</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 12 }}>
                文件：{fileName}
              </p>
              {!identified && !analyzing && (
                <button onClick={handleAnalyze} style={{
                  background: 'linear-gradient(135deg, #7c3aed, #1a56db)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  padding: '10px 24px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                  boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
                  marginRight: 10
                }}>
                  🤖 AI 识别商品
                </button>
              )}
              {analyzing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 20, height: 20, border: '3px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#a78bfa', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  <span style={{ color: '#a78bfa', fontSize: 14 }}>AI 识别中，请稍候...</span>
                </div>
              )}
              {identified && (
                <div style={{ marginTop: 8 }}>
                  <div style={{
                    background: 'rgba(167,139,250,0.15)',
                    border: '1px solid rgba(167,139,250,0.3)',
                    borderRadius: 10, padding: '10px 14px',
                    marginBottom: 12
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>AI 识别结果：</span>
                    <span style={{ color: '#c4b5fd', fontWeight: 700, fontSize: 16, marginLeft: 6 }}>
                      {identified}
                    </span>
                  </div>
                  <button onClick={handleUseResult} style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    padding: '10px 24px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                    boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                    marginRight: 10
                  }}>
                    🔍 查询"{identified}"的税率
                  </button>
                  <button onClick={() => { setPreview(null); setFileName(''); setIdentified('') }} style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer', padding: '10px 18px', borderRadius: 10, fontSize: 14
                  }}>
                    重新上传
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => processFile(e.target.files[0])} />

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
        💡 提示：为获得最佳识别效果，建议上传清晰的商品主图
      </p>
    </div>
  )
}
