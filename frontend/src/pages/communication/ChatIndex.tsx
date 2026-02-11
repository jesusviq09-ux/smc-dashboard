import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, MessageSquare } from 'lucide-react'
import { communicationApi } from '@/services/api/communication.api'
import { io, Socket } from 'socket.io-client'
import type { Message } from '@/types'

export default function ChatIndex() {
  const [channel, setChannel] = useState<'general' | 'strategy' | 'technical'>('general')
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const socketRef = useRef<Socket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: history = [] } = useQuery({
    queryKey: ['messages', channel],
    queryFn: () => communicationApi.getMessages(channel),
  })

  useEffect(() => { setMessages(history) }, [history])

  useEffect(() => {
    // @ts-ignore
    const apiUrl = (import.meta as any).env?.VITE_API_URL
    const socket = io(apiUrl?.replace('/api', '') ?? 'http://localhost:3001', { transports: ['websocket'] })
    socketRef.current = socket
    socket.emit('join-channel', channel)
    socket.on('new-message', (msg: Message) => setMessages(prev => [...prev, msg]))
    return () => { socket.disconnect() }
  }, [channel])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = () => {
    if (!text.trim()) return
    const payload: Record<string, unknown> = {
      channel,
      senderName: 'Coach',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }
    socketRef.current?.emit('send-message', payload)
    setText('')
  }

  const CHANNELS = [
    { id: 'general', label: 'General' },
    { id: 'strategy', label: 'Estrategia' },
    { id: 'technical', label: 'Técnico' },
  ] as const

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="section-title mb-0">Comunicación</h1>
        <div className="flex gap-1">
          {CHANNELS.map(c => (
            <button key={c.id} onClick={() => setChannel(c.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${channel === c.id ? 'bg-primary text-smc-dark' : 'bg-smc-card text-smc-muted hover:text-smc-text'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 bg-smc-card rounded-xl border border-smc-border p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-smc-muted">
            <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Sin mensajes en #{channel}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={msg.id ?? i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
              {(msg.senderName ?? '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-white">{msg.senderName}</span>
                <span className="text-xs text-smc-muted">{new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-sm text-smc-text mt-0.5">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input className="input-field flex-1" placeholder={`Mensaje en #${channel}...`}
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button onClick={send} disabled={!text.trim()} className="btn-primary px-4">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
