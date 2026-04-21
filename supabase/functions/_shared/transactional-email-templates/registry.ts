/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as kycSubmissionAdmin } from './kyc-submission-admin.tsx'
import { template as kycSubmissionUser } from './kyc-submission-user.tsx'
import { template as kycApproved } from './kyc-approved.tsx'
import { template as kycRejected } from './kyc-rejected.tsx'
import { template as queueTest } from './queue-test.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'kyc-submission-admin': kycSubmissionAdmin,
  'kyc-submission-user': kycSubmissionUser,
  'kyc-approved': kycApproved,
  'kyc-rejected': kycRejected,
  'queue-test': queueTest,
}
