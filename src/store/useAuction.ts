import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { listone } from '../lib/listone'
import type { Pick, Role, Settings, Team } from '../types'

// v2: il listone e' cambiato sorgente e gli id giocatore con lui, quindi un
// salvataggio vecchio punterebbe a giocatori sbagliati.
export const STORAGE_KEY = 'fantadash.v2'

// I default vengono dalla taratura con cui e' costruito il listone: 500
// crediti, 10 squadre, 3-8-8-6. Cambiandoli in Impostazioni i prezzi
// consigliati del workbook restano quelli, il listino dinamico invece segue.
const DEFAULT_SETTINGS: Settings = {
  lega: 'La mia lega',
  budget: listone.parametri.budget,
  slots: listone.parametri.slots,
  temperatura: 'normale',
}

// Le squadre della lega su cui e' tarato il listone: si aggiungono e
// togliono in Impostazioni.
const DEFAULT_TEAMS: Team[] = Array.from({ length: listone.parametri.squadre }, (_, i) => ({
  id: `t${i + 1}`,
  nome: `Squadra ${i + 1}`,
}))

export interface Snapshot {
  settings: Settings
  teams: Team[]
  picks: Pick[]
  myTeamId: string | null
  /** Giocatori marcati come obiettivi, tipicamente da un piano rosa. */
  targetIds: number[]
  /** Prezzo atteso corretto a mano, per id giocatore. Vince su tutto il resto. */
  priceOverrides: Record<number, number>
}

interface AuctionState extends Snapshot {
  /** Stack per l'undo, dal piu recente. Non persistito. */
  undoStack: Snapshot[]

  setSettings: (patch: Partial<Settings>) => void
  setSlots: (patch: Partial<Record<Role, number>>) => void

  addTeam: (nome?: string) => void
  updateTeam: (id: string, patch: Partial<Omit<Team, 'id'>>) => void
  removeTeam: (id: string) => void
  setMyTeam: (id: string | null) => void

  setTargets: (ids: number[]) => void
  toggleTarget: (id: number) => void
  clearTargets: () => void

  setPriceOverride: (playerId: number, price: number | null) => void
  clearPriceOverrides: () => void

  assign: (playerId: number, teamId: string, price: number) => void
  unassign: (playerId: number) => void
  undo: () => void

  resetPicks: () => void
  resetAll: () => void
  loadSnapshot: (s: Snapshot) => void
  snapshot: () => Snapshot
}

const UNDO_LIMIT = 100

export const useAuction = create<AuctionState>()(
  persist(
    (set, get) => {
      /** Applica una mutazione salvando lo stato precedente per l'undo. */
      const mutate = (fn: (s: AuctionState) => Partial<Snapshot>) =>
        set((s) => {
          const before: Snapshot = {
            settings: s.settings,
            teams: s.teams,
            picks: s.picks,
            myTeamId: s.myTeamId,
            targetIds: s.targetIds,
            priceOverrides: s.priceOverrides,
          }
          return { ...fn(s), undoStack: [before, ...s.undoStack].slice(0, UNDO_LIMIT) }
        })

      return {
        settings: DEFAULT_SETTINGS,
        teams: DEFAULT_TEAMS,
        picks: [],
        myTeamId: DEFAULT_TEAMS[0].id,
        targetIds: [],
        priceOverrides: {},
        undoStack: [],

        setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        setSlots: (patch) => set((s) => ({ settings: { ...s.settings, slots: { ...s.settings.slots, ...patch } } })),

        addTeam: (nome) =>
          set((s) => {
            const n = s.teams.length + 1
            const id = `t${Date.now().toString(36)}`
            return { teams: [...s.teams, { id, nome: nome?.trim() || `Squadra ${n}` }] }
          }),

        updateTeam: (id, patch) =>
          set((s) => ({ teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

        removeTeam: (id) =>
          mutate((s) => ({
            teams: s.teams.filter((t) => t.id !== id),
            picks: s.picks.filter((p) => p.teamId !== id),
            myTeamId: s.myTeamId === id ? null : s.myTeamId,
          })),

        setMyTeam: (id) => set({ myTeamId: id }),

        setTargets: (ids) => mutate(() => ({ targetIds: [...new Set(ids)] })),

        toggleTarget: (id) =>
          set((s) => ({
            targetIds: s.targetIds.includes(id)
              ? s.targetIds.filter((x) => x !== id)
              : [...s.targetIds, id],
          })),

        clearTargets: () => mutate(() => ({ targetIds: [] })),

        setPriceOverride: (playerId, price) =>
          set((s) => {
            const next = { ...s.priceOverrides }
            if (price == null || !Number.isFinite(price) || price <= 0) delete next[playerId]
            else next[playerId] = Math.round(price)
            return { priceOverrides: next }
          }),

        clearPriceOverrides: () => mutate(() => ({ priceOverrides: {} })),

        assign: (playerId, teamId, price) =>
          mutate((s) => ({
            picks: [
              ...s.picks.filter((p) => p.playerId !== playerId),
              { playerId, teamId, price: Math.max(0, Math.round(price)), ts: Date.now() },
            ],
          })),

        unassign: (playerId) => mutate((s) => ({ picks: s.picks.filter((p) => p.playerId !== playerId) })),

        undo: () =>
          set((s) => {
            const [prev, ...rest] = s.undoStack
            if (!prev) return s
            return { ...prev, undoStack: rest }
          }),

        resetPicks: () => mutate(() => ({ picks: [] })),

        resetAll: () =>
          set({
            settings: DEFAULT_SETTINGS,
            teams: DEFAULT_TEAMS,
            picks: [],
            myTeamId: DEFAULT_TEAMS[0].id,
            targetIds: [],
            priceOverrides: {},
            undoStack: [],
          }),

        loadSnapshot: (snap) =>
          mutate(() => ({
            settings: { ...DEFAULT_SETTINGS, ...snap.settings, slots: { ...DEFAULT_SETTINGS.slots, ...snap.settings?.slots } },
            teams: snap.teams ?? DEFAULT_TEAMS,
            picks: snap.picks ?? [],
            myTeamId: snap.myTeamId ?? null,
            targetIds: snap.targetIds ?? [],
            priceOverrides: snap.priceOverrides ?? {},
          })),

        snapshot: () => {
          const s = get()
          return {
            settings: s.settings,
            teams: s.teams,
            picks: s.picks,
            myTeamId: s.myTeamId,
            targetIds: s.targetIds,
            priceOverrides: s.priceOverrides,
          }
        },
      }
    },
    {
      name: STORAGE_KEY,
      partialize: (s) => ({
        settings: s.settings,
        teams: s.teams,
        picks: s.picks,
        myTeamId: s.myTeamId,
        targetIds: s.targetIds,
        priceOverrides: s.priceOverrides,
      }),
    },
  ),
)

/** Set degli id giocatore gia assegnati. */
export const takenIdsOf = (picks: Pick[]) => new Set(picks.map((p) => p.playerId))
