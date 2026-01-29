// src/pages/admin/settings/PriceListsPage.tsx
// Wrapper-sida för prislistehantering

import { useEffect } from 'react'
import { PriceListsSettings } from '../../../components/admin/settings/PriceListsSettings'

export default function PriceListsPage() {
  useEffect(() => {
    document.title = 'Prislistor | BeGone Admin'
  }, [])

  return <PriceListsSettings />
}
