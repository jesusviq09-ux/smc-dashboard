import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pin, Plus, Pencil, Trash2, Megaphone, X, Save } from 'lucide-react'
import { noticesApi, type Notice } from '@/services/api/notices.api'
import { getStoredUser } from '@/hooks/useAuth'

function canManage(user: ReturnType<typeof getStoredUser>): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return Array.isArray(user.permissions) && user.permissions.includes('notices_write')
}

export default function NoticeBoard() {
  const qc = useQueryClient()
  const currentUser = getStoredUser()
  const manager = canManage(currentUser)

  const { data: notices = [] } = useQuery({
    queryKey: ['notices'],
    queryFn: noticesApi.getAll,
  })

  const [showForm, setShowForm] = useState(false)
  const [editNotice, setEditNotice] = useState<Notice | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', content: '', pinned: false, expiresAt: '' })

  const createMutation = useMutation({
    mutationFn: noticesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notices'] }); setShowForm(false); resetForm() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Notice> }) => noticesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notices'] }); setEditNotice(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: noticesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notices'] }); setDeleteConfirm(null) },
  })

  const resetForm = () => setForm({ title: '', content: '', pinned: false, expiresAt: '' })

  const openEdit = (n: Notice) => {
    setEditNotice(n)
    setForm({ title: n.title, content: n.content, pinned: n.pinned, expiresAt: n.expiresAt?.slice(0, 10) ?? '' })
  }

  if (notices.length === 0 && !manager) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-white">Tablón de avisos</h2>
        </div>
        {manager && (
          <button onClick={() => { setShowForm(true); setEditNotice(null); resetForm() }} className="btn-primary text-sm flex items-center gap-1.5 py-1.5">
            <Plus className="w-3.5 h-3.5" /> Nuevo aviso
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {(showForm || editNotice) && (
        <div className="bg-smc-card border border-smc-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">{editNotice ? 'Editar aviso' : 'Nuevo aviso'}</h3>
          <input
            className="input-field"
            placeholder="Título del aviso"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="input-field min-h-[80px]"
            placeholder="Contenido del aviso..."
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-smc-text">
              <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} className="w-4 h-4 accent-primary" />
              Fijar en la parte superior
            </label>
            <div className="flex-1">
              <label className="form-label text-xs">Caduca el (opcional)</label>
              <input type="date" className="input-field py-1 text-sm" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setEditNotice(null); resetForm() }} className="btn-secondary text-sm py-1.5">Cancelar</button>
            <button
              className="btn-primary text-sm flex items-center gap-1.5 py-1.5"
              disabled={!form.title.trim() || !form.content.trim()}
              onClick={() => {
                const payload = { ...form, expiresAt: form.expiresAt || undefined }
                if (editNotice) {
                  updateMutation.mutate({ id: editNotice.id, data: payload })
                } else {
                  createMutation.mutate(payload)
                }
              }}
            >
              <Save className="w-3.5 h-3.5" />
              {editNotice ? 'Actualizar' : 'Publicar'}
            </button>
          </div>
        </div>
      )}

      {/* Notices list */}
      {notices.length === 0 ? (
        <div className="bg-smc-card border border-smc-border rounded-xl p-6 text-center text-smc-muted text-sm">
          No hay avisos publicados.
        </div>
      ) : (
        <div className="space-y-2">
          {notices.map(notice => (
            <div key={notice.id} className={`bg-smc-card border rounded-xl p-4 ${notice.pinned ? 'border-primary/30' : 'border-smc-border'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {notice.pinned && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                        <Pin className="w-3 h-3" /> FIJADO
                      </span>
                    )}
                    <span className="text-sm font-semibold text-white">{notice.title}</span>
                  </div>
                  <p className="text-sm text-smc-text whitespace-pre-line">{notice.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-smc-muted">
                    <span>{notice.authorName}</span>
                    <span>·</span>
                    <span>{new Date(notice.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    {notice.expiresAt && (
                      <>
                        <span>·</span>
                        <span>Caduca: {new Date(notice.expiresAt).toLocaleDateString('es-ES')}</span>
                      </>
                    )}
                  </div>
                </div>
                {manager && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(notice)} className="p-1.5 rounded-lg text-smc-muted hover:text-smc-text hover:bg-smc-border transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteConfirm(notice.id)} className="p-1.5 rounded-lg text-smc-muted hover:text-danger hover:bg-danger/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card border border-smc-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">¿Eliminar este aviso?</h3>
            <p className="text-sm text-smc-muted mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary text-sm py-1.5">Cancelar</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirm!)} disabled={deleteMutation.isPending} className="btn-danger text-sm py-1.5">
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
