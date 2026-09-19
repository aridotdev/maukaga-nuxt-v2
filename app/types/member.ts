export type MemberRole = 'admin' | 'management' | 'qrcc'

export type MemberRow = {
  id: string
  email: string
  name: string
  role: MemberRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type MembersResponse = {
  rows: MemberRow[]
  summary: {
    total: number
    active: number
    inactive: number
    admins: number
  }
}
