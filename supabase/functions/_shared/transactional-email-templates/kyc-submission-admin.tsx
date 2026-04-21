import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MegaLotto'

interface KycSubmissionAdminProps {
  userEmail?: string
  fullName?: string
  country?: string
  idType?: string
  hasIdDoc?: boolean
  hasSelfie?: boolean
  hasPor?: boolean
  adminUrl?: string
}

const KycSubmissionAdminEmail = ({
  userEmail,
  fullName,
  country,
  idType,
  hasIdDoc,
  hasSelfie,
  hasPor,
  adminUrl,
}: KycSubmissionAdminProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New KYC submission from {fullName || userEmail || 'a user'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New KYC submission</Heading>
        <Text style={text}>
          A user has submitted KYC documents for review on {SITE_NAME}.
        </Text>

        <Section style={card}>
          <Text style={row}><strong>Name:</strong> {fullName || '—'}</Text>
          <Text style={row}><strong>Email:</strong> {userEmail || '—'}</Text>
          <Text style={row}><strong>Country:</strong> {country || '—'}</Text>
          <Text style={row}><strong>ID type:</strong> {idType || '—'}</Text>
          <Text style={row}>
            <strong>Documents:</strong>{' '}
            {[hasIdDoc && 'ID', hasSelfie && 'Selfie', hasPor && 'Proof of residence']
              .filter(Boolean)
              .join(', ') || 'None'}
          </Text>
        </Section>

        {adminUrl && (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={adminUrl} style={button}>Review in admin panel</Button>
          </Section>
        )}

        <Text style={footer}>You're receiving this because you're an admin on {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: KycSubmissionAdminEmail,
  subject: (d: Record<string, any>) =>
    `New KYC submission${d.fullName ? ` — ${d.fullName}` : ''}`,
  displayName: 'KYC submission (admin)',
  previewData: {
    userEmail: 'user@example.com',
    fullName: 'Jane Doe',
    country: 'NG',
    idType: 'passport',
    hasIdDoc: true,
    hasSelfie: true,
    hasPor: false,
    adminUrl: 'https://example.com/admin',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px 20px',
}
const row = { fontSize: '14px', color: '#0f172a', margin: '6px 0' }
const button = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 'bold',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
