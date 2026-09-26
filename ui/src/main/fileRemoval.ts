import { unlink } from 'fs/promises'

// Chromium and FFmpeg may take a moment to release their Windows file handles.
export async function removeFileWithRetry(path: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await unlink(path)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return
      if (attempt >= 10 || (code !== 'EBUSY' && code !== 'EPERM' && code !== 'EACCES')) throw error
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}
