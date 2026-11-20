export {}

declare global {
  interface TencentAuthStatus {
    connected: boolean
    clientId: string
    redirectUri: string
    user?: {
      name: string
      openId?: string
    } | null
  }

  interface Window {
    electronAPI?: {
      getPathForFile: (file: File) => string
      parseFile: (filePath: string) => Promise<{
        name: string
        type: string
        text: string
        url?: string
        ocr?: boolean
        note?: string
      }>
      parseUrl: (url: string) => Promise<{
        name: string
        type: string
        text: string
        url?: string
        note?: string
      }>
      parseTencentUrl: (url: string) => Promise<{
        name: string
        type: string
        text: string
        url?: string
        note?: string
      }>
      getTencentAuthStatus: () => Promise<TencentAuthStatus>
      startTencentOAuth: (config: {
        clientId: string
        clientSecret: string
        redirectUri: string
      }) => Promise<{ ok: boolean }>
      logoutTencent: () => Promise<TencentAuthStatus>
      onTencentAuthResult: (callback: (payload: {
        ok: boolean
        error?: string
        status?: TencentAuthStatus
      }) => void) => () => void
      minimize: () => void
      hide: () => void
      show: () => void
      openExternal: (url: string) => Promise<void>
    }
  }
}
