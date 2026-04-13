'use client'

import { useRef, useState } from 'react'

type Result = { transcript: string; summary: string }

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp']

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function downloadTxt(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [copied, setCopied] = useState<'summary' | 'transcript' | null>(null)

  function handleFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!VIDEO_EXTENSIONS.includes(ext)) {
      setError('Formato non supportato. Usa: ' + VIDEO_EXTENSIONS.join(', '))
      return
    }
    setFile(f)
    setResult(null)
    setError(null)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  async function handleAnalyze() {
    if (!file) return
    setProcessing(true)
    setResult(null)
    setError(null)
    setShowTranscript(false)

    try {
      const form = new FormData()
      form.append('video', file)
      const res = await fetch('/api/transcribe', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Errore sconosciuto')
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore durante l'analisi")
    } finally {
      setProcessing(false)
    }
  }

  async function handleCopy(text: string, type: 'summary' | 'transcript') {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleDownload() {
    if (!result || !file) return
    const name = file.name.replace(/\.[^.]+$/, '')
    const content = [
      `VIDEO: ${file.name}`,
      `DATA: ${new Date().toLocaleDateString('it-IT')}`,
      '',
      '═══ RIASSUNTO ═══',
      '',
      result.summary,
      '',
      '═══ TRASCRIZIONE COMPLETA ═══',
      '',
      result.transcript,
    ].join('\n')
    downloadTxt(`${name}_analisi.txt`, content)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Analizzatore Video</h1>
        <p className="text-zinc-400 mb-10 text-sm">
          Carica un video da Telegram, WhatsApp o qualsiasi fonte per ottenere trascrizione e riassunto.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`cursor-pointer border-2 border-dashed rounded-2xl px-8 py-12 text-center transition-colors mb-6 ${
            dragging ? 'border-indigo-500 bg-indigo-950/30' : 'border-zinc-700 hover:border-zinc-500'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={VIDEO_EXTENSIONS.map(e => `.${e}`).join(',')}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {file ? (
            <div>
              <p className="text-lg font-medium text-zinc-200 truncate">{file.name}</p>
              <p className="text-sm text-zinc-400 mt-1">{formatBytes(file.size)}</p>
              <p className="text-xs text-zinc-500 mt-3">Clicca per cambiare file</p>
            </div>
          ) : (
            <div>
              <p className="text-4xl mb-3">🎬</p>
              <p className="text-zinc-300 font-medium">Trascina qui il video</p>
              <p className="text-zinc-500 text-sm mt-1">oppure clicca per selezionare</p>
              <p className="text-zinc-600 text-xs mt-3">{VIDEO_EXTENSIONS.join(' · ')}</p>
            </div>
          )}
        </div>

        {/* Bottone analizza */}
        {file && (
          <button
            onClick={handleAnalyze}
            disabled={processing}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm transition-colors mb-6"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Analisi in corso…
              </span>
            ) : 'Analizza video'}
          </button>
        )}

        {/* Errore */}
        {error && (
          <div className="border border-red-800 bg-red-950/40 rounded-xl px-5 py-4 text-red-300 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Risultato */}
        {result && (
          <section className="space-y-4">

            {/* Barra azioni */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors"
              >
                ⬇ Scarica TXT
              </button>
              <button
                onClick={() => handleCopy(`${result.summary}\n\n---\n\n${result.transcript}`, 'summary')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors"
              >
                {copied === 'summary' ? '✓ Copiato!' : '⎘ Copia tutto'}
              </button>
            </div>

            {/* Riassunto */}
            <div className="border border-zinc-800 rounded-xl px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-zinc-200">Riassunto</h2>
                <button
                  onClick={() => handleCopy(result.summary, 'summary')}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded"
                >
                  {copied === 'summary' ? '✓ Copiato' : 'Copia'}
                </button>
              </div>
              <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {result.summary}
              </div>
            </div>

            {/* Trascrizione */}
            <div className="border border-zinc-800 rounded-xl px-6 py-5">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowTranscript(v => !v)}
                  className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <span>{showTranscript ? '▼' : '▶'}</span>
                  {showTranscript ? 'Nascondi trascrizione' : 'Mostra trascrizione completa'}
                </button>
                {showTranscript && (
                  <button
                    onClick={() => handleCopy(result.transcript, 'transcript')}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded"
                  >
                    {copied === 'transcript' ? '✓ Copiato' : 'Copia'}
                  </button>
                )}
              </div>
              {showTranscript && (
                <p className="mt-4 text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
                  {result.transcript}
                </p>
              )}
            </div>

          </section>
        )}
      </div>
    </div>
  )
}
