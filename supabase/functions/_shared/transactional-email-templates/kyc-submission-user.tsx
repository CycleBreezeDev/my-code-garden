import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MegaLotto'

interface KycSubmissionUserProps {
  fullName?: string
}

const KycSubmissionUserEmail = ({ fullName }: KycSubmissionUserProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We've received your identity verification</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{fullName ? `Thanks, ${fullName}!` : 'Thanks!'}</Heading>
        <Text style={text}>
          We've received your identity verification submission for {SITE_NAME}. Our team will review it shortly — most reviews complete within 1–2 business days.
        </Text>
        <Section style={card}>
          <Text style={row}><strong>Status:</strong> Pending review</Text>
          <Text style={row}>You'll receive another email as soon as a decision is made.</Text>
        </Section>
        <Text style={footer}>If you didn't submit this, please contact support immediately.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: KycSubmissionUserEmail,
  subject: `We've received your identity verification`,
  displayName: 'KYC submission (user)',
  previewData: { fullName: 'Jane Doe' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px' }
const row = { fontSize: '14px', color: '#0f172a', margin: '6px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
