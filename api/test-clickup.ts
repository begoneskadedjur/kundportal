// api/test-clickup.ts - FIXED VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Returnera HTML-sida för enkel testning
  if (req.method === 'GET' && !req.query.list_id && !req.query.task_id) {
    const html = `
      <!DOCTYPE html>
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
        <h1>ClickUp API Test - Field Discovery</h1>
        
        <div class="test-form">
          <h3>Test 1: Hämta alla tasks från List ID</h3>
          <p>Ange List ID från customers tabellen:</p>
          <input type="text" id="listId" placeholder="Ange List ID" style="width: 300px;" value="901210684656">
          <button onclick="testList()">Testa List & Tasks</button>
        </div>

        <div class="test-form">
          <h3>Test 2: Detaljerad Task Analysis</h3>
          <p>Ange Task ID för detaljerad analys:</p>
          <input type="text" id="taskId" placeholder="Ange Task ID" style="width: 300px;">
          <button onclick="testTask()">Analysera Task</button>
        </div>

        <div id="result"></div>

        <script>
          async function testList() {
            const listId = document.getElementById('listId').value;
            if (!listId) {
              alert('Ange ett List ID');
              return;
            }

            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = 'Testing List & Tasks...';

            try {
              const response = await fetch('/api/test-clickup?list_id=' + listId);
              const data = await response.json();
              
              resultDiv.className = response.ok ? 'result' : 'result error';
              
              let html = '<h3>LIST & TASKS ANALYSIS</h3>';
              html += '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
              
              if (data.tests && data.tests.tasks_response && data.tests.tasks_response.tasks) {
                html += '<h4>FOUND TASKS (click to analyze):</h4>';
                data.tests.tasks_response.tasks.forEach(task => {
                  const buttonHtml = '<button onclick="setTaskId(\'' + task.id + '\')" style="margin: 5px; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">' + task.name + ' (ID: ' + task.id + ')</button><br>';
                  html += buttonHtml;
                });
              }
              
              resultDiv.innerHTML = html;
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
            if (!taskId) {
              alert('Ange ett Task ID');
              return;
            }

            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = 'Testing Task Details...';

            try {
              const response = await fetch('/api/test-clickup?task_id=' + taskId);
              const data = await response.json();
              
              resultDiv.className = response.ok ? 'result' : 'result error';
              resultDiv.innerHTML = '<h3>DETAILED TASK ANALYSIS</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
              resultDiv.className = 'result error';
              resultDiv.innerHTML = 'Error: ' + error.message;
            }
          }
        </script>
      </body>
      </html>
    `
    
    return res.status(200).send(html)
  }

  // Test enskild task med task_id
  if (req.query.task_id) {
    const { task_id } = req.query
    
    if (!CLICKUP_API_TOKEN) {
      return res.status(500).json({ error: 'CLICKUP_API_TOKEN not configured' })
    }
    
    try {
      console.log('Testing individual task:', task_id)

      const taskResponse = await fetch(
        `https://api.clickup.com/api/v2/task/${task_id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': CLICKUP_API_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!taskResponse.ok) {
        return res.status(taskResponse.status).json({
          error: `ClickUp API error: ${taskResponse.status} ${taskResponse.statusText}`,
          task_id: task_id
        })
      }

      const taskData = await taskResponse.json()

      // Analysera alla custom fields
      const customFieldAnalysis = taskData.custom_fields?.map((field) => ({
        id: field.id,
        name: field.name,
        type: field.type,
        value: field.value,
        type_config: field.type_config,
        raw_field: field
      })) || []

      return res.status(200).json({
        success: true,
        task_id: task_id,
        task_analysis: {
          basic_info: {
            id: taskData.id,
            name: taskData.name,
            description: taskData.description,
            status: taskData.status,
            priority: taskData.priority,
            due_date: taskData.due_date,
            start_date: taskData.start_date,
            date_created: taskData.date_created,
            date_updated: taskData.date_updated,
            date_closed: taskData.date_closed,
            url: taskData.url
          },
          assignees: taskData.assignees?.map((a) => ({
            id: a.id,
            username: a.username,
            email: a.email,
            color: a.color,
            initials: a.initials,
            profilePicture: a.profilePicture
          })) || [],
          custom_fields_analysis: {
            total_fields: customFieldAnalysis.length,
            fields_with_values: customFieldAnalysis.filter((f) => f.value !== null && f.value !== undefined && f.value !== '').length,
            field_types: [...new Set(customFieldAnalysis.map((f) => f.type))],
            all_fields: customFieldAnalysis
          },
          potential_mappings: {
            address_fields: customFieldAnalysis.filter((f) => 
              f.name.toLowerCase().includes('address') || 
              f.name.toLowerCase().includes('adress') ||
              f.name.toLowerCase().includes('plats') ||
              f.name.toLowerCase().includes('location')
            ),
            price_fields: customFieldAnalysis.filter((f) => 
              f.name.toLowerCase().includes('price') || 
              f.name.toLowerCase().includes('pris') ||
              f.name.toLowerCase().includes('cost') ||
              f.name.toLowerCase().includes('kostnad') ||
              f.type === 'currency'
            ),
            file_fields: customFieldAnalysis.filter((f) => 
              f.name.toLowerCase().includes('file') || 
              f.name.toLowerCase().includes('filer') ||
              f.name.toLowerCase().includes('attachment') ||
              f.name.toLowerCase().includes('bilaga') ||
              f.type === 'attachment'
            ),
            report_fields: customFieldAnalysis.filter((f) => 
              f.name.toLowerCase().includes('report') || 
              f.name.toLowerCase().includes('rapport') ||
              f.name.toLowerCase().includes('beskrivning') ||
              f.name.toLowerCase().includes('summary')
            )
          },
          full_task_data: taskData
        }
      })

    } catch (error) {
      return res.status(500).json({
        error: error.message,
        task_id: task_id
      })
    }
  }

  // Test med list_id
  const { list_id } = req.query

  if (!list_id || typeof list_id !== 'string') {
    return res.status(400).json({ error: 'list_id parameter is required' })
  }

  if (!CLICKUP_API_TOKEN) {
    return res.status(500).json({
      error: 'CLICKUP_API_TOKEN not configured',
      tests: { token_exists: false }
    })
  }

  try {
    console.log('Testing ClickUp API with list_id:', list_id)

    // Hämta list-information
    const listResponse = await fetch(
      `https://api.clickup.com/api/v2/list/${list_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    const listData = listResponse.ok ? await listResponse.json() : null
    
    // Hämta tasks med alla custom fields
    const tasksResponse = await fetch(
      `https://api.clickup.com/api/v2/list/${list_id}/task?include_closed=true&include_markdown_description=true`,
      {
        method: 'GET',
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    const tasksData = tasksResponse.ok ? await tasksResponse.json() : null

    // Analysera custom fields från alla tasks
    let allCustomFields = []
    if (tasksData?.tasks) {
      tasksData.tasks.forEach((task) => {
        if (task.custom_fields) {
          task.custom_fields.forEach((field) => {
            const existing = allCustomFields.find(f => f.id === field.id)
            if (!existing) {
              allCustomFields.push({
                id: field.id,
                name: field.name,
                type: field.type,
                has_values: task.custom_fields.some((f) => f.id === field.id && f.value),
                sample_value: field.value,
                type_config: field.type_config
              })
            }
          })
        }
      })
    }

    return res.status(200).json({
      success: true,
      list_id: list_id,
      tests: {
        token_exists: !!CLICKUP_API_TOKEN,
        token_length: CLICKUP_API_TOKEN.length,
        list_response: {
          status: listResponse.status,
          ok: listResponse.ok,
          data: listData ? {
            id: listData.id,
            name: listData.name,
            task_count: listData.task_count,
            folder: listData.folder ? {
              id: listData.folder.id,
              name: listData.folder.name
            } : null
          } : null
        },
        tasks_response: {
          status: tasksResponse.status,
          ok: tasksResponse.ok,
          tasks_count: tasksData?.tasks?.length || 0,
          tasks: tasksData?.tasks?.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status?.status,
            custom_fields_count: t.custom_fields?.length || 0,
            has_description: !!t.description,
            assignees_count: t.assignees?.length || 0
          })) || []
        },
        custom_fields_analysis: {
          total_unique_fields: allCustomFields.length,
          all_custom_fields: allCustomFields,
          suggested_mappings: {
            address: allCustomFields.filter(f => 
              f.name.toLowerCase().includes('address') || 
              f.name.toLowerCase().includes('adress') ||
              f.name.toLowerCase().includes('plats')
            ),
            price: allCustomFields.filter(f => 
              f.name.toLowerCase().includes('price') || 
              f.name.toLowerCase().includes('pris') ||
              f.type === 'currency'
            ),
            files: allCustomFields.filter(f => 
              f.name.toLowerCase().includes('file') || 
              f.name.toLowerCase().includes('filer') ||
              f.type === 'attachment'
            ),
            report: allCustomFields.filter(f => 
              f.name.toLowerCase().includes('report') || 
              f.name.toLowerCase().includes('rapport')
            )
          }
        }
      }
    })

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      list_id: list_id
    })
  }
}