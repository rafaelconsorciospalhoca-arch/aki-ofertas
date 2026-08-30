'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOptionGroup, deleteOptionGroup, createOptionChoice, deleteOptionChoice } from '@/actions/offer-option-actions'
import { centsToReais } from '@/lib/money'

type Choice = { id: string; name: string; extraPriceCents: number }
type Group = { id: string; name: string; type: 'SINGLE' | 'MULTIPLE'; required: boolean; choices: Choice[] }

export function OfferOptionsManager({ offerId, groups }: { offerId: string; groups: Group[] }) {
  const router = useRouter()
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupType, setGroupType] = useState<'SINGLE' | 'MULTIPLE'>('SINGLE')
  const [groupRequired, setGroupRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [choiceForms, setChoiceForms] = useState<Record<string, { name: string; price: string }>>({})

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const result = await createOptionGroup({ offerId, name: groupName, type: groupType, required: groupRequired })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setGroupName('')
      setGroupType('SINGLE')
      setGroupRequired(false)
      setShowGroupForm(false)
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!window.confirm('Remover este grupo e todas as opções dele?')) return
    await deleteOptionGroup(groupId)
    router.refresh()
  }

  function updateChoiceForm(groupId: string, field: 'name' | 'price', value: string) {
    setChoiceForms((prev) => ({ ...prev, [groupId]: { ...(prev[groupId] ?? { name: '', price: '' }), [field]: value } }))
  }

  async function handleAddChoice(groupId: string) {
    const form = choiceForms[groupId] ?? { name: '', price: '' }
    if (!form.name.trim()) return
    setError(null)
    try {
      const result = await createOptionChoice({ groupId, name: form.name, extraPriceCents: form.price || undefined })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setChoiceForms((prev) => ({ ...prev, [groupId]: { name: '', price: '' } }))
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    }
  }

  async function handleDeleteChoice(choiceId: string) {
    await deleteOptionChoice(choiceId)
    router.refresh()
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-neutral-900">Opções de personalização</h2>
        {!showGroupForm && (
          <button
            type="button"
            onClick={() => setShowGroupForm(true)}
            className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-bold text-white"
          >
            + Novo grupo
          </button>
        )}
      </div>

      {showGroupForm && (
        <form onSubmit={handleAddGroup} className="flex max-w-sm flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Nome do grupo (ex: Sabor, Borda, Adicionais)
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} className={inputClass} required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Tipo
            <select value={groupType} onChange={(e) => setGroupType(e.target.value as 'SINGLE' | 'MULTIPLE')} className={inputClass}>
              <option value="SINGLE">Escolha única</option>
              <option value="MULTIPLE">Múltipla escolha</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input type="checkbox" checked={groupRequired} onChange={(e) => setGroupRequired(e.target.checked)} />
            Obrigatório
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white disabled:opacity-70"
            >
              {saving ? 'Salvando...' : 'Adicionar grupo'}
            </button>
            <button type="button" onClick={() => setShowGroupForm(false)} className="text-sm font-bold text-neutral-500">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum grupo de opção cadastrado ainda.</p>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-neutral-900">
                {group.name}{' '}
                <span className="font-normal text-neutral-400">
                  ({group.type === 'SINGLE' ? 'única escolha' : 'múltipla escolha'}
                  {group.required ? ', obrigatório' : ''})
                </span>
              </p>
              <button type="button" onClick={() => handleDeleteGroup(group.id)} className="text-xs font-bold text-red-600">
                Remover grupo
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {group.choices.map((choice) => (
                <div key={choice.id} className="flex items-center justify-between text-sm text-neutral-600">
                  <span>
                    {choice.name}
                    {choice.extraPriceCents > 0 ? ` (+R$ ${centsToReais(choice.extraPriceCents)})` : ''}
                  </span>
                  <button type="button" onClick={() => handleDeleteChoice(choice.id)} className="text-xs font-bold text-red-600">
                    Remover
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                placeholder="Nome da opção"
                value={choiceForms[group.id]?.name ?? ''}
                onChange={(e) => updateChoiceForm(group.id, 'name', e.target.value)}
                className={`${inputClass} flex-1`}
              />
              <input
                placeholder="Preço extra (R$)"
                value={choiceForms[group.id]?.price ?? ''}
                onChange={(e) => updateChoiceForm(group.id, 'price', e.target.value)}
                className={`${inputClass} w-32`}
              />
              <button
                type="button"
                onClick={() => handleAddChoice(group.id)}
                className="rounded-lg bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-700"
              >
                Adicionar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
