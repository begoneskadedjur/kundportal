import { useState } from 'react'

export function useClickUpSync() {
  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const testClickUp = async () => {
    setTesting(true)
    try {
      console.log('Testing ClickUp connection via backend...')
      
      const response = await fetch('/api/test/clickup', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()
      
      if (result.success) {
        console.log('✅ ClickUp Test Results:', result)
        console.log('📋 Available Lists:')
        result.clickup.lists?.forEach((list: any) => {
          console.log(`  - ${list.name} (ID: ${list.id})`)
        })
        
        return {
          success: true,
          teams: result.clickup.teams,
          lists: result.clickup.lists,
          message: 'ClickUp connection successful! Check console for available lists.'
        }
      } else {
        console.error('❌ ClickUp Test Failed:', result.error)
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('❌ Test error:', error)
      return { success: false, error: error.message }
    } finally {
      setTesting(false)
    }
  }

  const syncTasks = async (listId: string, customerName?: string) => {
    setSyncing(true)
    try {
      console.log(`Starting sync for list ${listId}${customerName ? ` (${customerName})` : ''}`)
      
      const response = await fetch('/api/sync/clickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          listId,
          customerName // Optional, för debugging
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setLastSync(new Date())
        console.log('✅ Sync Results:', result.summary)
        
        if (result.errors && result.errors.length > 0) {
          console.warn('⚠️ Some tasks had errors:', result.errors)
        }
        
        return { 
          success: true, 
          count: result.summary.totalTasks,
          created: result.summary.created,
          updated: result.summary.updated,
          skipped: result.summary.skipped,
          errors: result.summary.errors,
          message: result.message
        }
      } else {
        console.error('❌ Sync Failed:', result.error)
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('❌ Sync error:', error)
      return { success: false, error: error.message }
    } finally {
      setSyncing(false)
    }
  }

  // Sync multiple lists (för framtida användning)
  const syncMultipleLists = async (listConfigs: Array<{listId: string, customerName?: string}>) => {
    const results = []
    
    for (const config of listConfigs) {
      const result = await syncTasks(config.listId, config.customerName)
      results.push({
        listId: config.listId,
        customerName: config.customerName,
        ...result
      })
      
      // Kort paus mellan syncs för att inte överbelasta API
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    return results
  }

  return {
    syncTasks,
    syncMultipleLists,
    testClickUp,
    syncing,
    testing,
    lastSync
  }
}