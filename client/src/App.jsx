import { useEffect, useMemo, useState } from 'react';
import { auth, projects, tasks, dashboard, me } from './api';

const initialForm = { name: '', email: '', password: '' };
const statusLabels = { OPEN: 'Open', IN_PROGRESS: 'In Progress', DONE: 'Done' };
const statusStyles = {
  OPEN: 'status-open',
  IN_PROGRESS: 'status-progress',
  DONE: 'status-done',
};

function isOverdue(task) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';
}

function App() {
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [projectsList, setProjectsList] = useState([]);
  const [tasksList, setTasksList] = useState([]);
  const [summary, setSummary] = useState({ counts: {}, overdue: 0 });
  const [message, setMessage] = useState('');
  const [projectForm, setProjectForm] = useState({ title: '', description: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', projectId: '', dueDate: '', assigneeId: '' });
  const [memberEmail, setMemberEmail] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('taskToken');
    if (token) loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { user } = await me.profile();
      setUser(user);
      setView('dashboard');
      refreshData();
    } catch (error) {
      localStorage.removeItem('taskToken');
      setUser(null);
    }
  }

  async function refreshData() {
    try {
      const [{ projects }, { tasks }, { counts, overdue }] = await Promise.all([projects.list(), tasks.list(), dashboard.summary()]);
      setProjectsList(projects);
      setTasksList(tasks);
      setSummary({ counts, overdue });
    } catch (error) {
      setMessage(typeof error === 'string' ? error : error.message || JSON.stringify(error));
    }
  }

  const members = useMemo(() => {
    return projectsList.reduce((acc, project) => {
      project.members?.forEach(member => {
        acc[member.id] = member;
      });
      return acc;
    }, {});
  }, [projectsList]);

  const authHandler = async action => {
    try {
      const result = action === 'signup' ? await auth.signup(form) : await auth.login({ email: form.email, password: form.password });
      localStorage.setItem('taskToken', result.token);
      setForm(initialForm);
      await loadProfile();
      setMessage('Logged in successfully');
    } catch (error) {
      setMessage(typeof error === 'string' ? error : error.error || JSON.stringify(error));
    }
  };

  const logout = () => {
    localStorage.removeItem('taskToken');
    setUser(null);
    setView('login');
  };

  const submitProject = async event => {
    event.preventDefault();
    try {
      await projects.create(projectForm);
      setProjectForm({ title: '', description: '' });
      refreshData();
      setMessage('Project created');
    } catch (error) {
      setMessage(error.error || JSON.stringify(error));
    }
  };

  const submitTask = async event => {
    event.preventDefault();
    try {
      await tasks.create(taskForm);
      setTaskForm({ title: '', description: '', projectId: '', dueDate: '', assigneeId: '' });
      refreshData();
      setMessage('Task added');
    } catch (error) {
      setMessage(error.error || JSON.stringify(error));
    }
  };

  const addProjectMember = async projectId => {
    try {
      await projects.addMember(projectId, { email: memberEmail });
      setMemberEmail('');
      refreshData();
      setMessage('Member invited');
    } catch (error) {
      setMessage(error.error || JSON.stringify(error));
    }
  };

  if (!user) {
    return (
      <div className="page">
        <div className="card auth-card">
          <h1>Team Task Manager</h1>
          <p className="hero-copy">Manage teams, assign tasks, and keep every deadline visible.</p>
          <div className="tabs">
            <button className={view === 'login' ? 'active' : ''} onClick={() => setView('login')}>Login</button>
            <button className={view === 'signup' ? 'active' : ''} onClick={() => setView('signup')}>Signup</button>
          </div>
          <form onSubmit={e => { e.preventDefault(); authHandler(view); }}>
            {view === 'signup' && (
              <label>
                Name
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </label>
            )}
            <label>
              Email
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label>
              Password
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </label>
            <button type="submit">{view === 'login' ? 'Login' : 'Create account'}</button>
          </form>
          {message && <p className="message">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Team Task Manager</h1>
          <p>{user.name} • {user.role}</p>
        </div>
        <button className="ghost" onClick={logout}>Logout</button>
      </header>

      <section className="summary-grid">
        <div className="card summary-card">
          <h2>Tasks by status</h2>
          <ul>
            {['OPEN', 'IN_PROGRESS', 'DONE'].map(key => (
              <li key={key}>{statusLabels[key]}: {summary.counts[key] || 0}</li>
            ))}
          </ul>
        </div>
        <div className="card summary-card">
          <h2>Overdue</h2>
          <p>{summary.overdue}</p>
        </div>
      </section>

      <section className="grid-two">
        <div className="card">
          <h2>Projects</h2>
          <form className="small-form" onSubmit={submitProject}>
            <input value={projectForm.title} onChange={e => setProjectForm({ ...projectForm, title: e.target.value })} placeholder="Project title" required />
            <input value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="Description" />
            <button type="submit">Create project</button>
          </form>
          {projectsList.map(project => (
            <div key={project.id} className="project-card">
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              <div className="meta">Owner: {project.owner?.name || 'Unknown'}</div>
              <div className="meta">Members: {project.members?.map(member => member.name).join(', ') || 'None'}</div>
              <div className="member-form">
                <input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Member email" />
                <button type="button" onClick={() => addProjectMember(project.id)}>Invite</button>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2>New Task</h2>
          <form className="small-form" onSubmit={submitTask}>
            <input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title" required />
            <textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Description" />
            <select value={taskForm.projectId} onChange={e => setTaskForm({ ...taskForm, projectId: e.target.value })} required>
              <option value="">Select project</option>
              {projectsList.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
            <select value={taskForm.assigneeId} onChange={e => setTaskForm({ ...taskForm, assigneeId: e.target.value })}>
              <option value="">Assign to (optional)</option>
              {Object.values(members).map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
            <button type="submit">Add task</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>All Tasks</h2>
        <div className="task-grid">
          {tasksList.map(task => (
            <div key={task.id} className="task-card">
              <div className="task-card-head">
                <h3>{task.title}</h3>
                <span className={`status-badge ${statusStyles[task.status]}`}>{statusLabels[task.status]}</span>
              </div>
              <p>{task.description}</p>
              <div className="meta">Project: {task.Project?.title || 'Unknown'}</div>
              <div className="meta">Assigned to: {task.assignee?.name || 'Unassigned'}</div>
              <div className="meta row">
                <span>Due: {task.dueDate || 'No due date'}</span>
                {isOverdue(task) && <span className="overdue-pill">Overdue</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
      {message && <div className="toast">{message}</div>}
    </div>
  );
}

export default App;
