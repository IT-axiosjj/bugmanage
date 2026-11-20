import { useEffect, useMemo, useState } from 'react'
import './styles.css'

type Priority = 'high' | 'medium' | 'low'
type Filter = 'all' | 'todo' | 'done'

type Task = {
  id: string
  title: string
  project: string
  priority: Priority
  completed: boolean
  source?: string
  createdAt: string
}

type ParsedSource = {
  name: string
  type: string
  text: string
  url?: string
  note?: string
}

type IconName =
  | 'check'
  | 'plus'
  | 'search'
  | 'file'
  | 'link'
  | 'close'
  | 'minus'
  | 'spark'
  | 'folder'
  | 'filter'
  | 'more'
  | 'arrow'
  | 'upload'
  | 'external'

const seedProjects = ['TaskDock', 'Bug Manage', '个人成长']
const seedTasks: Task[] = [
  {
    id: 'seed-1',
    title: '梳理 Electron 窗口的持久化状态',
    project: 'TaskDock',
    priority: 'high',
    completed: false,
    createdAt: '2026-11-16T08:00:00.000Z',
  },
  {
    id: 'seed-2',
    title: '补上文件导入后的任务归属规则',
    project: 'TaskDock',
    priority: 'medium',
    completed: false,
    createdAt: '2026-11-16T08:20:00.000Z',
  },
  {
    id: 'seed-3',
    title: '确认登录态失效后的重试路径',
    project: 'Bug Manage',
    priority: 'high',
    completed: false,
    createdAt: '2026-11-16T09:00:00.000Z',
  },
  {
    id: 'seed-4',
    title: '更新项目周报中的风险项',
    project: 'Bug Manage',
    priority: 'low',
    completed: true,
    createdAt: '2026-11-15T16:10:00.000Z',
  },
  {
    id: 'seed-5',
    title: '给自己留出 30 分钟深度工作时间',
    project: '个人成长',
    priority: 'medium',
    completed: false,
    createdAt: '2026-11-16T10:00:00.000Z',
  },
]

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  const paths: Record<IconName, JSX.Element> = {
    check: <path d="m5 12 4.1 4L19 6.5" />,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.4 4.4" /></>,
    file: <><path d="M14 2.8H6.8A1.8 1.8 0 0 0 5 4.6v14.8a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8V8z" /><path d="M14 2.8V8h5" /><path d="M8.5 12h7" /><path d="M8.5 15.5h5.2" /></>,
    link: <><path d="M10.1 13.9 8.8 15.2a3.6 3.6 0 0 1-5.1-5.1l2.7-2.7a3.6 3.6 0 0 1 5.1 0" /><path d="m13.9 10.1 1.3-1.3a3.6 3.6 0 0 1 5.1 5.1l-2.7 2.7a3.6 3.6 0 0 1-5.1 0" /><path d="m8.9 15.1 6.2-6.2" /></>,
    close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
    minus: <path d="M5 12h14" />,
    spark: <><path d="m12 2 1.3 6.7L20 10l-6.7 1.3L12 18l-1.3-6.7L4 10l6.7-1.3z" /><path d="m19 16 .5 2.5L22 19l-2.5.5L19 22l-.5-2.5L16 19l2.5-.5z" /></>,
    folder: <><path d="M3.5 7.2a2 2 0 0 1 2-2h4l1.7 2h7.3a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><path d="M3.5 9h17" /></>,
    filter: <><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
    external: <><path d="M14 5h5v5" /><path d="m19 5-8 8" /><path d="M19 13v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-11A1.5 1.5 0 0 1 6.5 5H11" /></>,
  }

  return <svg {...common}>{paths[name]}</svg>
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function inferPriority(title: string): Priority {
  if (/(紧急|阻塞|上线|发布|修复|今天|bug|bugfix|deadline)/i.test(title)) return 'high'
  if (/(优化|整理|补充|确认|review|梳理)/i.test(title)) return 'medium'
  return 'low'
}

function cleanTaskLine(line: string) {
  return line
    .replace(/^\s*(?:[-*•▪◦]|\d+[.)、]|[一二三四五六七八九十]+[、.)])\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractDroppedUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s<>"']+/i)
  return match?.[0]?.replace(/[),.;，。；）】]+$/, '') || ''
}

function htmlToText(value: string) {
  if (!value) return ''
  const documentNode = new DOMParser().parseFromString(value, 'text/html')
  const tableRows = Array.from(documentNode.querySelectorAll('tr')).map((row) =>
    Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent?.trim() || '').join('\t'),
  ).filter(Boolean)
  if (tableRows.length) return tableRows.join('\n')
  return documentNode.body?.textContent?.replace(/\u00a0/g, ' ').split(/\r?\n+/).map((line) => line.trim()).filter(Boolean).join('\n') || ''
}

function textToTasks(text: string, sourceName: string, project: string): Task[] {
  const candidates = text
    .split(/\r?\n+/)
    .map(cleanTaskLine)
    .filter((line) => line.length >= 3 && line.length <= 240)
    .filter((line) => !/^(目录|contents?|项目名称|任务列表|备注|说明|日期|负责人)[:：]?$/i.test(line))
    .slice(0, 500)

  const lines = candidates.length ? candidates : [`整理导入文件：${sourceName}`]
  return lines.map((title) => ({
    id: makeId(),
    title,
    project,
    priority: inferPriority(title),
    completed: false,
    source: sourceName,
    createdAt: new Date().toISOString(),
  }))
}

function readStoredState() {
  try {
    const raw = localStorage.getItem('taskdock-state-v1')
    if (!raw) return { tasks: seedTasks, projects: seedProjects }
    const parsed = JSON.parse(raw)
    return {
      tasks: Array.isArray(parsed.tasks) && parsed.tasks.length ? parsed.tasks : seedTasks,
      projects: Array.isArray(parsed.projects) && parsed.projects.length ? parsed.projects : seedProjects,
    }
  } catch {
    return { tasks: seedTasks, projects: seedProjects }
  }
}

function App() {
  const stored = useMemo(readStoredState, [])
  const [tasks, setTasks] = useState<Task[]>(stored.tasks)
  const [projects, setProjects] = useState<string[]>(stored.projects)
  const [filter, setFilter] = useState<Filter>('all')
  const [projectFilter, setProjectFilter] = useState('全部')
  const [query, setQuery] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newProject, setNewProject] = useState('TaskDock')
  const [newPriority, setNewPriority] = useState<Priority>('medium')
  const [newProjectName, setNewProjectName] = useState('')
  const [link, setLink] = useState('')
  const [pendingTencentUrl, setPendingTencentUrl] = useState('')
  const [tencentAuthStatus, setTencentAuthStatus] = useState<TencentAuthStatus>({ connected: false, clientId: '', redirectUri: 'http://127.0.0.1:17865/oauth/tencent-docs/callback', user: null })
  const [isTencentModalOpen, setIsTencentModalOpen] = useState(false)
  const [tencentClientId, setTencentClientId] = useState('')
  const [tencentClientSecret, setTencentClientSecret] = useState('')
  const [tencentRedirectUri, setTencentRedirectUri] = useState('http://127.0.0.1:17865/oauth/tencent-docs/callback')

  useEffect(() => {
    localStorage.setItem('taskdock-state-v1', JSON.stringify({ tasks, projects }))
  }, [tasks, projects])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3600)
    return () => window.clearTimeout(timer)
  }, [notice])

  const completedCount = tasks.filter((task) => task.completed).length
  const todoCount = tasks.length - completedCount
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0

  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return tasks.filter((task) => {
      const matchesFilter = filter === 'all' || (filter === 'todo' ? !task.completed : task.completed)
      const matchesProject = projectFilter === '全部' || task.project === projectFilter
      const matchesQuery = !normalizedQuery || `${task.title} ${task.project} ${task.source || ''}`.toLowerCase().includes(normalizedQuery)
      return matchesFilter && matchesProject && matchesQuery
    })
  }, [filter, projectFilter, query, tasks])

  const groupedTasks = useMemo(() => {
    return visibleTasks.reduce<Record<string, Task[]>>((groups, task) => {
      groups[task.project] ||= []
      groups[task.project].push(task)
      return groups
    }, {})
  }, [visibleTasks])

  const showNotice = (message: string) => setNotice(message)

  const isTencentDocsUrl = (value: string) => {
    try {
      return /(^|\.)docs\.qq\.com$/i.test(new URL(value).hostname)
    } catch {
      return false
    }
  }

  useEffect(() => {
    if (!window.electronAPI) return
    let active = true
    window.electronAPI.getTencentAuthStatus().then((status) => {
      if (!active) return
      setTencentAuthStatus(status)
      setTencentClientId(status.clientId)
      setTencentRedirectUri(status.redirectUri)
    }).catch(() => {})
    const dispose = window.electronAPI.onTencentAuthResult((payload) => {
      if (!payload.ok || !payload.status) {
        showNotice(payload.error || '腾讯文档授权失败')
        return
      }
      setTencentAuthStatus(payload.status)
      setTencentClientId(payload.status.clientId)
      setTencentRedirectUri(payload.status.redirectUri)
      setTencentClientSecret('')
      setIsTencentModalOpen(false)
      setIsAddOpen(false)
      showNotice(`腾讯文档已授权${payload.status.user?.name ? `：${payload.status.user.name}` : ''}`)
    })
    return () => {
      active = false
      dispose()
    }
  }, [])

  const startTencentAuth = async () => {
    if (!window.electronAPI) return
    if (!tencentClientId.trim() || !tencentClientSecret.trim()) {
      showNotice('请先填写腾讯文档 Client ID 和 Client Secret')
      return
    }
    setImporting(true)
    try {
      await window.electronAPI.startTencentOAuth({
        clientId: tencentClientId.trim(),
        clientSecret: tencentClientSecret.trim(),
        redirectUri: tencentRedirectUri.trim(),
      })
      showNotice('授权窗口已打开，完成登录后会自动返回 TaskDock')
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '无法打开腾讯文档授权窗口')
    } finally {
      setImporting(false)
    }
  }

  const logoutTencent = async () => {
    if (!window.electronAPI) return
    const status = await window.electronAPI.logoutTencent()
    setTencentAuthStatus(status)
    setTencentClientSecret('')
    showNotice('已退出腾讯文档授权')
  }

  const toggleTask = (id: string) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)))
  }

  const addTask = () => {
    const title = newTitle.trim()
    if (!title) return
    const project = newProject.trim() || '未归属'
    setTasks((current) => [
      {
        id: makeId(),
        title,
        project,
        priority: newPriority,
        completed: false,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ])
    if (!projects.includes(project)) setProjects((current) => [...current, project])
    setNewTitle('')
    setNewPriority('medium')
    setIsAddOpen(false)
    showNotice('任务已添加到清单')
  }

  const addProject = () => {
    const value = newProjectName.trim()
    if (!value || projects.includes(value)) return
    setProjects((current) => [...current, value])
    setNewProject(value)
    setNewProjectName('')
    showNotice(`已创建项目「${value}」`)
  }

  const importSource = async (source: ParsedSource, sourceLabel?: string) => {
    const project = newProject.trim() || 'TaskDock'
    const generated = textToTasks(source.text, source.name, project)
    setTasks((current) => [...generated, ...current])
    if (!projects.includes(project)) setProjects((current) => [...current, project])
    showNotice(`${sourceLabel || source.name} 已整理为 ${generated.length} 条任务`)
  }

  useEffect(() => {
    if (!pendingTencentUrl || !tencentAuthStatus.connected || !window.electronAPI) return
    let active = true
    setImporting(true)
    window.electronAPI.parseTencentUrl(pendingTencentUrl)
      .then((source) => {
        if (!active) return
        return importSource(source, source.note ? `在线文档（${source.note}）` : '在线文档')
      })
      .catch((error) => {
        if (active) showNotice(error instanceof Error ? error.message : '腾讯文档读取失败')
      })
      .finally(() => {
        if (active) {
          setImporting(false)
          setPendingTencentUrl('')
          setLink('')
        }
      })
    return () => {
      active = false
    }
  }, [pendingTencentUrl, tencentAuthStatus.connected])

  const importFiles = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    setImporting(true)
    try {
      for (const file of list) {
        const filePath = window.electronAPI?.getPathForFile(file) || ''
        if (!filePath || !window.electronAPI) {
          await importSource({ name: file.name, type: 'text', text: file.name }, file.name)
          continue
        }
        const source = await window.electronAPI.parseFile(filePath)
        await importSource(source, source.note ? `${file.name}（${source.note}）` : file.name)
      }
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '文件解析失败，请检查格式')
    } finally {
      setImporting(false)
      setIsDragging(false)
    }
  }

  const importLink = async () => {
    const target = link.trim()
    if (!target || !window.electronAPI) return
    if (isTencentDocsUrl(target) && !tencentAuthStatus.connected) {
      setPendingTencentUrl(target)
      setIsTencentModalOpen(true)
      showNotice('请先完成腾讯文档授权，授权后会自动读取这份文档')
      return
    }
    setImporting(true)
    try {
      const source = isTencentDocsUrl(target)
        ? await window.electronAPI.parseTencentUrl(target)
        : await window.electronAPI.parseUrl(target)
      await importSource(source, source.note ? `在线文档（${source.note}）` : '在线文档')
      setLink('')
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '在线文档解析失败')
    } finally {
      setImporting(false)
    }
  }

  const handleDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    setIsDragging(false)

    const dataTransfer = event.dataTransfer
    const uriList = dataTransfer.getData('text/uri-list').trim()
    const plainText = dataTransfer.getData('text/plain').trim()
    const html = dataTransfer.getData('text/html')
    const htmlText = htmlToText(html)
    const droppedUrl = extractDroppedUrl(uriList) || extractDroppedUrl(html) || (plainText && /^https?:\/\/\S+$/i.test(plainText) ? extractDroppedUrl(plainText) : '')
    const tabularText = plainText && !/^https?:\/\/\S+$/i.test(plainText) && (/[\r\n\t]/.test(plainText))

    if (dataTransfer.files.length) {
      await importFiles(dataTransfer.files)
      return
    }

    // 在线表格选区通常以 text/plain / text/html 传递，多行内容优先于 URL 处理。
    if (tabularText) {
      await importSource({ name: '在线文档选区', type: 'text', text: plainText }, '在线文档选区')
      return
    }

    if (droppedUrl) {
      if (!window.electronAPI) {
        showNotice('请使用 Electron 桌面窗口导入在线文档')
        return
      }
      if (isTencentDocsUrl(droppedUrl) && !tencentAuthStatus.connected) {
        setLink(droppedUrl)
        setPendingTencentUrl(droppedUrl)
        setIsTencentModalOpen(true)
        showNotice('请先完成腾讯文档授权，授权后会自动读取这份文档')
        return
      }
      setImporting(true)
      try {
        const source = isTencentDocsUrl(droppedUrl)
          ? await window.electronAPI.parseTencentUrl(droppedUrl)
          : await window.electronAPI.parseUrl(droppedUrl)
        await importSource(source, source.note ? `在线文档（${source.note}）` : '在线文档')
      } catch (error) {
        showNotice(error instanceof Error ? error.message : '在线文档解析失败，请先拖选表格内容')
      } finally {
        setImporting(false)
      }
      return
    }

    const droppedText = plainText || htmlText
    if (droppedText) {
      await importSource({ name: '拖入文档内容', type: 'text', text: droppedText }, '拖入文档内容')
      return
    }

    showNotice('没有读取到拖入内容，请拖选表格记录或拖入网页链接')
  }

  return (
    <main
      className={`app-shell ${isDragging ? 'is-dragging' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDragging(false)
      }}
      onDrop={handleDrop}
    >
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Icon name="check" size={17} /></div>
          <div>
            <div className="brand-name">TaskDock</div>
            <div className="brand-caption">DEVELOPER COMMAND CENTER</div>
          </div>
        </div>
        <div className="window-actions">
          <span className="floating-status"><span className="status-dot" /> FLOATING</span>
          <button className="icon-button subtle" onClick={() => window.electronAPI?.minimize()} aria-label="最小化"><Icon name="minus" size={16} /></button>
          <button className="icon-button subtle" onClick={() => window.electronAPI?.hide()} aria-label="隐藏窗口"><Icon name="close" size={16} /></button>
        </div>
      </header>

      <section className="hero-panel">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> MONDAY · NOV 16, 2026</p>
          <h1>今天，先把<br /><em>最重要的事</em> 清掉。</h1>
          <p className="hero-note">拖入文件，TaskDock 会把上下文整理成可执行任务。</p>
        </div>
        <div className="progress-orb" aria-label={`完成度 ${progress}%`}>
          <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}>
            <div className="progress-inner"><strong>{progress}%</strong><span>DONE</span></div>
          </div>
        </div>
      </section>

      <section className="quick-stats" aria-label="任务统计和快捷操作">
        <button type="button" className={`stat-card ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}><span className="stat-label">全部任务</span><strong>{tasks.length}</strong><span className="stat-trend">总览</span></button>
        <button type="button" className={`stat-card ${filter === 'todo' ? 'active' : ''}`} onClick={() => setFilter('todo')}><span className="stat-label">待完成</span><strong>{todoCount}</strong><span className="stat-trend warm">进行中</span></button>
        <button type="button" className={`stat-card ${filter === 'done' ? 'active' : ''}`} onClick={() => setFilter('done')}><span className="stat-label">已完成</span><strong>{completedCount}</strong><span className="stat-trend cool">已归档</span></button>
        <button type="button" className="stat-card action-card" onClick={() => setIsAddOpen(true)}><span className="stat-label">快捷操作</span><strong><Icon name="plus" size={20} /></strong><span className="stat-trend">添加任务</span></button>
      </section>

      <section className="toolbar">
        <button className="filter-button" onClick={() => setProjectFilter(projectFilter === '全部' ? (projects[0] || '全部') : '全部')}><Icon name="filter" size={16} /> {projectFilter === '全部' ? '项目' : projectFilter}</button>
      </section>

      <label className="search-box">
        <Icon name="search" size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务、项目或来源..." />
        <span className="shortcut">⌘ K</span>
      </label>

      <section className="task-section">
        <div className="section-heading"><div><span className="section-kicker">CURRENT QUEUE</span><h2>任务清单 <span>{visibleTasks.length}</span></h2></div><button className="more-button" aria-label="更多操作"><Icon name="more" size={19} /></button></div>
        {Object.keys(groupedTasks).length ? Object.entries(groupedTasks).map(([project, projectTasks]) => (
          <div className="project-group" key={project}>
            <div className="project-heading"><span className="project-icon"><Icon name="folder" size={14} /></span><span>{project}</span><span className="project-count">{projectTasks.length}</span></div>
            <div className="task-list">
              {projectTasks.map((task) => (
                <article className={`task-card ${task.completed ? 'is-completed' : ''}`} key={task.id}>
                  <button className="task-check" onClick={() => toggleTask(task.id)} aria-label={task.completed ? '取消完成' : '标记完成'} aria-pressed={task.completed}>{task.completed && <Icon name="check" size={15} />}</button>
                  <div className="task-content"><div className="task-title-row"><h3>{task.title}</h3><span className={`priority priority-${task.priority}`} title={`${task.priority} priority`} /></div><div className="task-meta"><span>{task.source ? `来自 ${task.source}` : '手动创建'}</span><span className={`priority-label priority-label-${task.priority}`}>{task.priority === 'high' ? '高优先级' : task.priority === 'medium' ? '中优先级' : '低优先级'}</span></div></div>
                  <button className="task-arrow" aria-label="打开任务"><Icon name="arrow" size={16} /></button>
                </article>
              ))}
            </div>
          </div>
        )) : (
          <div className="empty-state"><span className="empty-icon"><Icon name="spark" size={22} /></span><h3>没有匹配的任务</h3><p>换个关键词，或者把文档拖到这里。</p></div>
        )}
      </section>

      <section className="import-strip" onClick={() => setIsAddOpen(true)}>
        <div className="import-icon"><Icon name="upload" size={17} /></div>
        <div><strong>拖入文件，自动整理成任务</strong><span>Word · Excel · PDF · 图片 · 在线文档链接</span></div>
        <Icon name="arrow" size={17} />
      </section>

      {notice && <div className="toast"><span className="toast-check"><Icon name="check" size={13} /></span>{notice}</div>}
      {isDragging && <div className="drop-overlay"><div className="drop-panel"><div className="drop-panel-icon"><Icon name="upload" size={26} /></div><strong>松开即可导入</strong><span>支持 Word、Excel、PDF、图片和在线链接</span></div></div>}

      {isTencentModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setIsTencentModalOpen(false)}>
          <section className="add-modal tencent-modal" role="dialog" aria-modal="true" aria-labelledby="tencent-auth-title">
            <div className="modal-header"><div><span className="section-kicker">SECURE CONNECTION</span><h2 id="tencent-auth-title">连接腾讯文档</h2></div><button className="icon-button" onClick={() => setIsTencentModalOpen(false)} aria-label="关闭"><Icon name="close" size={18} /></button></div>
            <div className="modal-body">
              {tencentAuthStatus.connected ? (
                <div className="auth-connected"><div className="auth-avatar"><Icon name="check" size={20} /></div><div><strong>{tencentAuthStatus.user?.name || '腾讯文档用户'}</strong><span>已授权读取你有权限访问的在线表格</span></div></div>
              ) : (
                <>
                  <div className="auth-explainer"><span className="auth-explainer-icon"><Icon name="link" size={16} /></span><p>授权后，拖入腾讯文档链接会直接读取工作表数据，再整理成任务。登录过程会在独立授权窗口完成。</p></div>
                  <label className="field-label">Client ID<input value={tencentClientId} onChange={(event) => setTencentClientId(event.target.value)} placeholder="腾讯文档开放平台应用 Client ID" /></label>
                  <label className="field-label">Client Secret<input type="password" value={tencentClientSecret} onChange={(event) => setTencentClientSecret(event.target.value)} placeholder="腾讯文档开放平台应用 Client Secret" /></label>
                  <label className="field-label">Redirect URI<input value={tencentRedirectUri} onChange={(event) => setTencentRedirectUri(event.target.value)} /></label>
                  <p className="auth-hint">请在腾讯文档开放平台把上面的 Redirect URI 加入应用白名单；桌面端默认使用本机回调地址。</p>
                </>
              )}
            </div>
            <div className="modal-footer">{tencentAuthStatus.connected ? <button className="secondary-button" onClick={logoutTencent}>退出授权</button> : <button className="secondary-button" onClick={() => window.electronAPI?.openExternal('https://docs.qq.com/open/')}>打开开放平台</button>}<div className="modal-footer-actions">{tencentAuthStatus.connected ? <button className="add-task-button large" onClick={() => setIsTencentModalOpen(false)}>完成</button> : <button className="add-task-button large" onClick={startTencentAuth} disabled={importing}><Icon name="link" size={16} /> {importing ? '准备中' : '授权登录'}</button>}</div></div>
          </section>
        </div>
      )}

      {isAddOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setIsAddOpen(false)}>
          <section className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-task-title">
            <div className="modal-header"><div><span className="section-kicker">QUICK CAPTURE</span><h2 id="add-task-title">添加任务</h2></div><button className="icon-button" onClick={() => setIsAddOpen(false)} aria-label="关闭"><Icon name="close" size={18} /></button></div>
            <div className="modal-body">
              <label className="field-label">任务标题<input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addTask()} placeholder="例如：完成支付回调的异常重试" /></label>
              <div className="field-row"><label className="field-label">项目归属<select value={newProject} onChange={(event) => setNewProject(event.target.value)}>{projects.map((project) => <option key={project}>{project}</option>)}<option value="未归属">未归属</option></select></label><label className="field-label">优先级<select value={newPriority} onChange={(event) => setNewPriority(event.target.value as Priority)}><option value="high">高优先级</option><option value="medium">中优先级</option><option value="low">低优先级</option></select></label></div>
              <div className="new-project-row"><input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addProject()} placeholder="自定义项目归属" /><button className="secondary-button" onClick={addProject}>新建项目</button></div>
              <label className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}><input type="file" multiple accept=".doc,.docx,.xls,.xlsx,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif,.txt,.md,.csv" onChange={(event) => event.target.files && importFiles(event.target.files)} /><span className="dropzone-icon"><Icon name="file" size={19} /></span><span><strong>{importing ? '正在解析内容…' : '点击或拖入文件'}</strong><small>支持 Word、Excel、PDF、图片、TXT 和 Markdown</small></span><Icon name="arrow" size={16} /></label>
              <div className="link-capture"><div className="link-title"><Icon name="link" size={15} /> 在线文档链接</div><div className="link-input-row"><input value={link} onChange={(event) => setLink(event.target.value)} placeholder="粘贴 Notion、语雀或网页链接" /><button className="secondary-button" onClick={importLink} disabled={importing || !link.trim()}>{importing ? '解析中' : isTencentDocsUrl(link) ? '授权读取' : '解析'}</button></div></div>
            </div>
            <div className="modal-footer"><span className="modal-hint"><Icon name="spark" size={14} /> 任务会自动根据标题推断优先级</span><button className="add-task-button large" onClick={addTask}><Icon name="plus" size={17} /> 添加到清单</button></div>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
