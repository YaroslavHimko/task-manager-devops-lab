import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface TaskItem {
  id: number;
  title: string;
  done: boolean;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly http = inject(HttpClient);

  tasks = signal<TaskItem[]>([]);
  loading = signal(false);
  error = signal('');
  draft = '';

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    this.http.get<TaskItem[]>('/api/tasks').subscribe({
      next: tasks => { this.tasks.set(tasks); this.loading.set(false); },
      error: () => { this.error.set('API unavailable — check your containers.'); this.loading.set(false); }
    });
  }

  addTask(): void {
    const title = this.draft.trim();
    if (!title) return;
    this.http.post<TaskItem>('/api/tasks', { title }).subscribe({
      next: task => { this.tasks.update(tasks => [...tasks, task]); this.draft = ''; this.error.set(''); },
      error: () => this.error.set('Could not create task.')
    });
  }

  toggleTask(task: TaskItem): void {
    this.http.patch<TaskItem>(`/api/tasks/${task.id}/toggle`, {}).subscribe({
      next: updated => this.tasks.update(tasks => tasks.map(t => t.id === task.id ? updated : t)),
      error: () => this.error.set('Could not update task.')
    });
  }

  deleteTask(id: number): void {
    this.http.delete<void>(`/api/tasks/${id}`).subscribe({
      next: () => this.tasks.update(tasks => tasks.filter(t => t.id !== id)),
      error: () => this.error.set('Could not delete task.')
    });
  }
}
