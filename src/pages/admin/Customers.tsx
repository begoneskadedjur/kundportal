// src/pages/admin/Customers.tsx - Utökad med avtalsinformation
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Filter, Eye, Edit, Trash2, 
  Building2, User, Mail, Phone, Calendar,
  DollarSign, FileText, Users, MapPin
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import { customerService } from '../../services/customerService'
import type { Customer } from '../../types/database'
import toast from 'react-hot-toast'

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [contractFilter, setContractFilter] = useState<'all' | 'with_contracts' | 'without_contracts'>('all')
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalAnnualRevenue: 0,
    totalContractValue: 0,
    averageContractValue: 0
  })

  useEffect(() => {
    fetchCustomers()
    fetchStats()
  }, [])

  const fetchCustomers = async () => {
    try {
      const data = await customerService.getCustomers()
      setCustomers(data)
    } catch (