const CLICKUP_TOKEN = import.meta.env.VITE_CLICKUP_API_TOKEN;
const BASE_URL = 'https://api.clickup.com/api/v2';

class ClickUpService {
  private headers = {
    'Authorization': CLICKUP_TOKEN,
    'Content-Type': 'application/json'
  };

  async getTasks(listId: string) {
    try {
      const response = await fetch(`${BASE_URL}/list/${listId}/task?archived=false`, {
        headers: this.headers
      });
      
      if (!response.ok) {
        throw new Error(`ClickUp API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.tasks || [];
    } catch (error) {
      console.error('Error fetching ClickUp tasks:', error);
      return [];
    }
  }

  async getTask(taskId: string) {
    try {
      const response = await fetch(`${BASE_URL}/task/${taskId}`, {
        headers: this.headers
      });
      
      if (!response.ok) {
        throw new Error(`ClickUp API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching ClickUp task:', error);
      return null;
    }
  }

  // Transformera ClickUp task till vårt format
  transformTask(clickupTask: any) {
    const getCustomFieldValue = (fieldName: string) => {
      const field = clickupTask.custom_fields?.find((f: any) => 
        f.name.toLowerCase().includes(fieldName.toLowerCase())
      );
      return field?.value || '';
    };

    return {
      clickup_task_id: clickupTask.id,
      case_number: clickupTask.custom_id || `CU-${clickupTask.id}`,
      title: clickupTask.name,
      status: this.mapClickUpStatus(clickupTask.status?.status),
      priority: this.mapClickUpPriority(clickupTask.priority?.priority),
      pest_type: getCustomFieldValue('skadedjur') || getCustomFieldValue('pest') || 'Okänt',
      location_details: getCustomFieldValue('adress') || getCustomFieldValue('location') || '',
      description: clickupTask.description || '',
      created_date: new Date(parseInt(clickupTask.date_created)).toISOString(),
      scheduled_date: clickupTask.due_date ? new Date(parseInt(clickupTask.due_date)).toISOString() : null,
      completed_date: clickupTask.date_closed ? new Date(parseInt(clickupTask.date_closed)).toISOString() : null
    };
  }

  private mapClickUpStatus(clickupStatus: string) {
    const statusMap: { [key: string]: string } = {
      'to do': 'pending',
      'in progress': 'in_progress',
      'complete': 'completed',
      'closed': 'completed'
    };
    
    return statusMap[clickupStatus?.toLowerCase()] || 'pending';
  }

  private mapClickUpPriority(clickupPriority: string | number) {
    if (typeof clickupPriority === 'number') {
      if (clickupPriority >= 3) return 'high';
      if (clickupPriority >= 2) return 'medium';
      return 'low';
    }
    
    const priorityMap: { [key: string]: string } = {
      'urgent': 'high',
      'high': 'high',
      'normal': 'medium',
      'low': 'low'
    };
    
    return priorityMap[clickupPriority?.toLowerCase()] || 'medium';
  }
}

export const clickupService = new ClickUpService();