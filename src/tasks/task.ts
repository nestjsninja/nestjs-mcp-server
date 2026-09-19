export interface Task {
  id: string;
  title: string;
  status: 'open' | 'done';
  assignee: string;
}

export interface TaskFilter {
  status?: 'open' | 'done';
  assignee?: string;
}
