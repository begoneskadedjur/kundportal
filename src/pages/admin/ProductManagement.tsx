// src/pages/admin/ProductManagement.tsx - Admin produkthantering sida

import React, { useEffect } from 'react'
import ProductManagement from '../../components/admin/ProductManagement'

export default function ProductManagementPage() {
  // Sätt sidtitel
  useEffect(() => {
    document.title = 'Produkthantering - BeGone Admin'
  }, [])

  return (
    <div className="container mx-auto px-4 py-6">
      <ProductManagement />
    </div>
  )
}