// src/pages/admin/ProductManagement.tsx - Admin produkthantering sida

import React from 'react'
import { Helmet } from 'react-helmet'
import ProductManagement from '../../components/admin/ProductManagement'

export default function ProductManagementPage() {
  return (
    <>
      <Helmet>
        <title>Produkthantering - BeGone Admin</title>
        <meta name="description" content="Hantera produkter och tjänster för avtal och offerter" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-6">
        <ProductManagement />
      </div>
    </>
  )
}