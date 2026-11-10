// src/pages/shared/intranet/guider/guide-rot-rut-offert-kontor.tsx
// Guidemodul: Skapa en ROT- eller RUT-offert, för kontoret (admin, koordinator och säljare, dator).
// Skärmarna ligger i _rotrut.tsx och delas med den andra rollens guide.
// Visningen och övningen går igenom ROT-mallen med Familjen Exempel (påhittad kund).

import { useState } from 'react'
import { Dator, OvningRam, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { ingenMk, mkFor } from './_nyvy_salja'
import { ROT_BORJA, ROT_ORDNING, ROT_START, ROT_VISNING, RotWizard, rotOvningTryck, type RotLage } from './_rotrut'

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = ROT_VISNING[Math.min(steg, ROT_VISNING.length - 1)]
  return (
    <Dator adress="koordinator › oneflow-contract-creator">
      <RotWizard l={v.lage} mk={mkFor(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
    </Dator>
  )
}

function Ovning() {
  const [l, setL] = useState<RotLage>(ROT_START)
  const [svar, setSvar] = useState<OvningSvar>(ROT_BORJA)
  const tryck = (id: string) => {
    const r = rotOvningTryck(l, id)
    if (!r) return
    if (r.lage) setL(r.lage)
    setSvar(r.svar)
  }
  return (
    <OvningRam bred framsteg={ROT_ORDNING.indexOf(l.vy)} totalt={ROT_ORDNING.length - 1} svar={svar} onBorjaOm={() => { setL(ROT_START); setSvar(ROT_BORJA) }}>
      <Dator adress="koordinator › oneflow-contract-creator">
        <RotWizard l={l} mk={ingenMk} tryck={tryck} />
      </Dator>
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
