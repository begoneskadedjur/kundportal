// api/test-clickup.ts - SIMPLIFIED AND FIXED VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Sätt CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Returnera HTML-sida för enkel testning (endast GET utan parametrar)
  if (req.method === 'GET' && !req.query.list_id && !req.query.task_id) {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>ClickUp API Test - Fixed</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    .test-form { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .result { background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; white-space: pre-wrap; font-family: monospace; font-size: 12px; }
    .error { background: #ffe8e8; color: #d00; }
    input, button { padding: 10px; margin: 5px; }
    button { background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>ClickUp API Test</h1>
  
  <div class="test-form">
    <h3>Test 1: Hämta tasks från List</h3>
    <input type="text" id="listId" placeholder="List ID" value="901210684656" style="width: 300px;">
    <button onclick="testList()">Testa List</button>
  </div>

  <div class="test-form">
    <h3>Test 2: Analysera specifik Task</h3>
    <input type="text" id="taskId" placeholder="Task ID" style="width: 300px;">
    <button onclick="testTask()">Analysera Task</button>
  </div>

  <div id="result"></div>

  <script>
    async function testList() {
      const listId = document.getElementById('listId').value;
      if (!listId) return alert('Ange List ID');

      const resultDiv = document.getElementById('result');
      resultDiv.innerHTML = 'Hämtar data...';
      
      try {
        const response = await fetch('/api/test-clickup?list_id=' + listId);
        const data = await response.json();
        
        resultDiv.className = response.ok ? 'result' : 'result error';
        resultDiv.innerHTML = JSON.stringify(data, null, 2);
        
        if (data.tasks) {
          let html = '<h3>Hittade Tasks:</h3>';
          data.tasks.forEach(task => {
            html += '<button onclick="setTaskId(\'' + task.id + '\')" style="margin: 5px; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">' + task.name + '</button><br>';
          });
          resultDiv.innerHTML += html;
        }
      } catch (error) {
        resultDiv.className = 'result error';
        resultDiv.innerHTML = 'Error: ' + error.message;
      }
    }

    function setTaskId(taskId) {
      document.getElementById('taskId').value = taskId;
      testTask();
    }

    async function testTask() {
      const taskId = document.getElementById('taskId').value;
      if (!taskId) return alert('Ange Task ID');

      const resultDiv = document.getElementById('result');
      resultDiv.innerHTML = 'Analyserar task...';

      try {
        const response = await fetch('/api/test-clickup?task_id=' + taskId);
        const data = await response.json();
        
        resultDiv.className = response.ok ? 'result' : 'result error';
        resultDiv.innerHTML = JSON.stringify(data, null, 2);
      } catch (error) {
        resultDiv.className = 'result error';
        resultDiv.innerHTML = 'Error: ' + error.message;
      }
    }
  </script>
</body>
</html>`
    
    return res.status(200).send(html)
  }

  // Kontrollera att vi har API token
  if (!CLICKUP_API_TOKEN) {
    return res.status(500).json({ 
      error: 'CLICKUP_API_TOKEN not configured',
      hint: 'Lägg till CLICKUP_API_TOKEN i environment variables'
    })
  }

  // Test enskild task
  if (req.query.task_id) {
    const taskId = req.query.task_id as string
    
    try {
      const taskResponse = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
      })

      if (!taskResponse.ok) {
        const errorText = await taskResponse.text()
        return res.status(taskResponse.status).json({
          error: `ClickUp API error: ${taskResponse.status}`,
          details: errorText,
          task_id: taskId
        })
      }

      const taskData = await taskResponse.json()

      // Analysera custom fields
      const customFields = taskData.custom_fields || []
      const analysis = {
        task_id: taskId,
        task_name: taskData.name,
        task_status: taskData.status?.status,
        task_description: taskData.description,
        task_url: taskData.url,
        created_date: taskData.date_created,
        updated_date: taskData.date_updated,
        assignees: taskData.assignees?.map((a: any) => ({
          id: a.id,
          username: a.username,
          email: a.email
        })) || [],
        custom_fields: customFields.map((field: any) => ({
          id: field.id,
          name: field.name,
          type: field.type,
          value: field.value,
          has_value: field.value !== null && field.value !== undefined && field.value !== ''
        })),
        suggested_mappings: {
          address_fields: customFields.filter((f: any) => 
            f.name?.toLowerCase().includes('address') || 
            f.name?.toLowerCase().includes('adress') ||
            f.name?.toLowerCase().includes('plats') ||
            f.name?.toLowerCase().includes('location')
          ),
          price_fields: customFields.filter((f: any) => 
            f.name?.toLowerCase().includes('pris') || 
            f.name?.toLowerCase().includes('price') ||
            f.type === 'currency'
          ),
          file_fields: customFields.filter((f: any) => 
            f.type === 'attachment' ||
            f.name?.toLowerCase().includes('file') ||
            f.name?.toLowerCase().includes('bilaga')
          ),
          report_fields: customFields.filter((f: any) => 
            f.name?.toLowerCase().includes('rapport') ||
            f.name?.toLowerCase().includes('report') ||
            f.name?.toLowerCase().includes('beskrivning')
          )
        }
      }

      return res.status(200).json(analysis)

    } catch (error: any) {
      return res.status(500).json({
        error: 'Failed to fetch task',
        message: error.message,
        task_id: taskId
      })
    }
  }

  // Test list och hämta tasks
  if (req.query.list_id) {
    const listId = req.query.list_id as string
    
    try {
      // Hämta list information
      const listResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}`, {
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
      })

      let listData = null
      if (listResponse.ok) {
        listData = await listResponse.json()
      }

      // Hämta tasks
      const tasksResponse = await fetch(
        `https://api.clickup.com/api/v2/list/${listId}/task?include_closed=true&include_markdown_description=true`,
        {
          headers: {
            'Authorization': CLICKUP_API_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!tasksResponse.ok) {
        const errorText = await tasksResponse.text()
        return res.status(tasksResponse.status).json({
          error: `ClickUp API error: ${tasksResponse.status}`,
          details: errorText,
          list_id: listId
        })
      }

      const tasksData = await tasksResponse.json()

      // Samla alla unika custom fields
      const allCustomFields: any[] = []
      if (tasksData.tasks) {
        tasksData.tasks.forEach((task: any) => {
          if (task.custom_fields) {
            task.custom_fields.forEach((field: any) => {
              const existing = allCustomFields.find(f => f.id === field.id)
              if (!existing) {
                allCustomFields.push({
                  id: field.id,
                  name: field.name,
                  type: field.type,
                  sample_value: field.value
                })
              }
            })
          }
        })
      }

      const result = {
        success: true,
        list_id: listId,
        list_info: listData ? {
          id: listData.id,
          name: listData.name,
          task_count: listData.task_count
        } : null,
        tasks_count: tasksData.tasks?.length || 0,
        tasks: tasksData.tasks?.map((task: any) => ({
          id: task.id,
          name: task.name,
          status: task.status?.status,
          description: task.description,
          custom_fields_count: task.custom_fields?.length || 0
        })) || [],
        all_custom_fields: allCustomFields,
        suggested_field_mappings: {
          address: allCustomFields.filter(f => 
            f.name?.toLowerCase().includes('address') || 
            f.name?.toLowerCase().includes('adress') ||
            f.name?.toLowerCase().includes('plats')
          ),
          price: allCustomFields.filter(f => 
            f.name?.toLowerCase().includes('pris') || 
            f.type === 'currency'
          ),
          files: allCustomFields.filter(f => 
            f.type === 'attachment' ||
            f.name?.toLowerCase().includes('file')
          )
        }
      }

      return res.status(200).json(result)

    } catch (error: any) {
      return res.status(500).json({
        error: 'Failed to fetch list data',
        message: error.message,
        list_id: listId
      })
    }
  }

  return res.status(400).json({ 
    error: 'Missing parameters',
    hint: 'Ange antingen list_id eller task_id som query parameter'
  })
}