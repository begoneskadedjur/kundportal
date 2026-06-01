import React, { useState, useEffect, useCallback } from 'react'
import {
  MapPin, Check, ChevronRight, Plus, Trash2,
  Building2, ArrowLeft, ArrowRight, AlertCircle, CheckCircle,
} from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'
import BoundariesMapPanel, { type PanelRegion } from './BoundariesMapPanel'
import { REGION_COLORS } from './ConvertToRegionalCustomerModal'

interface ManageRegionsCustomer {
  id: string
  name: string
  site_name?: string | null
  region?: string | null
  site_type?: string | null
  organization_id?: string | null
}

interface ManageRegionsModalProps {
  organization: {
    id: string
    name: string
    customers: ManageRegionsCustomer[]
  }
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type Step = 'regions' | 'boundaries' | 'confirm'

interface RegionEntry extends PanelRegion {
  /** ID from DB — null if newly added */
  dbId: string | null
  markedForDeletion: boolean
}

interface Station {
  id: string
  latitude: number
  longitude: number
  assignedRegionTempId: string | null
}

export default function ManageRegionsModal({
  organization,
  isOpen,
  onClose,
  onSuccess,
}: ManageRegionsModalProps) {
  const [step, setStep] = useState<Step>('regions')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [regions, setRegions] = useState<RegionEntry[]>([])
  const [stations, setStations] = useState<Station[]>([])

  // Form state for new region
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newColorIndex, setNewColorIndex] = useState(0)
  const [formError, setFormError] = useState('')

  // Derive hoofdkontor from customers list
  const hoofdkontor = organization.customers.find(c => c.site_type === 'hoofdkontor' || c.site_type === 'huvudkontor')
  const hoofdkontorId = hoofdkontor?.id ?? organization.id

  // Load existing enhet regions and their polygons on open
  useEffect(() => {
    if (!isOpen) return
    loadExistingData()
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadExistingData = async () => {
    setInitializing(true)
    try {
      // Load enhet-rows
      const enhetRows = organization.customers.filter(c => c.site_type === 'enhet')

      // Load polygons for these enheter
      let polygonMap: Record<string, Array<{ lat: number; lng: number }>> = {}
      let colorMap: Record<string, string> = {}
      if (enhetRows.length > 0) {
        const enhetIds = enhetRows.map(e => e.id)
        const { data: polyData } = await supabase
          .from('customer_regions')
          .select('customer_id, geojson_polygon, color')
          .in('customer_id', enhetIds)

        if (polyData) {
          polyData.forEach(p => {
            const coords: number[][] = p.geojson_polygon?.coordinates?.[0] || []
            // GeoJSON is [lng, lat] — convert to {lat, lng}
            polygonMap[p.customer_id] = coords.map(([lng, lat]) => ({ lat, lng }))
            colorMap[p.customer_id] = p.color
          })
        }
      }

      const usedColors = new Set<string>()
      const initialRegions: RegionEntry[] = enhetRows.map((e, i) => {
        const color = colorMap[e.id] || REGION_COLORS[i % REGION_COLORS.length]
        usedColors.add(color)
        return {
          tempId: e.id,
          dbId: e.id,
          site_name: e.site_name || e.name,
          region: e.region || '',
          color,
          polygon: polygonMap[e.id] || null,
          markedForDeletion: false,
          stationCount: 0,
        }
      })
      setRegions(initialRegions)

      // Find next unused color for new regions
      const nextIdx = REGION_COLORS.findIndex(c => !usedColors.has(c))
      setNewColorIndex(nextIdx >= 0 ? nextIdx : 0)

      // Load all stations for this organization via customer_id IN (alla enheter + huvudkontor)
      const allCustomerIds = organization.customers.map(c => c.id)
      if (allCustomerIds.length > 0) {
        const { data: stationData } = await supabase
          .from('equipment_placements')
          .select('id, latitude, longitude, customer_id')
          .in('customer_id', allCustomerIds)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)

        if (stationData) {
          const customerIdToTempId: Record<string, string> = {}
          initialRegions.forEach(r => {
            if (r.dbId) customerIdToTempId[r.dbId] = r.tempId
          })
          setStations(
            stationData.map(s => ({
              id: s.id,
              latitude: s.latitude as number,
              longitude: s.longitude as number,
              assignedRegionTempId: customerIdToTempId[s.customer_id] ?? null,
            }))
          )
        }
      }
    } catch (err: any) {
      console.error('ManageRegionsModal load error:', err)
      toast.error('Kunde inte ladda regiondata')
    } finally {
      setInitializing(false)
    }
  }

  const reset = () => {
    setStep('regions')
    setRegions([])
    setStations([])
    setNewName('')
    setNewCode('')
    setFormError('')
  }

  const handleClose = () => {
    if (loading) return
    reset()
    onClose()
  }

  const addRegion = () => {
    if (!newName.trim()) { setFormError('Regionnamn krävs'); return }
    if (!newCode.trim()) { setFormError('Regionkod krävs'); return }
    setFormError('')
    const color = REGION_COLORS[newColorIndex % REGION_COLORS.length]
    setRegions(prev => [...prev, {
      tempId: crypto.randomUUID(),
      dbId: null,
      site_name: newName.trim(),
      region: newCode.trim(),
      color,
      polygon: null,
      markedForDeletion: false,
      stationCount: 0,
    }])
    setNewName('')
    setNewCode('')
    setNewColorIndex(prev => (prev + 1) % REGION_COLORS.length)
  }

  const toggleDelete = (tempId: string) => {
    setRegions(prev => prev.map(r =>
      r.tempId === tempId ? { ...r, markedForDeletion: !r.markedForDeletion } : r
    ))
  }

  const removeNew = (tempId: string) => {
    setRegions(prev => prev.filter(r => r.tempId !== tempId))
  }

  const handlePolygonSaved = useCallback((tempId: string, path: Array<{ lat: number; lng: number }> | null) => {
    setRegions(prev => prev.map(r => r.tempId === tempId ? { ...r, polygon: path } : r))
  }, [])

  // Compute point-in-polygon assignment for stations
  const computeStationAssignment = useCallback((): Array<{ stationId: string; assignedCustomerId: string }> => {
    const activeRegions = regions.filter(r => !r.markedForDeletion && r.polygon && r.polygon.length >= 3)
    return stations.map(s => {
      let matchedCustomerId = hoofdkontorId
      for (const region of activeRegions) {
        if (!region.polygon) continue
        const googlePoly = new google.maps.Polygon({ paths: region.polygon })
        const inPoly = google.maps.geometry.poly.containsLocation(
          new google.maps.LatLng(s.latitude, s.longitude),
          googlePoly
        )
        if (inPoly) {
          // dbId for existing regions, or we'll assign it after INSERT
          matchedCustomerId = region.dbId || hoofdkontorId
          break
        }
      }
      return { stationId: s.id, assignedCustomerId: matchedCustomerId }
    })
  }, [regions, stations, hoofdkontorId])

  // Compute station counts per region for confirm step
  const regionStationCounts = useCallback(() => {
    const activeRegions = regions.filter(r => !r.markedForDeletion && r.polygon && r.polygon.length >= 3)
    const counts: Record<string, number> = {}
    let unassigned = 0

    stations.forEach(s => {
      let matched = false
      for (const region of activeRegions) {
        if (!region.polygon) continue
        const googlePoly = new google.maps.Polygon({ paths: region.polygon })
        const inPoly = google.maps.geometry.poly.containsLocation(
          new google.maps.LatLng(s.latitude, s.longitude),
          googlePoly
        )
        if (inPoly) {
          counts[region.tempId] = (counts[region.tempId] || 0) + 1
          matched = true
          break
        }
      }
      if (!matched) unassigned++
    })
    return { counts, unassigned }
  }, [regions, stations])

  const handleSave = async () => {
    setLoading(true)
    try {
      const toDelete = regions.filter(r => r.markedForDeletion && r.dbId)
      const toKeep = regions.filter(r => !r.markedForDeletion)
      const toCreate = toKeep.filter(r => r.dbId === null)
      const orgId = organization.customers[0]?.organization_id

      if (!orgId) throw new Error('organization_id saknas')

      // 1. Create new enhet-rows (moved: delete happens after station reassignment)
      let newDbIds: Record<string, string> = {}
      if (toCreate.length > 0) {
        const hoofdkontorRow = organization.customers.find(c =>
          c.site_type === 'hoofdkontor' || c.site_type === 'huvudkontor'
        )
        const toInsert = toCreate.map(r => ({
          company_name: `${organization.name} — ${r.site_name}`,
          contact_email: `region-${r.region.toLowerCase().replace(/\s+/g, '-')}@intern.begone.se`,
          site_name: r.site_name,
          region: r.region,
          organization_id: orgId,
          parent_customer_id: hoofdkontorId,
          is_multisite: true,
          is_regional: true,
          site_type: 'enhet' as const,
          contract_type: null,
          contract_status: 'active' as const,
          is_active: true,
          source_type: 'manual' as const,
        }))

        const { data: inserted, error: insertErr } = await supabase
          .from('customers')
          .insert(toInsert)
          .select('id, site_name, region')
        if (insertErr) throw insertErr

        inserted?.forEach(row => {
          const match = toCreate.find(r => r.site_name === row.site_name && r.region === row.region)
          if (match) newDbIds[match.tempId] = row.id
        })
      }

      // Build final tempId → dbId map for all kept regions
      const tempToDb: Record<string, string> = {}
      toKeep.forEach(r => {
        const dbId = r.dbId ?? newDbIds[r.tempId]
        if (dbId) tempToDb[r.tempId] = dbId
      })

      // 3. Upsert polygons: delete existing for kept regions, then re-insert
      const allKeptDbIds = Object.values(tempToDb)
      if (allKeptDbIds.length > 0) {
        await supabase.from('customer_regions').delete().in('customer_id', allKeptDbIds)
        const polyInserts = toKeep
          .filter(r => r.polygon && r.polygon.length >= 3)
          .map(r => {
            const dbId = tempToDb[r.tempId]
            if (!dbId) return null
            const coords = r.polygon!.map(p => [p.lng, p.lat])
            coords.push(coords[0]) // close ring
            return {
              customer_id: dbId,
              geojson_polygon: { type: 'Polygon', coordinates: [coords] },
              color: r.color,
              opacity: 0.2,
            }
          })
          .filter(Boolean) as any[]

        if (polyInserts.length > 0) {
          const { error: polyErr } = await supabase.from('customer_regions').insert(polyInserts)
          if (polyErr) {
            console.error('Polygon insert error:', polyErr)
            toast('Regiongränser kunde inte sparas men övriga ändringar lyckades.', { icon: '⚠️' })
          }
        }
      }

      // 4. Assign stations via point-in-polygon
      const activeRegionsForAssign = toKeep.filter(r => r.polygon && r.polygon.length >= 3)

      // Batch: assign each station to matching region or fallback to huvudkontor
      const updates: Array<{ id: string; customer_id: string }> = stations.map(s => {
        let matchedCustomerId = hoofdkontorId
        for (const region of activeRegionsForAssign) {
          if (!region.polygon) continue
          const googlePoly = new google.maps.Polygon({ paths: region.polygon })
          const inPoly = google.maps.geometry.poly.containsLocation(
            new google.maps.LatLng(s.latitude, s.longitude),
            googlePoly
          )
          if (inPoly) {
            matchedCustomerId = tempToDb[region.tempId] || hoofdkontorId
            break
          }
        }
        return { id: s.id, customer_id: matchedCustomerId }
      })

      // Group by target customer_id for batched updates
      const byCustomer: Record<string, string[]> = {}
      updates.forEach(u => {
        if (!byCustomer[u.customer_id]) byCustomer[u.customer_id] = []
        byCustomer[u.customer_id].push(u.id)
      })

      for (const [customerId, stationIds] of Object.entries(byCustomer)) {
        const { error: updateErr } = await supabase
          .from('equipment_placements')
          .update({ customer_id: customerId })
          .in('id', stationIds)
        if (updateErr) {
          console.error('Station assignment error:', updateErr)
          toast('Vissa stationer kunde inte tilldelas region.', { icon: '⚠️' })
        }
      }

      // 4. Delete removed regions (after station reassignment so FK refs are gone)
      if (toDelete.length > 0) {
        const deleteIds = toDelete.map(r => r.dbId!)
        await supabase.from('customer_regions').delete().in('customer_id', deleteIds)
        await supabase.from('customers').delete().in('id', deleteIds)
      }

      toast.success(`Regioner sparade! ${updates.length} stationer tilldelade.`)
      onSuccess()
      handleClose()
    } catch (err: any) {
      console.error('ManageRegionsModal save error:', err)
      toast.error(err.message || 'Kunde inte spara regioner')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { key: 'regions' as Step, label: '1. Regioner' },
    { key: 'boundaries' as Step, label: '2. Gränser' },
    { key: 'confirm' as Step, label: '3. Bekräfta' },
  ]
  const stepIndex = steps.findIndex(s => s.key === step)

  const activeRegions = regions.filter(r => !r.markedForDeletion)
  const stationCounts = step === 'confirm' ? regionStationCounts() : null

  const footer = (
    <div className="flex items-center justify-between px-4 py-2.5">
      <Button
        variant="ghost"
        onClick={() => {
          if (step === 'regions') handleClose()
          else if (step === 'boundaries') setStep('regions')
          else setStep('boundaries')
        }}
        disabled={loading}
        className="flex items-center gap-1.5"
      >
        <ArrowLeft className="w-4 h-4" />
        {step === 'regions' ? 'Avbryt' : 'Tillbaka'}
      </Button>
      <div className="flex items-center gap-2">
        {step === 'regions' && (
          <Button
            variant="primary"
            onClick={() => {
              if (activeRegions.length < 1) {
                toast.error('Minst 1 region krävs')
                return
              }
              setStep('boundaries')
            }}
            className="flex items-center gap-1.5"
          >
            Nästa
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
        {step === 'boundaries' && (
          <>
            <Button
              variant="ghost"
              onClick={() => setStep('confirm')}
              className="text-slate-400 hover:text-white"
            >
              Hoppa över
            </Button>
            <Button
              variant="primary"
              onClick={() => setStep('confirm')}
              className="flex items-center gap-1.5"
            >
              Nästa
              <ArrowRight className="w-4 h-4" />
            </Button>
          </>
        )}
        {step === 'confirm' && (
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? <LoadingSpinner /> : <CheckCircle className="w-4 h-4" />}
            Spara regioner
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Hantera regioner — ${organization.name}`}
      size="full"
      preventClose={loading}
      footer={footer}
    >
      {/* Step indicator */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                  step === s.key
                    ? 'bg-[#20c58f] text-white'
                    : stepIndex > i
                    ? 'bg-[#20c58f]/20 text-[#20c58f]'
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {stepIndex > i ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={`text-xs ${step === s.key ? 'text-white font-medium' : 'text-slate-500'}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600 mx-2" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {initializing ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner text="Laddar regiondata..." />
          </div>
        ) : (
          <>
            {/* ── STEG 1: REGIONER ── */}
            {step === 'regions' && (
              <>
                {regions.length > 0 && (
                  <div className="space-y-2">
                    {regions.map(r => (
                      <div
                        key={r.tempId}
                        className={`flex items-center gap-3 px-3 py-2 border rounded-xl transition-opacity ${
                          r.markedForDeletion
                            ? 'opacity-40 bg-red-900/10 border-red-800/30 line-through'
                            : 'bg-slate-800/20 border-slate-700/50'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{r.site_name}</p>
                          <p className="text-xs text-slate-400">Kod: {r.region}</p>
                        </div>
                        {r.dbId ? (
                          <button
                            onClick={() => toggleDelete(r.tempId)}
                            className={`p-1 transition-colors ${r.markedForDeletion ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-red-400'}`}
                            title={r.markedForDeletion ? 'Ångra borttagning' : 'Markera för borttagning'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => removeNew(r.tempId)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {regions.some(r => r.markedForDeletion) && (
                  <div className="flex items-start gap-2 p-3 bg-red-900/10 border border-red-800/30 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400">
                      {regions.filter(r => r.markedForDeletion).length} region(er) markerade för borttagning.
                      Stationer i dessa regioner tilldelas tillbaka till huvudkontoret.
                    </p>
                  </div>
                )}

                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-slate-400" />
                    Lägg till region
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Regionnamn"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="T.ex. Region Nord"
                      onKeyDown={e => e.key === 'Enter' && addRegion()}
                    />
                    <Input
                      label="Regionkod"
                      value={newCode}
                      onChange={e => setNewCode(e.target.value)}
                      placeholder="T.ex. Nord"
                      onKeyDown={e => e.key === 'Enter' && addRegion()}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Regionfärg på karta</label>
                    <div className="flex items-center gap-2">
                      {REGION_COLORS.map((color, i) => (
                        <button
                          key={color}
                          onClick={() => setNewColorIndex(i)}
                          className={`w-6 h-6 rounded-full transition-transform ${newColorIndex === i ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : 'hover:scale-105'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  {formError && <p className="text-xs text-red-400">{formError}</p>}
                  <Button variant="secondary" size="sm" onClick={addRegion} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Lägg till
                  </Button>
                </div>
              </>
            )}

            {/* ── STEG 2: GRÄNSER ── */}
            {step === 'boundaries' && (
              <div className="space-y-3">
                {/* Region-hantering inline */}
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    Regioner ({activeRegions.length})
                  </h3>

                  {/* Befintliga regioner */}
                  {regions.length > 0 && (
                    <div className="space-y-1.5">
                      {regions.map(r => (
                        <div
                          key={r.tempId}
                          className={`flex items-center gap-2 px-2.5 py-1.5 border rounded-lg transition-opacity ${
                            r.markedForDeletion
                              ? 'opacity-40 bg-red-900/10 border-red-800/30 line-through'
                              : 'bg-slate-800/40 border-slate-700/50'
                          }`}
                        >
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                          <span className="flex-1 text-xs text-white truncate">{r.site_name}</span>
                          <span className="text-xs text-slate-500">{r.region}</span>
                          {r.dbId ? (
                            <button
                              onClick={() => toggleDelete(r.tempId)}
                              className={`p-0.5 transition-colors ${r.markedForDeletion ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-red-400'}`}
                              title={r.markedForDeletion ? 'Ångra borttagning' : 'Markera för borttagning'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => removeNew(r.tempId)}
                              className="p-0.5 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lägg till ny region — kompakt inline */}
                  <div className="flex items-end gap-2 flex-wrap">
                    <div className="flex-1 min-w-[120px]">
                      <Input
                        label="Regionnamn"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="T.ex. Region Nord"
                        onKeyDown={e => e.key === 'Enter' && addRegion()}
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        label="Regionkod"
                        value={newCode}
                        onChange={e => setNewCode(e.target.value)}
                        placeholder="T.ex. Nord"
                        onKeyDown={e => e.key === 'Enter' && addRegion()}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 pb-0.5">
                      {REGION_COLORS.map((color, i) => (
                        <button
                          key={color}
                          onClick={() => setNewColorIndex(i)}
                          className={`w-5 h-5 rounded-full transition-transform ${newColorIndex === i ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800 scale-110' : 'hover:scale-105'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <Button variant="secondary" size="sm" onClick={addRegion} className="flex items-center gap-1.5 pb-0.5">
                      <Plus className="w-3.5 h-3.5" />
                      Lägg till
                    </Button>
                  </div>
                  {formError && <p className="text-xs text-red-400">{formError}</p>}
                </div>

                <BoundariesMapPanel
                  regions={activeRegions}
                  onPolygonSaved={handlePolygonSaved}
                  stations={stations}
                />
              </div>
            )}

            {/* ── STEG 3: BEKRÄFTA ── */}
            {step === 'confirm' && stationCounts && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#20c58f]" />
                    <span className="text-sm font-semibold text-white">{organization.name}</span>
                  </div>
                  <div className="space-y-2">
                    {activeRegions.map(r => (
                      <div key={r.tempId} className="flex items-center gap-3 px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-lg">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                        <div className="flex-1">
                          <span className="text-sm text-white">{r.site_name}</span>
                          <span className="text-xs text-slate-500 ml-2">({r.region})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">
                            {stationCounts.counts[r.tempId] ?? 0} stationer
                          </span>
                          {r.polygon && r.polygon.length >= 3 ? (
                            <span className="text-xs text-[#20c58f] flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Gräns ritad
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Ingen gräns</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {stationCounts.unassigned > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-amber-900/10 border border-amber-800/30 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400">
                      {stationCounts.unassigned} stationer utan regionmatchning — dessa kopplas till huvudkontoret.
                    </p>
                  </div>
                )}

                <div className="p-3 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl">
                  <div className="flex items-start gap-2 text-xs text-slate-300">
                    <MapPin className="w-4 h-4 text-[#20c58f] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-white mb-1">Vad händer?</p>
                      <ul className="space-y-1 text-slate-400">
                        {regions.filter(r => r.markedForDeletion).length > 0 && (
                          <li>• {regions.filter(r => r.markedForDeletion).length} region(er) tas bort</li>
                        )}
                        {activeRegions.filter(r => r.dbId === null).length > 0 && (
                          <li>• {activeRegions.filter(r => r.dbId === null).length} ny(a) region(er) skapas</li>
                        )}
                        <li>• Regiongränser sparas på kartan</li>
                        <li>• {stations.length} stationer tilldelas rätt region via polygonmatchning</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
