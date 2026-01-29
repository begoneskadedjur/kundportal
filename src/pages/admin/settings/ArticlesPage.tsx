// src/pages/admin/settings/ArticlesPage.tsx
// Wrapper-sida för artikelhantering

import { useEffect } from 'react'
import { ArticlesSettings } from '../../../components/admin/settings/ArticlesSettings'

export default function ArticlesPage() {
  useEffect(() => {
    document.title = 'Artiklar | BeGone Admin'
  }, [])

  return <ArticlesSettings />
}
