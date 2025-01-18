export interface ProjectOptions {
  name: string
  packageManager: 'npm' | 'yarn' | 'pnpm'
  description?: string
}
