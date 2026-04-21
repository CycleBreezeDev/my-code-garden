import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MegaLotto'

interface KycRejectedProps {
  fullName?: string
  reason?: string
  kycUrl?: string
}

const KycRejectedEmail = ({ fullName, reason, kycUrl }: KycRejectedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Action needed on your identity verification</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{fullName ? `Hi ${fullName},` : 'Hi,'}</Heading>
        <Text style={text}>
          Unfortunately, we couldn't verify your identity on {SITE_NAME} this time. You can resubmit with updated information at any time.
        </Text>
        {reason && (
          <Section style={card}>
            <Text style={row}><strong>Reason:</strong> {reason}</Text>
          </Section>
        )}
        {kycUrl && (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={kycUrl} style={button}>Resubmit verification</Button>
          </Section>
        )}
        <Text style={footer}>Need help? Reply to this email and our support team will assist you.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: KycRejectedEmail,
  subject: 'Action needed on your identity verification',
  displayName: 'KYC rejected (user)',
  previewData: { fullName: 'Jane Doe', reason: 'ID document was unclear.', kycUrl: 'https://example.com/kyc' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px 20px' }
const row = { fontSize: '14px', color: '#0f172a', margin: '6px 0' }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
