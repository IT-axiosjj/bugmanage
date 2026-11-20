const { app, BrowserWindow, ipcMain, shell, safeStorage } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const { randomUUID } = require('node:crypto')

const TENCENT_AUTH_URL = 'https://docs.qq.com/oauth/v2/authorize'
const TENCENT_TOKEN_URL = 'https://docs.qq.com/oauth/v2/token'
const TENCENT_USERINFO_URL = 'https://docs.qq.com/oauth/v2/userinfo'
const TENCENT_API_BASE = 'https://docs.qq.com/openapi'
const DEFAULT_TENCENT_REDIRECT_URI = 'http://127.0.0.1:17865/oauth/tencent-docs/callback'

let mainWindow
let ocrWorker
let tencentAuthWindow
let tencentOAuthState = ''

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 420,
    minWidth: 280,
    minHeight: 360,
    maxWidth: 720,
    maxHeight: 900,
    backgroundColor: '#10131a',
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.setAlwaysOnTop(true, 'floating')
  mainWindow.setMenuBarVisibility(false)

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function tencentAuthFilePath() {
  return path.join(app.getPath('userData'), 'tencent-docs-auth.json')
}

async function readTencentAuth() {
  try {
    const auth = JSON.parse(await fs.readFile(tencentAuthFilePath(), 'utf8'))
    if (!auth.clientSecret && auth.clientSecretEncrypted && safeStorage.isEncryptionAvailable()) {
      auth.clientSecret = safeStorage.decryptString(Buffer.from(auth.clientSecretEncrypted, 'base64'))
    }
    return auth
  } catch {
    return {}
  }
}

async function writeTencentAuth(auth) {
  await fs.mkdir(path.dirname(tencentAuthFilePath()), { recursive: true })
  const persisted = { ...auth }
  delete persisted.clientSecret
  if (auth.clientSecret) {
    persisted.clientSecretEncrypted = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(auth.clientSecret).toString('base64')
      : auth.clientSecret
  }
  await fs.writeFile(tencentAuthFilePath(), JSON.stringify(persisted, null, 2), 'utf8')
}

function getTencentAuthStatus(auth) {
  return {
    connected: Boolean(auth.accessToken),
    clientId: auth.clientId || '',
    redirectUri: auth.redirectUri || DEFAULT_TENCENT_REDIRECT_URI,
    user: auth.user || null,
  }
}

function cleanText(value) {
  return String(value || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 120000)
}

function payloadData(payload) {
  if (payload && payload.data && typeof payload.data === 'object') return payload.data
  return payload || {}
}

function firstValue(value, keys) {
  if (!value || typeof value !== 'object') return ''
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null && value[key] !== '') return value[key]
  }
  return ''
}

async function readResponsePayload(response) {
  const raw = await response.text()
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return { raw }
  }
}

function assertTencentResponse(response, payload) {
  const code = payload?.ret ?? payload?.code ?? payload?.error_code
  const normalizedCode = code === undefined || code === null ? 0 : Number(code)
  if (!response.ok || (normalizedCode !== 0 && normalizedCode !== 200)) {
    const message = payload?.msg || payload?.message || payload?.error_description || response.statusText || '腾讯文档接口请求失败'
    const error = new Error(message)
    error.code = normalizedCode
    throw error
  }
}

async function requestTencentToken(body) {
  const response = await fetch(TENCENT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const payload = await readResponsePayload(response)
  assertTencentResponse(response, payload)
  return payloadData(payload)
}

function tokenFields(payload) {
  return {
    accessToken: firstValue(payload, ['access_token', 'accessToken', 'access-token']),
    refreshToken: firstValue(payload, ['refresh_token', 'refreshToken', 'refresh-token']),
    openId: firstValue(payload, ['open_id', 'openid', 'openId', 'user_id', 'userId']),
    expiresIn: Number(firstValue(payload, ['expires_in', 'expiresIn'])) || 7200,
  }
}

async function refreshTencentAuth(auth) {
  if (!auth.refreshToken || !auth.clientId || !auth.clientSecret) return auth
  const payload = await requestTencentToken({
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
  })
  const fields = tokenFields(payload)
  const refreshed = {
    ...auth,
    ...fields,
    expiresAt: Date.now() + fields.expiresIn * 1000,
  }
  await writeTencentAuth(refreshed)
  return refreshed
}

async function ensureTencentAuth() {
  let auth = await readTencentAuth()
  if (!auth.accessToken) throw new Error('请先完成腾讯文档授权登录')
  if (auth.expiresAt && auth.expiresAt < Date.now() + 30000) auth = await refreshTencentAuth(auth)
  return auth
}

async function tencentApiRequest(auth, url, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
    'Access-Token': auth.accessToken,
    'Client-Id': auth.clientId,
  }
  if (auth.openId) headers['Open-Id'] = auth.openId

  let response = await fetch(url, { ...options, headers })
  let payload = await readResponsePayload(response)
  try {
    assertTencentResponse(response, payload)
  } catch (error) {
    if (auth.refreshToken && [401, 40001, 40006, 400006].includes(Number(error.code))) {
      const refreshed = await refreshTencentAuth(auth)
      response = await fetch(url, {
        ...options,
        headers: { ...headers, 'Access-Token': refreshed.accessToken },
      })
      payload = await readResponsePayload(response)
      assertTencentResponse(response, payload)
    } else {
      throw error
    }
  }
  return payload
}

async function fetchTencentUser(auth) {
  const url = new URL(TENCENT_USERINFO_URL)
  url.searchParams.set('access_token', auth.accessToken)
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Access-Token': auth.accessToken,
      'Client-Id': auth.clientId,
    },
  })
  const payload = await readResponsePayload(response)
  assertTencentResponse(response, payload)
  const data = payloadData(payload)
  return {
    name: firstValue(data, ['nickname', 'nick_name', 'name', 'username']) || '腾讯文档用户',
    openId: firstValue(data, ['open_id', 'openid', 'openId', 'user_id', 'userId']) || auth.openId || '',
  }
}

function parseTencentDocumentUrl(documentUrl) {
  const url = new URL(documentUrl)
  if (!/(^|\.)docs\.qq\.com$/i.test(url.hostname)) throw new Error('这不是腾讯文档链接')
  const segments = url.pathname.split('/').filter(Boolean)
  const kindIndex = segments.findIndex((segment) => ['sheet', 'doc', 'form'].includes(segment.toLowerCase()))
  const kind = kindIndex >= 0 ? segments[kindIndex].toLowerCase() : 'sheet'
  const encodedId = segments[kindIndex + 1] || segments[segments.length - 1]
  if (!encodedId) throw new Error('无法从腾讯文档链接中识别文件 ID')
  return {
    kind,
    encodedId: decodeURIComponent(encodedId),
    sheetId: url.searchParams.get('tab') || '',
    url: documentUrl,
  }
}

async function resolveTencentFileId(auth, parsed) {
  try {
    const converterUrl = new URL(`${TENCENT_API_BASE}/drive/v2/util/converter`)
    converterUrl.searchParams.set('type', parsed.kind === 'sheet' ? 'sheet' : 'doc')
    converterUrl.searchParams.set('value', parsed.encodedId)
    const payload = await tencentApiRequest(auth, converterUrl.toString())
    const data = payloadData(payload)
    return firstValue(data, ['id', 'ID', 'file_id', 'fileId', 'value']) || parsed.encodedId
  } catch {
    return parsed.encodedId
  }
}

function extractSheetRows(payload) {
  const data = payloadData(payload)
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(data?.values)
      ? data.values
      : Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(payload?.values)
          ? payload.values
          : []

  return rows
    .map((row) => {
      if (Array.isArray(row)) return row.map((cell) => String(cell ?? '').trim()).join('\t')
      if (row && Array.isArray(row.values)) return row.values.map((cell) => String(cell ?? '').trim()).join('\t')
      return String(row ?? '').trim()
    })
    .filter(Boolean)
    .join('\n')
}

async function readTencentSheet(auth, parsed) {
  const fileId = await resolveTencentFileId(auth, parsed)
  let sheetId = parsed.sheetId

  if (!sheetId) {
    try {
      const metadata = await tencentApiRequest(auth, `${TENCENT_API_BASE}/spreadsheet/v3/files/${encodeURIComponent(fileId)}/sheets`)
      const data = payloadData(metadata)
      const sheets = data.sheets || data.items || (Array.isArray(data) ? data : [])
      sheetId = firstValue(sheets[0], ['id', 'sheet_id', 'sheetId'])
    } catch {
      sheetId = ''
    }
  }

  if (!sheetId) throw new Error('无法识别腾讯文档中的工作表，请在链接中保留 tab 参数')

  const range = 'A1:ZZ500'
  const endpoints = [
    `${TENCENT_API_BASE}/spreadsheet/v3/files/${encodeURIComponent(fileId)}/sheets/${encodeURIComponent(sheetId)}/values/${range}`,
    `${TENCENT_API_BASE}/spreadsheet/v3/files/${encodeURIComponent(fileId)}/sheets/${encodeURIComponent(sheetId)}/values?range=${encodeURIComponent(range)}`,
    `${TENCENT_API_BASE}/spreadsheet/v2/files/${encodeURIComponent(fileId)}/sheets/${encodeURIComponent(sheetId)}/values?range=${encodeURIComponent(range)}`,
  ]

  let lastError
  for (const endpoint of endpoints) {
    try {
      const payload = await tencentApiRequest(auth, endpoint)
      const text = extractSheetRows(payload)
      if (text) {
        return {
          name: `腾讯文档 · ${fileId}`,
          type: 'tencent-sheet',
          text: cleanText(text),
          url: parsed.url,
          note: '已通过腾讯文档授权读取工作表',
        }
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('腾讯文档工作表没有读取到数据')
}

async function parseTencentDocument(documentUrl) {
  const auth = await ensureTencentAuth()
  const parsed = parseTencentDocumentUrl(documentUrl)
  if (parsed.kind !== 'sheet') throw new Error('当前已接入腾讯文档在线表格，普通文档请先导出为 Excel')
  return readTencentSheet(auth, parsed)
}

async function parseImage(buffer) {
  try {
    if (!ocrWorker) {
      const { createWorker } = require('tesseract.js')
      ocrWorker = await createWorker('eng+chi_sim', 1, { logger: () => {} })
    }
    const result = await ocrWorker.recognize(buffer)
    return cleanText(result?.data?.text)
  } catch (error) {
    console.warn('OCR unavailable:', error.message)
    return ''
  }
}

async function parseFile(filePath) {
  const absolutePath = path.resolve(filePath)
  const stat = await fs.stat(absolutePath)
  if (!stat.isFile()) throw new Error('请选择一个文件')
  const buffer = await fs.readFile(absolutePath)
  const ext = path.extname(absolutePath).toLowerCase()
  const name = path.basename(absolutePath)

  if (['.txt', '.md', '.csv', '.tsv', '.json', '.log'].includes(ext)) {
    return { name, type: 'text', text: cleanText(buffer.toString('utf8')) }
  }

  if (ext === '.docx') {
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return { name, type: 'word', text: cleanText(result.value) }
  }

  if (['.xlsx', '.xls'].includes(ext)) {
    const XLSX = require('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheets = workbook.SheetNames.map((sheetName) => XLSX.utils.sheet_to_txt(workbook.Sheets[sheetName]))
    return { name, type: 'excel', text: cleanText(sheets.join('\n')) }
  }

  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse')
    const result = await pdfParse(buffer)
    return { name, type: 'pdf', text: cleanText(result.text) }
  }

  if (['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'].includes(ext)) {
    const text = await parseImage(buffer)
    return { name, type: 'image', text: cleanText(text), ocr: Boolean(text), note: text ? '已完成 OCR 识别' : '图片未识别出文字，可先补充任务标题' }
  }

  throw new Error(`暂不支持 ${ext || '该类型'} 文件`)
}

async function parseUrl(url) {
  const normalized = String(url || '').trim()
  if (!/^https?:\/\//i.test(normalized)) throw new Error('请输入以 http:// 或 https:// 开头的在线文档链接')
  const response = await fetch(normalized, { headers: { 'User-Agent': 'TaskDock/0.1' } })
  if (!response.ok) throw new Error(`链接访问失败（${response.status}）`)
  const contentType = response.headers.get('content-type') || ''
  const raw = await response.text()
  const text = contentType.includes('html')
    ? raw.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    : raw
  return { name: new URL(normalized).hostname, type: 'link', text: cleanText(text), url: normalized }
}

async function completeTencentOAuth(callbackUrl) {
  const callback = new URL(callbackUrl)
  if (callback.searchParams.get('state') !== tencentOAuthState) throw new Error('腾讯文档授权状态校验失败')
  if (callback.searchParams.get('error')) throw new Error(callback.searchParams.get('error_description') || '腾讯文档授权失败')
  const code = callback.searchParams.get('code')
  if (!code) throw new Error('腾讯文档授权没有返回 code')

  const auth = await readTencentAuth()
  const payload = await requestTencentToken({
    grant_type: 'authorization_code',
    code,
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
    redirect_uri: auth.redirectUri,
  })
  const fields = tokenFields(payload)
  const nextAuth = { ...auth, ...fields, expiresAt: Date.now() + fields.expiresIn * 1000 }
  nextAuth.user = await fetchTencentUser(nextAuth).catch(() => ({ name: '腾讯文档用户', openId: nextAuth.openId || '' }))
  await writeTencentAuth(nextAuth)
  mainWindow?.webContents.send('tencent-auth-result', { ok: true, status: getTencentAuthStatus(nextAuth) })
}

app.whenReady().then(() => {
  ipcMain.handle('parse-file', (_event, filePath) => parseFile(filePath))
  ipcMain.handle('parse-url', (_event, url) => parseUrl(url))
  ipcMain.handle('parse-tencent-url', (_event, url) => parseTencentDocument(url))
  ipcMain.handle('tencent-auth-status', async () => getTencentAuthStatus(await readTencentAuth()))
  ipcMain.handle('tencent-logout', async () => {
    const auth = await readTencentAuth()
    await writeTencentAuth({ clientId: auth.clientId || '', clientSecret: auth.clientSecret || '', redirectUri: auth.redirectUri || DEFAULT_TENCENT_REDIRECT_URI })
    return getTencentAuthStatus(await readTencentAuth())
  })
  ipcMain.handle('tencent-oauth-start', async (_event, config) => {
    const saved = await readTencentAuth()
    const clientId = String(config?.clientId || saved.clientId || '').trim()
    const clientSecret = String(config?.clientSecret || saved.clientSecret || '').trim()
    const redirectUri = String(config?.redirectUri || saved.redirectUri || DEFAULT_TENCENT_REDIRECT_URI).trim()
    if (!clientId || !clientSecret) throw new Error('请先填写腾讯文档开放平台的 Client ID 和 Client Secret')

    await writeTencentAuth({ ...saved, clientId, clientSecret, redirectUri })
    tencentOAuthState = randomUUID()
    const authUrl = new URL(TENCENT_AUTH_URL)
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'all')
    authUrl.searchParams.set('state', tencentOAuthState)

    if (tencentAuthWindow && !tencentAuthWindow.isDestroyed()) tencentAuthWindow.close()
    tencentAuthWindow = new BrowserWindow({
      width: 520,
      height: 760,
      parent: mainWindow || undefined,
      title: '腾讯文档授权登录',
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    })
    const handleNavigation = (event, targetUrl) => {
      if (!targetUrl.startsWith(redirectUri)) return
      event.preventDefault()
      completeTencentOAuth(targetUrl)
        .catch((error) => mainWindow?.webContents.send('tencent-auth-result', { ok: false, error: error.message }))
        .finally(() => {
          if (tencentAuthWindow && !tencentAuthWindow.isDestroyed()) tencentAuthWindow.close()
          tencentOAuthState = ''
        })
    }
    tencentAuthWindow.webContents.on('will-redirect', handleNavigation)
    tencentAuthWindow.webContents.on('will-navigate', handleNavigation)
    tencentAuthWindow.on('closed', () => { tencentAuthWindow = null })
    await tencentAuthWindow.loadURL(authUrl.toString())
    return { ok: true }
  })
  ipcMain.on('window-minimize', () => mainWindow?.minimize())
  ipcMain.on('window-hide', () => mainWindow?.hide())
  ipcMain.on('window-show', () => mainWindow?.show())
  ipcMain.handle('open-external', (_event, url) => shell.openExternal(url))
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  if (ocrWorker) {
    await ocrWorker.terminate().catch(() => {})
    ocrWorker = null
  }
  if (process.platform !== 'darwin') app.quit()
})
