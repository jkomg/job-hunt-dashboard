export const ROLE_LABELS = {
  job_seeker: 'Solo Job Seeker',
  accelerator_user: 'Accelerator Member',
  premium_user: 'Premium Member',
  vip_user: 'VIP Member',
  staff: 'Staff',
  org_admin: 'Organization Admin',
  admin: 'Admin'
}

export const CANDIDATE_ROLE_OPTIONS = [
  { value: 'job_seeker', label: 'Solo Job Seeker' },
  { value: 'accelerator_user', label: 'Accelerator Member' },
  { value: 'premium_user', label: 'Premium Member' },
  { value: 'vip_user', label: 'VIP Member' }
]

export const OPERATIONAL_ROLE_OPTIONS = [
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' }
]

export function roleLabel(role) {
  return ROLE_LABELS[String(role || '').trim()] || String(role || 'Unknown role')
}
