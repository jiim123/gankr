/// <reference types="vite/client" />

import type { GankrApi } from '../../preload/index'

declare global {
  interface Window {
    gankr: GankrApi
  }
}

export {}
