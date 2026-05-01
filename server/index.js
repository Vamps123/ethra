const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const path = require('path');
const { sequelize, User, Project, ProjectMember, Task } = require('./models');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'ethra-secret';

app.use(cors());
app.use(express.json());

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authorization required' });
  const token = authHeader.replace('Bearer ', '');
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    next();
  };
}

async function getProjectIfMember(projectId, userId) {
  return Project.findOne({
    where: { id: projectId },
    include: [{ model: User, as: 'members', where: { id: userId }, attributes: ['id'] }],
  });
}

app.post('/api/auth/signup',
  body('name').trim().notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const isAdmin = (await User.count()) === 0;
    const user = await User.create({ name, email, passwordHash: hashed, role: isAdmin ? 'ADMIN' : 'MEMBER' });
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

app.post('/api/auth/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

app.get('/api/users/me', authMiddleware, async (req, res) => {
  const user = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'email', 'role'] });
  res.json({ user });
});

app.get('/api/projects', authMiddleware, async (req, res) => {
  const projects = await Project.findAll({
    include: [
      { model: User, as: 'members', attributes: ['id', 'name', 'email'], through: { attributes: [] } },
      { model: User, as: 'owner', attributes: ['id', 'name', 'email'] },
    ],
  });
  res.json({ projects });
});

app.post('/api/projects', authMiddleware,
  body('title').trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const project = await Project.create({
      title: req.body.title,
      description: req.body.description || '',
      ownerId: req.user.id,
    });
    await ProjectMember.create({ ProjectId: project.id, UserId: req.user.id, role: 'OWNER' });
    const result = await Project.findByPk(project.id, { include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }] });
    res.json({ project: result });
  });

app.post('/api/projects/:projectId/members', authMiddleware,
  body('email').isEmail(),
  async (req, res) => {
    const project = await getProjectIfMember(req.params.projectId, req.user.id);
    if (!project) return res.status(403).json({ error: 'Project access denied' });

    const member = await User.findOne({ where: { email: req.body.email } });
    if (!member) return res.status(404).json({ error: 'User not found' });
    await ProjectMember.findOrCreate({ where: { ProjectId: project.id, UserId: member.id }, defaults: { role: 'MEMBER' } });
    res.json({ message: 'Member added', member: { id: member.id, name: member.name, email: member.email } });
  });

app.get('/api/projects/:projectId/members', authMiddleware, async (req, res) => {
  const project = await getProjectIfMember(req.params.projectId, req.user.id);
  if (!project) return res.status(403).json({ error: 'Project access denied' });
  const members = await project.getMembers({ attributes: ['id', 'name', 'email', 'role'], joinTableAttributes: ['role'] });
  res.json({ members });
});

app.get('/api/tasks', authMiddleware, async (req, res) => {
  const tasks = await Task.findAll({
    include: [
      { model: Project, attributes: ['id', 'title'] },
      { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
    ],
  });
  res.json({ tasks });
});

app.post('/api/tasks', authMiddleware,
  body('title').trim().notEmpty(),
  body('projectId').isInt(),
  body('assigneeId').optional().isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const project = await getProjectIfMember(req.body.projectId, req.user.id);
    if (!project) return res.status(403).json({ error: 'Project access denied' });

    const task = await Task.create({
      title: req.body.title,
      description: req.body.description || '',
      dueDate: req.body.dueDate || null,
      status: 'OPEN',
      ProjectId: project.id,
      assigneeId: req.body.assigneeId || null,
    });
    res.json({ task });
  });

app.put('/api/tasks/:taskId', authMiddleware, async (req, res) => {
  const task = await Task.findByPk(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const project = await getProjectIfMember(task.ProjectId, req.user.id);
  if (!project) return res.status(403).json({ error: 'Project access denied' });

  const allowed = ['title', 'description', 'status', 'dueDate', 'assigneeId'];
  allowed.forEach(field => { if (req.body[field] !== undefined) task[field] = req.body[field]; });
  await task.save();
  res.json({ task });
});

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  const tasks = await Task.findAll({
    include: [
      { model: Project, attributes: ['id', 'title'] },
      { model: User, as: 'assignee', attributes: ['id', 'name'] },
    ],
  });
  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});
  const overdue = tasks.filter(task => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE');
  res.json({ counts: statusCounts, overdue: overdue.length, tasks });
});

const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
});
